from flask import Flask, request, jsonify
import sqlite3
import os

app = Flask(__name__)

# Database file
DATABASE = "database.db"


# ==========================================
# DATABASE CONNECTION
# ==========================================
def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


# ==========================================
# CREATE DATABASE AND TABLE
# ==========================================
def init_db():
    conn = get_db_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            age INTEGER NOT NULL
        )
    """)

    conn.commit()
    conn.close()

    print("Database initialized successfully!")
    print("Users table is ready!")


# ==========================================
# HOME
# ==========================================
@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Project 3 Database API is running",
        "database": "SQLite",
        "table": "users",
        "CRUD": [
            "POST /users",
            "GET /users",
            "GET /users/<id>",
            "PUT /users/<id>",
            "DELETE /users/<id>"
        ]
    })


# ==========================================
# CREATE USER - POST
# ==========================================
@app.route("/users", methods=["POST"])
def create_user():

    data = request.get_json()

    if not data:
        return jsonify({
            "error": "JSON data is required"
        }), 400

    name = data.get("name")
    email = data.get("email")
    age = data.get("age")

    # Validation
    if not name:
        return jsonify({
            "error": "Name is required"
        }), 400

    if not email:
        return jsonify({
            "error": "Email is required"
        }), 400

    if age is None:
        return jsonify({
            "error": "Age is required"
        }), 400

    try:
        age = int(age)
    except ValueError:
        return jsonify({
            "error": "Age must be a number"
        }), 400

    try:
        conn = get_db_connection()

        cursor = conn.execute("""
            INSERT INTO users (name, email, age)
            VALUES (?, ?, ?)
        """, (name, email, age))

        conn.commit()

        user_id = cursor.lastrowid

        conn.close()

        return jsonify({
            "message": "User created successfully",
            "user": {
                "id": user_id,
                "name": name,
                "email": email,
                "age": age
            }
        }), 201

    except sqlite3.IntegrityError:
        return jsonify({
            "error": "Email already exists"
        }), 409


# ==========================================
# READ ALL USERS - GET
# ==========================================
@app.route("/users", methods=["GET"])
def get_users():

    conn = get_db_connection()

    users = conn.execute("""
        SELECT * FROM users
        ORDER BY id
    """).fetchall()

    conn.close()

    users_list = []

    for user in users:
        users_list.append({
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "age": user["age"]
        })

    return jsonify({
        "message": "Users retrieved successfully",
        "count": len(users_list),
        "users": users_list
    }), 200


# ==========================================
# READ SINGLE USER - GET
# ==========================================
@app.route("/users/<int:user_id>", methods=["GET"])
def get_user(user_id):

    conn = get_db_connection()

    user = conn.execute("""
        SELECT * FROM users
        WHERE id = ?
    """, (user_id,)).fetchone()

    conn.close()

    if user is None:
        return jsonify({
            "error": "User not found"
        }), 404

    return jsonify({
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "age": user["age"]
    }), 200


# ==========================================
# UPDATE USER - PUT
# ==========================================
@app.route("/users/<int:user_id>", methods=["PUT"])
def update_user(user_id):

    data = request.get_json()

    if not data:
        return jsonify({
            "error": "JSON data is required"
        }), 400

    name = data.get("name")
    email = data.get("email")
    age = data.get("age")

    if not name:
        return jsonify({
            "error": "Name is required"
        }), 400

    if not email:
        return jsonify({
            "error": "Email is required"
        }), 400

    if age is None:
        return jsonify({
            "error": "Age is required"
        }), 400

    try:
        age = int(age)
    except ValueError:
        return jsonify({
            "error": "Age must be a number"
        }), 400

    conn = get_db_connection()

    # Check if user exists
    existing_user = conn.execute("""
        SELECT * FROM users
        WHERE id = ?
    """, (user_id,)).fetchone()

    if existing_user is None:
        conn.close()

        return jsonify({
            "error": "User not found"
        }), 404

    try:
        conn.execute("""
            UPDATE users
            SET name = ?, email = ?, age = ?
            WHERE id = ?
        """, (name, email, age, user_id))

        conn.commit()
        conn.close()

        return jsonify({
            "message": "User updated successfully",
            "user": {
                "id": user_id,
                "name": name,
                "email": email,
                "age": age
            }
        }), 200

    except sqlite3.IntegrityError:
        conn.close()

        return jsonify({
            "error": "Email already exists"
        }), 409


# ==========================================
# DELETE USER - DELETE
# ==========================================
@app.route("/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):

    conn = get_db_connection()

    # Check if user exists
    existing_user = conn.execute("""
        SELECT * FROM users
        WHERE id = ?
    """, (user_id,)).fetchone()

    if existing_user is None:
        conn.close()

        return jsonify({
            "error": "User not found"
        }), 404

    conn.execute("""
        DELETE FROM users
        WHERE id = ?
    """, (user_id,))

    conn.commit()
    conn.close()

    return jsonify({
        "message": "User deleted successfully",
        "deleted_user_id": user_id
    }), 200


# ==========================================
# START SERVER
# ==========================================
if __name__ == "__main__":

    # Always create database and table first
    init_db()

    print("----------------------------------------")
    print("PROJECT 3 - DATABASE CRUD API")
    print("----------------------------------------")
    print("Database:", os.path.abspath(DATABASE))
    print("Server: http://127.0.0.1:5000")
    print("----------------------------------------")

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )