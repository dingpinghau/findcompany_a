from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.auth import require_login, verify_password
from backend.database import get_session
from backend.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginPayload(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(payload: LoginPayload, request: Request, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.username == payload.username)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    request.session["user_id"] = user.id
    request.session["username"] = user.username
    request.session["role"] = user.role
    return {"id": user.id, "username": user.username, "role": user.role}


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}


@router.get("/me")
def me(request: Request, user_id: int = Depends(require_login)):
    return {"id": user_id, "username": request.session.get("username"), "role": request.session.get("role")}
