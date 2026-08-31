from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.auth import require_login, require_role
from backend.database import get_session
from backend.models import TASK_EDIT_ROLES, Task

router = APIRouter(prefix="/api/tasks", tags=["tasks"], dependencies=[Depends(require_login)])
can_edit_tasks = Depends(require_role(*TASK_EDIT_ROLES))


class TaskOut(BaseModel):
    id: int
    name: str
    start_date: Optional[date]
    end_date: Optional[date]
    owner: Optional[str]
    partner_unit: Optional[str]
    partner_action: Optional[str]
    status: str
    days_remaining: Optional[int]


class CreateTaskPayload(BaseModel):
    name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    owner: Optional[str] = None
    partner_unit: Optional[str] = None
    partner_action: Optional[str] = None
    status: str = "規劃"


class UpdateTaskPayload(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    owner: Optional[str] = None
    partner_unit: Optional[str] = None
    partner_action: Optional[str] = None
    status: Optional[str] = None


def _build_task_out(task: Task, today: date) -> TaskOut:
    days_remaining = (task.end_date - today).days if task.end_date else None
    return TaskOut(
        id=task.id,
        name=task.name,
        start_date=task.start_date,
        end_date=task.end_date,
        owner=task.owner,
        partner_unit=task.partner_unit,
        partner_action=task.partner_action,
        status=task.status,
        days_remaining=days_remaining,
    )


@router.get("", response_model=list[TaskOut])
def list_tasks(q: Optional[str] = None, status: Optional[str] = None, session: Session = Depends(get_session)):
    tasks = session.exec(select(Task)).all()
    if q:
        needle = q.strip().lower()
        tasks = [
            t
            for t in tasks
            if needle in (t.name or "").lower()
            or needle in (t.owner or "").lower()
            or needle in (t.partner_unit or "").lower()
        ]
    if status:
        tasks = [t for t in tasks if t.status == status]
    today = date.today()
    return [_build_task_out(t, today) for t in tasks]


@router.post("", response_model=TaskOut, dependencies=[can_edit_tasks])
def create_task(payload: CreateTaskPayload, session: Session = Depends(get_session)):
    task = Task(**payload.model_dump())
    session.add(task)
    session.commit()
    session.refresh(task)
    return _build_task_out(task, date.today())


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="找不到Task")
    return _build_task_out(task, date.today())


@router.patch("/{task_id}", response_model=TaskOut, dependencies=[can_edit_tasks])
def update_task(task_id: int, payload: UpdateTaskPayload, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="找不到Task")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(task, key, value)
    task.updated_at = datetime.utcnow()
    session.add(task)
    session.commit()
    session.refresh(task)
    return _build_task_out(task, date.today())
