import json
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.auth import require_login, require_role
from backend.database import UPLOADS_DIR, get_session
from backend.models import (
    ALLOWED_ATTACHMENT_EXTENSIONS,
    BID_SUBMIT_STAGE_KEY,
    MAX_ATTACHMENT_SIZE,
    PROJECT_EDIT_ROLES,
    PROJECT_FIELD_LABELS,
    STAGE_FIELD_LABELS,
    Project,
    ProjectAttachment,
    ProjectHistory,
    ProjectStage,
    STAGE_DEFINITIONS,
)

router = APIRouter(prefix="/api/projects", tags=["projects"], dependencies=[Depends(require_login)])
can_edit_projects = Depends(require_role(*PROJECT_EDIT_ROLES))
can_manage_history = Depends(require_role("admin"))
can_manage_attachments = Depends(require_role("admin"))


def stage_is_overdue(stage: ProjectStage, today: date) -> bool:
    if stage.planned_date is None:
        return False
    if stage.actual_date is not None:
        return stage.actual_date > stage.planned_date
    return today > stage.planned_date


class StageOut(BaseModel):
    id: int
    stage_key: str
    stage_name: str
    sequence: int
    planned_date: Optional[date]
    actual_date: Optional[date]
    overdue_reason: Optional[str]
    is_overdue: bool


class ProjectOut(BaseModel):
    id: int
    name: str
    business_unit: Optional[str]
    sales_rep: Optional[str]
    status: str
    budget_amount: Optional[float]
    estimated_bid_amount: Optional[float]
    estimated_cost: Optional[float]
    no_go_reason: Optional[str]
    progress_notes: Optional[str]
    bid_date: Optional[date]
    kickoff_date: Optional[date]
    is_overdue: bool
    show_new_progress: bool


class ProjectDetailOut(ProjectOut):
    stages: list[StageOut]


class HistoryChangeOut(BaseModel):
    field: str
    label: str
    old: Optional[str]
    new: Optional[str]


class HistoryEntryOut(BaseModel):
    id: int
    changed_at: datetime
    changed_by: Optional[str]
    summary: str
    changes: list[HistoryChangeOut]


class AttachmentOut(BaseModel):
    id: int
    filename: str
    size_bytes: int
    content_type: Optional[str]
    uploaded_at: datetime
    uploaded_by: Optional[str]


class RenameAttachmentPayload(BaseModel):
    filename: str


class CreateProjectPayload(BaseModel):
    name: str
    business_unit: Optional[str] = None
    sales_rep: Optional[str] = None
    status: str = "待公告"
    budget_amount: Optional[float] = None
    estimated_bid_amount: Optional[float] = None
    estimated_cost: Optional[float] = None
    progress_notes: Optional[str] = None
    bid_date: Optional[date] = None


NO_BID_DATE_REQUIRED_STATUSES = ("待公告", "公開徵求")


class UpdateProjectPayload(BaseModel):
    name: Optional[str] = None
    business_unit: Optional[str] = None
    sales_rep: Optional[str] = None
    status: Optional[str] = None
    budget_amount: Optional[float] = None
    estimated_bid_amount: Optional[float] = None
    estimated_cost: Optional[float] = None
    no_go_reason: Optional[str] = None
    progress_notes: Optional[str] = None
    show_new_progress: Optional[bool] = None
    bid_date: Optional[date] = None


class UpdateStagePayload(BaseModel):
    planned_date: Optional[date] = None
    actual_date: Optional[date] = None
    overdue_reason: Optional[str] = None


def _build_stage_out(stage: ProjectStage, today: date) -> StageOut:
    return StageOut(
        id=stage.id,
        stage_key=stage.stage_key,
        stage_name=stage.stage_name,
        sequence=stage.sequence,
        planned_date=stage.planned_date,
        actual_date=stage.actual_date,
        overdue_reason=stage.overdue_reason,
        is_overdue=stage_is_overdue(stage, today),
    )


def _derive_stage_date(stages: list[ProjectStage], stage_key: str) -> Optional[date]:
    stage = next((s for s in stages if s.stage_key == stage_key), None)
    if not stage:
        return None
    return stage.actual_date or stage.planned_date


def _build_project_out(project: Project, stages: list[ProjectStage], today: date) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        business_unit=project.business_unit,
        sales_rep=project.sales_rep,
        status=project.status,
        budget_amount=project.budget_amount,
        estimated_bid_amount=project.estimated_bid_amount,
        estimated_cost=project.estimated_cost,
        no_go_reason=project.no_go_reason,
        progress_notes=project.progress_notes,
        bid_date=_derive_stage_date(stages, "bid_submit"),
        kickoff_date=_derive_stage_date(stages, "kickoff_meeting"),
        is_overdue=any(stage_is_overdue(s, today) for s in stages),
        show_new_progress=project.show_new_progress,
    )


def _stringify(value: Any) -> Optional[str]:
    if value is None:
        return None
    return str(value)


def _record_history(
    session: Session, project_id: int, summary: str, changes: list[dict], changed_by: Optional[str]
) -> None:
    if not changes:
        return
    session.add(
        ProjectHistory(
            project_id=project_id,
            summary=summary,
            changes_json=json.dumps(changes, ensure_ascii=False),
            changed_by=changed_by,
        )
    )


@router.get("", response_model=list[ProjectOut])
def list_projects(session: Session = Depends(get_session)):
    today = date.today()
    projects = session.exec(select(Project)).all()
    out = []
    for project in projects:
        stages = session.exec(
            select(ProjectStage).where(ProjectStage.project_id == project.id)
        ).all()
        out.append(_build_project_out(project, stages, today))
    return out


@router.post("", response_model=ProjectDetailOut, dependencies=[can_edit_projects])
def create_project(payload: CreateProjectPayload, request: Request, session: Session = Depends(get_session)):
    if payload.bid_date is None and payload.status not in NO_BID_DATE_REQUIRED_STATUSES:
        raise HTTPException(status_code=422, detail="此狀態需要填寫投標日")

    project = Project(
        name=payload.name,
        business_unit=payload.business_unit,
        sales_rep=payload.sales_rep,
        status=payload.status,
        budget_amount=payload.budget_amount,
        estimated_bid_amount=payload.estimated_bid_amount,
        estimated_cost=payload.estimated_cost,
        progress_notes=payload.progress_notes,
        show_new_progress=True,
    )
    session.add(project)
    session.commit()
    session.refresh(project)

    stages = []
    for definition in STAGE_DEFINITIONS:
        stage = ProjectStage(
            project_id=project.id,
            stage_key=definition["stage_key"],
            stage_name=definition["stage_name"],
            sequence=definition["sequence"],
            offset_days=definition["offset_days"],
            planned_date=payload.bid_date + timedelta(days=definition["offset_days"]) if payload.bid_date else None,
        )
        session.add(stage)
        stages.append(stage)

    session.add(
        ProjectHistory(
            project_id=project.id,
            summary="建立專案",
            changes_json="[]",
            changed_by=request.session.get("username"),
        )
    )
    session.commit()
    for stage in stages:
        session.refresh(stage)

    today = date.today()
    base = _build_project_out(project, stages, today)
    return ProjectDetailOut(**base.model_dump(), stages=[_build_stage_out(s, today) for s in stages])


@router.get("/{project_id}", response_model=ProjectDetailOut)
def get_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="找不到專案")
    stages = session.exec(
        select(ProjectStage).where(ProjectStage.project_id == project_id).order_by(ProjectStage.sequence)
    ).all()
    today = date.today()
    base = _build_project_out(project, stages, today)
    return ProjectDetailOut(**base.model_dump(), stages=[_build_stage_out(s, today) for s in stages])


@router.get("/{project_id}/history", response_model=list[HistoryEntryOut])
def get_project_history(project_id: int, session: Session = Depends(get_session)):
    entries = session.exec(
        select(ProjectHistory)
        .where(ProjectHistory.project_id == project_id)
        .order_by(ProjectHistory.changed_at.desc())
    ).all()
    return [
        HistoryEntryOut(
            id=e.id,
            changed_at=e.changed_at,
            changed_by=e.changed_by,
            summary=e.summary,
            changes=json.loads(e.changes_json),
        )
        for e in entries
    ]


@router.delete("/{project_id}/history/{history_id}", dependencies=[can_manage_history])
def delete_project_history(project_id: int, history_id: int, session: Session = Depends(get_session)):
    entry = session.get(ProjectHistory, history_id)
    if not entry or entry.project_id != project_id:
        raise HTTPException(status_code=404, detail="找不到歷程紀錄")
    session.delete(entry)
    session.commit()
    return {"ok": True}


@router.get("/{project_id}/attachments", response_model=list[AttachmentOut])
def list_attachments(project_id: int, session: Session = Depends(get_session)):
    attachments = session.exec(
        select(ProjectAttachment)
        .where(ProjectAttachment.project_id == project_id)
        .order_by(ProjectAttachment.uploaded_at.desc())
    ).all()
    return attachments


@router.post("/{project_id}/attachments", response_model=AttachmentOut, dependencies=[can_edit_projects])
async def upload_attachment(
    project_id: int, request: Request, file: UploadFile = File(...), session: Session = Depends(get_session)
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="找不到專案")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise HTTPException(status_code=400, detail="不支援的檔案格式")

    contents = await file.read(MAX_ATTACHMENT_SIZE + 1)
    if len(contents) > MAX_ATTACHMENT_SIZE:
        raise HTTPException(status_code=413, detail="檔案大小超過 20MB 上限")

    stored_name = f"{uuid.uuid4().hex}{ext}"
    (UPLOADS_DIR / stored_name).write_bytes(contents)

    attachment = ProjectAttachment(
        project_id=project_id,
        filename=file.filename,
        stored_name=stored_name,
        size_bytes=len(contents),
        content_type=file.content_type,
        uploaded_by=request.session.get("username"),
    )
    session.add(attachment)
    session.add(
        ProjectHistory(
            project_id=project_id,
            summary=f"新增附件：{file.filename}",
            changes_json="[]",
            changed_by=request.session.get("username"),
        )
    )
    session.commit()
    session.refresh(attachment)
    return attachment


@router.get("/{project_id}/attachments/{attachment_id}/download")
def download_attachment(project_id: int, attachment_id: int, session: Session = Depends(get_session)):
    attachment = session.get(ProjectAttachment, attachment_id)
    if not attachment or attachment.project_id != project_id:
        raise HTTPException(status_code=404, detail="找不到附件")
    path = UPLOADS_DIR / attachment.stored_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="找不到附件檔案")
    return FileResponse(path, filename=attachment.filename, media_type=attachment.content_type or "application/octet-stream")


@router.patch(
    "/{project_id}/attachments/{attachment_id}", response_model=AttachmentOut, dependencies=[can_manage_attachments]
)
def rename_attachment(
    project_id: int,
    attachment_id: int,
    payload: RenameAttachmentPayload,
    request: Request,
    session: Session = Depends(get_session),
):
    attachment = session.get(ProjectAttachment, attachment_id)
    if not attachment or attachment.project_id != project_id:
        raise HTTPException(status_code=404, detail="找不到附件")

    old_filename = attachment.filename
    if payload.filename != old_filename:
        attachment.filename = payload.filename
        session.add(attachment)
        session.add(
            ProjectHistory(
                project_id=project_id,
                summary=f"附件更名：{old_filename} → {payload.filename}",
                changes_json="[]",
                changed_by=request.session.get("username"),
            )
        )
    session.commit()
    session.refresh(attachment)
    return attachment


@router.delete("/{project_id}/attachments/{attachment_id}", dependencies=[can_manage_attachments])
def delete_attachment(
    project_id: int, attachment_id: int, request: Request, session: Session = Depends(get_session)
):
    attachment = session.get(ProjectAttachment, attachment_id)
    if not attachment or attachment.project_id != project_id:
        raise HTTPException(status_code=404, detail="找不到附件")

    (UPLOADS_DIR / attachment.stored_name).unlink(missing_ok=True)
    session.delete(attachment)
    session.add(
        ProjectHistory(
            project_id=project_id,
            summary=f"刪除附件：{attachment.filename}",
            changes_json="[]",
            changed_by=request.session.get("username"),
        )
    )
    session.commit()
    return {"ok": True}


@router.patch("/{project_id}", response_model=ProjectDetailOut, dependencies=[can_edit_projects])
def update_project(
    project_id: int, payload: UpdateProjectPayload, request: Request, session: Session = Depends(get_session)
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="找不到專案")

    updates = payload.model_dump(exclude_unset=True)
    bid_date_provided = "bid_date" in updates
    new_bid_date = updates.pop("bid_date", None)

    changes = []
    other_field_changed = False
    for key, value in updates.items():
        old_value = getattr(project, key)
        if old_value != value:
            changes.append(
                {"field": key, "label": PROJECT_FIELD_LABELS.get(key, key), "old": _stringify(old_value), "new": _stringify(value)}
            )
            if key != "show_new_progress":
                other_field_changed = True
        setattr(project, key, value)

    stages = session.exec(
        select(ProjectStage).where(ProjectStage.project_id == project_id).order_by(ProjectStage.sequence)
    ).all()

    if bid_date_provided:
        bid_submit_stage = next((s for s in stages if s.stage_key == BID_SUBMIT_STAGE_KEY), None)
        already_bid = bool(bid_submit_stage and bid_submit_stage.actual_date)
        if not already_bid:
            old_bid_date = _derive_stage_date(stages, BID_SUBMIT_STAGE_KEY)
            if old_bid_date != new_bid_date:
                changes.append(
                    {"field": "bid_date", "label": "投標日", "old": _stringify(old_bid_date), "new": _stringify(new_bid_date)}
                )
                other_field_changed = True
            for stage in stages:
                if stage.actual_date is not None:
                    continue
                new_planned = (new_bid_date + timedelta(days=stage.offset_days)) if new_bid_date else None
                if stage.planned_date == new_planned:
                    continue
                if stage.stage_key != BID_SUBMIT_STAGE_KEY:
                    changes.append(
                        {
                            "field": f"stage_{stage.stage_key}_planned_date",
                            "label": f"{stage.stage_name} 表定日",
                            "old": _stringify(stage.planned_date),
                            "new": _stringify(new_planned),
                        }
                    )
                stage.planned_date = new_planned
                session.add(stage)

    if other_field_changed:
        project.show_new_progress = True

    project.updated_at = datetime.utcnow()
    session.add(project)
    _record_history(session, project_id, "基本資料更新", changes, request.session.get("username"))
    session.commit()
    session.refresh(project)

    stages = session.exec(
        select(ProjectStage).where(ProjectStage.project_id == project_id).order_by(ProjectStage.sequence)
    ).all()
    today = date.today()
    base = _build_project_out(project, stages, today)
    return ProjectDetailOut(**base.model_dump(), stages=[_build_stage_out(s, today) for s in stages])


@router.patch("/{project_id}/stages/{stage_id}", response_model=StageOut, dependencies=[can_edit_projects])
def update_stage(
    project_id: int,
    stage_id: int,
    payload: UpdateStagePayload,
    request: Request,
    session: Session = Depends(get_session),
):
    stage = session.get(ProjectStage, stage_id)
    if not stage or stage.project_id != project_id:
        raise HTTPException(status_code=404, detail="找不到關卡")

    updates = payload.model_dump(exclude_unset=True)
    changes = []
    for key, value in updates.items():
        old_value = getattr(stage, key)
        if old_value != value:
            changes.append(
                {"field": key, "label": STAGE_FIELD_LABELS.get(key, key), "old": _stringify(old_value), "new": _stringify(value)}
            )
        setattr(stage, key, value)
    session.add(stage)

    project = session.get(Project, project_id)
    if project:
        project.updated_at = datetime.utcnow()
        session.add(project)

    _record_history(session, project_id, f"{stage.stage_name} 關卡更新", changes, request.session.get("username"))
    session.commit()
    session.refresh(stage)
    return _build_stage_out(stage, date.today())
