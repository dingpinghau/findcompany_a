from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.auth import hash_password, require_role
from backend.database import get_session
from backend.models import ROLE_OPTIONS, User

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(require_role("admin"))])


class UserOut(BaseModel):
    id: int
    username: str
    role: str


class CreateUserPayload(BaseModel):
    username: str
    password: str
    role: str = "user"


@router.get("", response_model=list[UserOut])
def list_users(session: Session = Depends(get_session)):
    return session.exec(select(User)).all()


@router.post("", response_model=UserOut)
def create_user(payload: CreateUserPayload, session: Session = Depends(get_session)):
    if payload.role not in ROLE_OPTIONS:
        raise HTTPException(status_code=400, detail="無效的權限角色")
    existing = session.exec(select(User).where(User.username == payload.username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="帳號已存在")
    user = User(username=payload.username, password_hash=hash_password(payload.password), role=payload.role)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="找不到帳號")
    if user.role == "admin":
        remaining_admins = session.exec(select(User).where(User.role == "admin")).all()
        if len(remaining_admins) <= 1:
            raise HTTPException(status_code=400, detail="至少需保留一個管理員帳號")
    session.delete(user)
    session.commit()
    return {"ok": True}
