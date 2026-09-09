from flask import Flask, request, jsonify

app = Flask(__name__)

# Temporary in-memory database
users = [
    {
        "id": 1,
        "name": "Ali",
        "email": "ali@gmail.com",
        "age": 22
    },
    {
        "id": 2,
        "name": "Sara",
        "email": "sara@gmail.com",
        "age": 21
    }
]


# Home endpoint
@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Backend API is running successfully"
    })


# GET API - Get all users
@app.route("/users", methods=["GET"])
def get_users():
    return jsonify({
        "success": True,
        "users": users
    })


# POST API - Add a new user
@app.route("/users", methods=["POST"])
def add_user():

    # Get JSON data from request
    data = request.get_json()

    # Check if data was provided
    if not data:
        return jsonify({
            "success": False,
            "message": "Request body is required"
        }), 400

    # Get user input
    name = data.get("name")
    email = data.get("email")
    age = data.get("age")

    # Basic validation
    if not name:
        return jsonify({
            "success": False,
            "message": "Name is required"
        }), 400

    if not email:
        return jsonify({
            "success": False,
            "message": "Email is required"
        }), 400

    if "@" not in email:
        return jsonify({
            "success": False,
            "message": "Invalid email format"
        }), 400

    if age is None:
        return jsonify({
            "success": False,
            "message": "Age is required"
        }), 400

    if not isinstance(age, int):
        return jsonify({
            "success": False,
            "message": "Age must be a number"
        }), 400

    if age < 1 or age > 120:
        return jsonify({
            "success": False,
            "message": "Age must be between 1 and 120"
        }), 400

    # Create new user
    new_user = {
        "id": len(users) + 1,
        "name": name,
        "email": email,
        "age": age
    }

    # Add user to list
    users.append(new_user)

    # Return response
    return jsonify({
        "success": True,
        "message": "User created successfully",
        "user": new_user
    }), 201


# Run the server
if __name__ == "__main__":
    app.run(debug=True)