from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import os

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "database.db")


# =========================================================
# DATABASE CONNECTION
# =========================================================

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


# =========================================================
# DATABASE INITIALIZATION
# =========================================================

def init_db():

    conn = get_db_connection()

    # =====================================================
    # USERS TABLE
    # =====================================================

    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            cnic TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # =====================================================
    # CHILDREN TABLE
    # =====================================================

    conn.execute("""
        CREATE TABLE IF NOT EXISTS children (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            dob TEXT,
            mother TEXT,
            parent_cnic TEXT,
            address TEXT,
            gender TEXT,
            status TEXT DEFAULT 'pending',
            created_by INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    """)

    # =====================================================
    # VACCINATIONS TABLE
    # =====================================================

    conn.execute("""
        CREATE TABLE IF NOT EXISTS vaccinations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_id INTEGER NOT NULL,
            parent_cnic TEXT,
            vaccine TEXT NOT NULL,
            dose TEXT,
            status TEXT,
            date TEXT,
            location TEXT,
            vaccinator_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (child_id) REFERENCES children(id),
            FOREIGN KEY (vaccinator_id) REFERENCES users(id)
        )
    """)

    conn.commit()
    conn.close()

    print("Database initialized successfully!")
    print("Users, Children and Vaccinations tables are ready!")


# =========================================================
# FRONTEND
# =========================================================

@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:filename>")
def serve_file(filename):
    return send_from_directory(BASE_DIR, filename)


# =========================================================
# API STATUS
# =========================================================

@app.route("/api", methods=["GET"])
def api_status():

    return jsonify({
        "message": "ImmunoSphere API is running",
        "database": "SQLite",
        "status": "success"
    })


# =========================================================
# REGISTER
# =========================================================

@app.route("/api/register", methods=["POST"])
def register():

    data = request.get_json()

    if not data:
        return jsonify({
            "error": "JSON data is required"
        }), 400

    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    role = str(data.get("role", "")).strip()
    cnic = str(data.get("cnic", "")).strip()

    if not name:
        return jsonify({
            "error": "Name is required"
        }), 400

    if not email:
        return jsonify({
            "error": "Email is required"
        }), 400

    if not password:
        return jsonify({
            "error": "Password is required"
        }), 400

    if len(password) < 6:
        return jsonify({
            "error": "Password must be at least 6 characters"
        }), 400

    if role not in [
        "parent",
        "vaccinator",
        "supervisor"
    ]:
        return jsonify({
            "error": "Invalid role"
        }), 400

    if role == "parent" and not cnic:
        return jsonify({
            "error": "CNIC is required for parent"
        }), 400

    conn = get_db_connection()

    existing = conn.execute(
        """
        SELECT id
        FROM users
        WHERE email = ?
        """,
        (email,)
    ).fetchone()

    if existing:

        conn.close()

        return jsonify({
            "error": "Email already exists"
        }), 409

    cursor = conn.execute(
        """
        INSERT INTO users
        (
            name,
            email,
            password,
            role,
            cnic
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            name,
            email,
            password,
            role,
            cnic if role == "parent" else None
        )
    )

    conn.commit()

    user_id = cursor.lastrowid

    conn.close()

    return jsonify({

        "message": "Account created successfully",

        "user": {

            "id": user_id,
            "name": name,
            "email": email,
            "role": role,
            "cnic": cnic if role == "parent" else ""

        }

    }), 201


# =========================================================
# LOGIN
# =========================================================

@app.route("/api/login", methods=["POST"])
def login():

    data = request.get_json()

    if not data:
        return jsonify({
            "error": "JSON data is required"
        }), 400

    email = str(
        data.get("email", "")
    ).strip().lower()

    password = str(
        data.get("password", "")
    )

    if not email:
        return jsonify({
            "error": "Email is required"
        }), 400

    if not password:
        return jsonify({
            "error": "Password is required"
        }), 400

    conn = get_db_connection()

    user = conn.execute(
        """
        SELECT
            id,
            name,
            email,
            password,
            role,
            cnic,
            created_at
        FROM users
        WHERE email = ?
        """,
        (email,)
    ).fetchone()

    conn.close()

    if user is None:
        return jsonify({
            "error": "Invalid email or password"
        }), 401

    if user["password"] != password:
        return jsonify({
            "error": "Invalid email or password"
        }), 401

    return jsonify({

        "message": "Login successful",

        "user": {

            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "cnic": user["cnic"] or "",
            "createdAt": user["created_at"]

        }

    }), 200


# =========================================================
# USERS - GET ALL
# =========================================================

@app.route("/api/users", methods=["GET"])
def get_users():

    conn = get_db_connection()

    users = conn.execute(
        """
        SELECT
            id,
            name,
            email,
            role,
            cnic,
            created_at
        FROM users
        ORDER BY id DESC
        """
    ).fetchall()

    conn.close()

    result = []

    for user in users:

        result.append({

            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "cnic": user["cnic"] or "",
            "createdAt": user["created_at"]

        })

    return jsonify({

        "count": len(result),
        "users": result

    }), 200


# =========================================================
# USER - GET ONE
# =========================================================

@app.route("/api/users/<int:user_id>", methods=["GET"])
def get_user(user_id):

    conn = get_db_connection()

    user = conn.execute(
        """
        SELECT
            id,
            name,
            email,
            role,
            cnic,
            created_at
        FROM users
        WHERE id = ?
        """,
        (user_id,)
    ).fetchone()

    conn.close()

    if user is None:
        return jsonify({
            "error": "User not found"
        }), 404

    return jsonify({

        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "cnic": user["cnic"] or "",
        "createdAt": user["created_at"]

    }), 200


# =========================================================
# CHILDREN - GET ALL
# =========================================================

@app.route("/api/children", methods=["GET"])
def get_children():

    conn = get_db_connection()

    children = conn.execute(
        """
        SELECT
            id,
            name,
            dob,
            mother,
            parent_cnic,
            address,
            gender,
            status,
            created_by,
            created_at
        FROM children
        ORDER BY id DESC
        """
    ).fetchall()

    conn.close()

    result = []

    for child in children:

        result.append({

            "id": child["id"],

            "name": child["name"],

            "dob": child["dob"] or "",

            "mother": child["mother"] or "",

            "parentCnic": child["parent_cnic"] or "",

            "address": child["address"] or "",

            "gender": child["gender"] or "",

            "status": child["status"] or "pending",

            # IMPORTANT
            "createdBy": child["created_by"],

            "createdAt": child["created_at"]

        })

    return jsonify({

        "count": len(result),
        "children": result

    }), 200


# =========================================================
# CHILD - GET ONE
# =========================================================

@app.route("/api/children/<int:child_id>", methods=["GET"])
def get_child(child_id):

    conn = get_db_connection()

    child = conn.execute(
        """
        SELECT
            id,
            name,
            dob,
            mother,
            parent_cnic,
            address,
            gender,
            status,
            created_by,
            created_at
        FROM children
        WHERE id = ?
        """,
        (child_id,)
    ).fetchone()

    conn.close()

    if child is None:
        return jsonify({
            "error": "Child not found"
        }), 404

    return jsonify({

        "id": child["id"],
        "name": child["name"],
        "dob": child["dob"] or "",
        "mother": child["mother"] or "",
        "parentCnic": child["parent_cnic"] or "",
        "address": child["address"] or "",
        "gender": child["gender"] or "",
        "status": child["status"] or "pending",

        # IMPORTANT
        "createdBy": child["created_by"],

        "createdAt": child["created_at"]

    }), 200


# =========================================================
# CHILD - CREATE
# =========================================================

@app.route("/api/children", methods=["POST"])
def create_child():

    data = request.get_json()

    if not data:

        return jsonify({
            "error": "JSON data is required"
        }), 400

    # -----------------------------------------------------
    # CHILD NAME
    # -----------------------------------------------------

    name = str(
        data.get("name", "")
    ).strip()

    if not name:

        return jsonify({
            "error": "Child name is required"
        }), 400

    # -----------------------------------------------------
    # CHILD INFORMATION
    # -----------------------------------------------------

    dob = data.get("dob", "")

    mother = data.get(
        "mother",
        ""
    )

    # Accept both:
    # parent_cnic
    # parentCnic

    parent_cnic = data.get(
        "parent_cnic",
        data.get("parentCnic", "")
    )

    address = data.get(
        "address",
        ""
    )

    gender = data.get(
        "gender",
        ""
    )

    status = data.get(
        "status",
        "pending"
    )

    # -----------------------------------------------------
    # CREATED BY
    # -----------------------------------------------------
    # Accept both:
    # created_by
    # createdBy

    created_by = data.get(
        "created_by",
        data.get("createdBy")
    )

    # -----------------------------------------------------
    # CREATED BY REQUIRED
    # -----------------------------------------------------

    if created_by is None:

        return jsonify({
            "error": "created_by is required"
        }), 400

    # -----------------------------------------------------
    # CONVERT USER ID TO INTEGER
    # -----------------------------------------------------

    try:

        created_by = int(created_by)

    except (
        ValueError,
        TypeError
    ):

        return jsonify({
            "error": "created_by must be a valid user ID"
        }), 400

    # -----------------------------------------------------
    # DATABASE CONNECTION
    # -----------------------------------------------------

    conn = get_db_connection()

    # -----------------------------------------------------
    # CHECK USER
    # -----------------------------------------------------

    user = conn.execute(
        """
        SELECT id
        FROM users
        WHERE id = ?
        """,
        (created_by,)
    ).fetchone()

    if user is None:

        conn.close()

        return jsonify({
            "error": "Invalid created_by user ID"
        }), 400

    # -----------------------------------------------------
    # INSERT CHILD
    # -----------------------------------------------------

    cursor = conn.execute(
        """
        INSERT INTO children
        (
            name,
            dob,
            mother,
            parent_cnic,
            address,
            gender,
            status,
            created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            name,
            dob,
            mother,
            parent_cnic,
            address,
            gender,
            status,
            created_by
        )
    )

    conn.commit()

    child_id = cursor.lastrowid

    # -----------------------------------------------------
    # GET SAVED CHILD
    # -----------------------------------------------------

    child = conn.execute(
        """
        SELECT
            id,
            name,
            dob,
            mother,
            parent_cnic,
            address,
            gender,
            status,
            created_by,
            created_at
        FROM children
        WHERE id = ?
        """,
        (child_id,)
    ).fetchone()

    conn.close()

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return jsonify({

        "message": "Child registered successfully",

        "child": {

            "id": child["id"],

            "name": child["name"],

            "dob": child["dob"] or "",

            "mother": child["mother"] or "",

            "parentCnic": child["parent_cnic"] or "",

            "address": child["address"] or "",

            "gender": child["gender"] or "",

            "status": child["status"] or "pending",

            "createdBy": child["created_by"],

            "createdAt": child["created_at"]

        }

    }), 201


# =========================================================
# CHILD - UPDATE
# =========================================================

@app.route("/api/children/<int:child_id>", methods=["PUT"])
def update_child(child_id):

    data = request.get_json()

    if not data:

        return jsonify({
            "error": "JSON data is required"
        }), 400

    conn = get_db_connection()

    existing = conn.execute(
        """
        SELECT *
        FROM children
        WHERE id = ?
        """,
        (child_id,)
    ).fetchone()

    if existing is None:

        conn.close()

        return jsonify({
            "error": "Child not found"
        }), 404

    name = data.get(
        "name",
        existing["name"]
    )

    dob = data.get(
        "dob",
        existing["dob"]
    )

    mother = data.get(
        "mother",
        existing["mother"]
    )

    parent_cnic = data.get(
        "parentCnic",
        data.get(
            "parent_cnic",
            existing["parent_cnic"]
        )
    )

    address = data.get(
        "address",
        existing["address"]
    )

    gender = data.get(
        "gender",
        existing["gender"]
    )

    status = data.get(
        "status",
        existing["status"]
    )

    conn.execute(
        """
        UPDATE children
        SET
            name = ?,
            dob = ?,
            mother = ?,
            parent_cnic = ?,
            address = ?,
            gender = ?,
            status = ?
        WHERE id = ?
        """,
        (
            name,
            dob,
            mother,
            parent_cnic,
            address,
            gender,
            status,
            child_id
        )
    )

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Child updated successfully"
    }), 200


# =========================================================
# CHILD - DELETE
# =========================================================

@app.route("/api/children/<int:child_id>", methods=["DELETE"])
def delete_child(child_id):

    conn = get_db_connection()

    existing = conn.execute(
        """
        SELECT id
        FROM children
        WHERE id = ?
        """,
        (child_id,)
    ).fetchone()

    if existing is None:

        conn.close()

        return jsonify({
            "error": "Child not found"
        }), 404

    conn.execute(
        """
        DELETE FROM vaccinations
        WHERE child_id = ?
        """,
        (child_id,)
    )

    conn.execute(
        """
        DELETE FROM children
        WHERE id = ?
        """,
        (child_id,)
    )

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Child deleted successfully"
    }), 200


# =========================================================
# VACCINATIONS - GET ALL
# =========================================================

@app.route("/api/vaccinations", methods=["GET"])
def get_vaccinations():

    conn = get_db_connection()

    vaccinations = conn.execute(
        """
        SELECT *
        FROM vaccinations
        ORDER BY id DESC
        """
    ).fetchall()

    conn.close()

    result = []

    for vaccination in vaccinations:

        result.append({

            "id": vaccination["id"],

            "childId": vaccination["child_id"],

            "parentCnic":
                vaccination["parent_cnic"] or "",

            "vaccine":
                vaccination["vaccine"],

            "dose":
                vaccination["dose"] or "",

            "status":
                vaccination["status"] or "",

            "date":
                vaccination["date"] or "",

            "location":
                vaccination["location"] or "",

            "vaccinatorId":
                vaccination["vaccinator_id"],

            "createdAt":
                vaccination["created_at"]

        })

    return jsonify({

        "count": len(result),
        "vaccinations": result

    }), 200


# =========================================================
# VACCINATION - CREATE
# =========================================================

@app.route("/api/vaccinations", methods=["POST"])
def create_vaccination():

    data = request.get_json()

    if not data:

        return jsonify({
            "error": "JSON data is required"
        }), 400

    child_id = data.get(
        "childId",
        data.get("child_id")
    )

    vaccine = str(
        data.get("vaccine", "")
    ).strip()

    if not child_id:

        return jsonify({
            "error": "Child ID is required"
        }), 400

    if not vaccine:

        return jsonify({
            "error": "Vaccine is required"
        }), 400

    conn = get_db_connection()

    child = conn.execute(
        """
        SELECT *
        FROM children
        WHERE id = ?
        """,
        (child_id,)
    ).fetchone()

    if child is None:

        conn.close()

        return jsonify({
            "error": "Child not found"
        }), 404

    parent_cnic = data.get(
        "parentCnic",
        data.get(
            "parent_cnic",
            child["parent_cnic"]
        )
    )

    dose = data.get(
        "dose",
        ""
    )

    status = data.get(
        "status",
        ""
    )

    date = data.get(
        "date",
        ""
    )

    location = data.get(
        "location",
        ""
    )

    vaccinator_id = data.get(
        "vaccinatorId",
        data.get("vaccinator_id")
    )

    cursor = conn.execute(
        """
        INSERT INTO vaccinations
        (
            child_id,
            parent_cnic,
            vaccine,
            dose,
            status,
            date,
            location,
            vaccinator_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            child_id,
            parent_cnic,
            vaccine,
            dose,
            status,
            date,
            location,
            vaccinator_id
        )
    )

    vaccination_id = cursor.lastrowid

    conn.execute(
        """
        UPDATE children
        SET status = ?
        WHERE id = ?
        """,
        (
            status,
            child_id
        )
    )

    conn.commit()
    conn.close()

    return jsonify({

        "message":
            "Vaccination recorded successfully",

        "vaccination": {

            "id":
                vaccination_id,

            "childId":
                child_id,

            "parentCnic":
                parent_cnic,

            "vaccine":
                vaccine,

            "dose":
                dose,

            "status":
                status,

            "date":
                date,

            "location":
                location,

            "vaccinatorId":
                vaccinator_id

        }

    }), 201


# =========================================================
# VACCINATION - UPDATE
# =========================================================

@app.route(
    "/api/vaccinations/<int:vaccination_id>",
    methods=["PUT"]
)
def update_vaccination(vaccination_id):

    data = request.get_json()

    if not data:

        return jsonify({
            "error": "JSON data is required"
        }), 400

    conn = get_db_connection()

    existing = conn.execute(
        """
        SELECT *
        FROM vaccinations
        WHERE id = ?
        """,
        (vaccination_id,)
    ).fetchone()

    if existing is None:

        conn.close()

        return jsonify({
            "error": "Vaccination record not found"
        }), 404

    vaccine = data.get(
        "vaccine",
        existing["vaccine"]
    )

    dose = data.get(
        "dose",
        existing["dose"]
    )

    status = data.get(
        "status",
        existing["status"]
    )

    date = data.get(
        "date",
        existing["date"]
    )

    location = data.get(
        "location",
        existing["location"]
    )

    conn.execute(
        """
        UPDATE vaccinations
        SET
            vaccine = ?,
            dose = ?,
            status = ?,
            date = ?,
            location = ?
        WHERE id = ?
        """,
        (
            vaccine,
            dose,
            status,
            date,
            location,
            vaccination_id
        )
    )

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Vaccination updated successfully"
    }), 200


# =========================================================
# VACCINATION - DELETE
# =========================================================

@app.route(
    "/api/vaccinations/<int:vaccination_id>",
    methods=["DELETE"]
)
def delete_vaccination(vaccination_id):

    conn = get_db_connection()

    existing = conn.execute(
        """
        SELECT id
        FROM vaccinations
        WHERE id = ?
        """,
        (vaccination_id,)
    ).fetchone()

    if existing is None:

        conn.close()

        return jsonify({
            "error": "Vaccination record not found"
        }), 404

    conn.execute(
        """
        DELETE FROM vaccinations
        WHERE id = ?
        """,
        (vaccination_id,)
    )

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Vaccination deleted successfully"
    }), 200


# =========================================================
# RUN APPLICATION
# =========================================================

if __name__ == "__main__":

    init_db()

    print("----------------------------------------")
    print("IMMUNOSPHERE - FRONTEND + BACKEND")
    print("----------------------------------------")
    print("Database:", DATABASE)
    print("Frontend: http://127.0.0.1:5000")
    print("API:      http://127.0.0.1:5000/api")
    print("----------------------------------------")

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )