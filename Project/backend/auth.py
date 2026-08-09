import bcrypt
from fastapi import Depends, HTTPException, Request
from sqlmodel import Session, select

from backend.models import User


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def require_login(request: Request) -> int:
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="未登入")
    return user_id


def require_role(*allowed_roles: str):
    def dependency(request: Request, user_id: int = Depends(require_login)) -> int:
        if request.session.get("role") not in allowed_roles:
            raise HTTPException(status_code=403, detail="權限不足")
        return user_id

    return dependency


def ensure_bootstrap_admin(session: Session, username: str, password: str) -> None:
    existing_admin = session.exec(select(User).where(User.username == username)).first()
    if existing_admin:
        if existing_admin.role != "admin":
            existing_admin.role = "admin"
            session.add(existing_admin)
            session.commit()
        return
    if session.exec(select(User)).first():
        return  # other accounts already exist; don't silently add another admin
    user = User(username=username, password_hash=hash_password(password), role="admin")
    session.add(user)
    session.commit()
