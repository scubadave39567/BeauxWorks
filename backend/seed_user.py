"""One-time script to seed the initial admin user."""
import sys
import uuid
from datetime import datetime, timezone

# Add the backend directory to the path
sys.path.insert(0, ".")

from app.config import settings
from app.database import SessionLocal
from app.security.passwords import hash_password
from app.models.identity import User

def main():
    email = "scubadave39567@gmail.com"
    display_name = "David Chamberlain"
    password = "#Sunpiganddad1"

    password_hash = hash_password(password)

    db = SessionLocal()
    try:
        # Check if user already exists
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"User {email} already exists (id={existing.user_id}). Skipping.")
            return

        user = User(
            email=email,
            display_name=display_name,
            password_hash=password_hash,
            password_algo="argon2id",
            is_active=True,
            failed_login_count=0,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"Created user: {user.display_name} <{user.email}> (id={user.user_id})")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()
