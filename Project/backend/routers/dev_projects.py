import json
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.auth import require_login, require_role
from backend.database import DEV_PROJECT_UPLOADS_DIR, get_session
from backend.models import (
    ALLOWED_ATTACHMENT_EXTENSIONS,
    DEV_PROJECT_FIELD_LABELS,
    DEV_PROJECT_STAGE_DEFINITIONS,
    DEV_PROJECT_STAGE_FIELD_LABELS,
    MAX_ATTACHMENT_SIZE,
    DevProject,
    DevProjectAttachment,
    DevProjectHistory,
    DevProjectStage,
)

router = APIRouter(prefix="/api/dev-projects", tags=["dev-projects"], dependencies=[Depends(require_login)])
can_edit_dev_projects = Depends(require_role("admin", "poweruser"))
can_manage_dev_history = Depends(require_role("admin"))
can_manage_dev_attachments = Depends(require_role("admin"))
can_create_dev_projects = Depends(require_role("admin"))


class DevStageOut(BaseModel):
    id: int
    stage_key: str
    stage_name: str
    sequence: int
    planned_start_date: Optional[date]
    planned_end_date: Optional[date]
    actual_start_date: Optional[date]
    actual_end_date: Optional[date]
    notes: Optional[str]


class DevProjectOut(BaseModel):
    id: int
    name: str
    category: str
    content_description: Optional[str]
    benefit_assessment: Optional[str]
    pm_name: Optional[str]
    tpm_name: Optional[str]
    tpm_department: Optional[str]
    claude_team_link: Optional[str]
    established_date: Optional[date]
    status: str
    timeline_start: Optional[date]
    timeline_end: Optional[date]


class DevProjectDetailOut(DevProjectOut):
    stages: list[DevStageOut]


class DevHistoryChangeOut(BaseModel):
    field: str
    label: str
    old: Optional[str]
    new: Optional[str]


class DevHistoryEntryOut(BaseModel):
    id: int
    changed_at: datetime
    changed_by: Optional[str]
    summary: str
    changes: list[DevHistoryChangeOut]


class DevAttachmentOut(BaseModel):
    id: int
    category: str
    stage_id: Optional[int]
    filename: str
    size_bytes: int
    content_type: Optional[str]
    uploaded_at: datetime
    uploaded_by: Optional[str]


class RenameDevAttachmentPayload(BaseModel):
    filename: str


class StagePlanInput(BaseModel):
    stage_key: str
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None


class CreateDevProjectPayload(BaseModel):
    name: str
    category: str
    content_description: Optional[str] = None
    benefit_assessment: Optional[str] = None
    pm_name: Optional[str] = None
    tpm_name: Optional[str] = None
    tpm_department: Optional[str] = None
    claude_team_link: Optional[str] = None
    established_date: Optional[date] = None
    stages: list[StagePlanInput] = []


class UpdateDevProjectPayload(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    content_description: Optional[str] = None
    benefit_assessment: Optional[str] = None
    pm_name: Optional[str] = None
    tpm_name: Optional[str] = None
    tpm_department: Optional[str] = None
    claude_team_link: Optional[str] = None
    established_date: Optional[date] = None
    status: Optional[str] = None


class UpdateDevStagePayload(BaseModel):
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    notes: Optional[str] = None


def _build_stage_out(stage: DevProjectStage) -> DevStageOut:
    return DevStageOut(
        id=stage.id,
        stage_key=stage.stage_key,
        stage_name=stage.stage_name,
        sequence=stage.sequence,
        planned_start_date=stage.planned_start_date,
        planned_end_date=stage.planned_end_date,
        actual_start_date=stage.actual_start_date,
        actual_end_date=stage.actual_end_date,
        notes=stage.notes,
    )


def _compute_timeline(project: DevProject, stages: list[DevProjectStage]) -> tuple[Optional[date], Optional[date]]:
    starts = [s.planned_start_date for s in stages if s.planned_start_date]
    if project.established_date:
        starts.append(project.established_date)
    launch_stage = next((s for s in stages if s.stage_key == "pending_launch"), None)
    timeline_start = min(starts) if starts else None
    timeline_end = launch_stage.planned_end_date if launch_stage else None
    return timeline_start, timeline_end


def _build_dev_project_out(project: DevProject, stages: list[DevProjectStage]) -> DevProjectOut:
    timeline_start, timeline_end = _compute_timeline(project, stages)
    return DevProjectOut(
        id=project.id,
        name=project.name,
        category=project.category,
        content_description=project.content_description,
        benefit_assessment=project.benefit_assessment,
        pm_name=project.pm_name,
        tpm_name=project.tpm_name,
        tpm_department=project.tpm_department,
        claude_team_link=project.claude_team_link,
        established_date=project.established_date,
        status=project.status,
        timeline_start=timeline_start,
        timeline_end=timeline_end,
    )


def _stringify(value: Any) -> Optional[str]:
    if value is None:
        return None
    return str(value)


def _record_dev_history(
    session: Session, dev_project_id: int, summary: str, changes: list[dict], changed_by: Optional[str]
) -> None:
    if not changes:
        return
    session.add(
        DevProjectHistory(
            dev_project_id=dev_project_id,
            summary=summary,
            changes_json=json.dumps(changes, ensure_ascii=False),
            changed_by=changed_by,
        )
    )


@router.get("", response_model=list[DevProjectOut])
def list_dev_projects(
    q: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    session: Session = Depends(get_session),
):
    projects = session.exec(select(DevProject)).all()
    if q:
        needle = q.strip().lower()
        projects = [
            p
            for p in projects
            if needle in (p.name or "").lower()
            or needle in (p.pm_name or "").lower()
            or needle in (p.tpm_name or "").lower()
        ]
    if category:
        projects = [p for p in projects if p.category == category]
    if status:
        projects = [p for p in projects if p.status == status]

    out = []
    for project in projects:
        stages = session.exec(select(DevProjectStage).where(DevProjectStage.dev_project_id == project.id)).all()
        out.append(_build_dev_project_out(project, stages))
    return out


@router.post("", response_model=DevProjectDetailOut, dependencies=[can_create_dev_projects])
def create_dev_project(payload: CreateDevProjectPayload, request: Request, session: Session = Depends(get_session)):
    project = DevProject(
        name=payload.name,
        category=payload.category,
        content_description=payload.content_description,
        benefit_assessment=payload.benefit_assessment,
        pm_name=payload.pm_name,
        tpm_name=payload.tpm_name,
        tpm_department=payload.tpm_department,
        claude_team_link=payload.claude_team_link,
        established_date=payload.established_date,
    )
    session.add(project)
    session.commit()
    session.refresh(project)

    plans_by_key = {s.stage_key: s for s in payload.stages}
    stages = []
    for definition in DEV_PROJECT_STAGE_DEFINITIONS:
        plan = plans_by_key.get(definition["stage_key"])
        stage = DevProjectStage(
            dev_project_id=project.id,
            stage_key=definition["stage_key"],
            stage_name=definition["stage_name"],
            sequence=definition["sequence"],
            planned_start_date=plan.planned_start_date if plan else None,
            planned_end_date=plan.planned_end_date if plan else None,
        )
        session.add(stage)
        stages.append(stage)

    session.add(
        DevProjectHistory(
            dev_project_id=project.id,
            summary="建立專案",
            changes_json="[]",
            changed_by=request.session.get("username"),
        )
    )
    session.commit()
    for stage in stages:
        session.refresh(stage)

    base = _build_dev_project_out(project, stages)
    return DevProjectDetailOut(**base.model_dump(), stages=[_build_stage_out(s) for s in stages])


@router.get("/{dev_project_id}", response_model=DevProjectDetailOut)
def get_dev_project(dev_project_id: int, session: Session = Depends(get_session)):
    project = session.get(DevProject, dev_project_id)
    if not project:
        raise HTTPException(status_code=404, detail="找不到專案")
    stages = session.exec(
        select(DevProjectStage)
        .where(DevProjectStage.dev_project_id == dev_project_id)
        .order_by(DevProjectStage.sequence)
    ).all()
    base = _build_dev_project_out(project, stages)
    return DevProjectDetailOut(**base.model_dump(), stages=[_build_stage_out(s) for s in stages])


@router.get("/{dev_project_id}/history", response_model=list[DevHistoryEntryOut])
def get_dev_project_history(dev_project_id: int, session: Session = Depends(get_session)):
    entries = session.exec(
        select(DevProjectHistory)
        .where(DevProjectHistory.dev_project_id == dev_project_id)
        .order_by(DevProjectHistory.changed_at.desc())
    ).all()
    return [
        DevHistoryEntryOut(
            id=e.id,
            changed_at=e.changed_at,
            changed_by=e.changed_by,
            summary=e.summary,
            changes=json.loads(e.changes_json),
        )
        for e in entries
    ]


@router.delete("/{dev_project_id}/history/{history_id}", dependencies=[can_manage_dev_history])
def delete_dev_project_history(dev_project_id: int, history_id: int, session: Session = Depends(get_session)):
    entry = session.get(DevProjectHistory, history_id)
    if not entry or entry.dev_project_id != dev_project_id:
        raise HTTPException(status_code=404, detail="找不到歷程紀錄")
    session.delete(entry)
    session.commit()
    return {"ok": True}


@router.get("/{dev_project_id}/attachments", response_model=list[DevAttachmentOut])
def list_dev_attachments(
    dev_project_id: int,
    category: Optional[str] = None,
    stage_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    query = select(DevProjectAttachment).where(DevProjectAttachment.dev_project_id == dev_project_id)
    if category:
        query = query.where(DevProjectAttachment.category == category)
    if stage_id:
        query = query.where(DevProjectAttachment.stage_id == stage_id)
    attachments = session.exec(query.order_by(DevProjectAttachment.uploaded_at.desc())).all()
    return attachments


@router.post("/{dev_project_id}/attachments", response_model=DevAttachmentOut, dependencies=[can_edit_dev_projects])
async def upload_dev_attachment(
    dev_project_id: int,
    request: Request,
    category: str = Form(...),
    stage_id: Optional[int] = Form(None),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    project = session.get(DevProject, dev_project_id)
    if not project:
        raise HTTPException(status_code=404, detail="找不到專案")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise HTTPException(status_code=400, detail="不支援的檔案格式")

    contents = await file.read(MAX_ATTACHMENT_SIZE + 1)
    if len(contents) > MAX_ATTACHMENT_SIZE:
        raise HTTPException(status_code=413, detail="檔案大小超過 20MB 上限")

    stored_name = f"{uuid.uuid4().hex}{ext}"
    (DEV_PROJECT_UPLOADS_DIR / stored_name).write_bytes(contents)

    attachment = DevProjectAttachment(
        dev_project_id=dev_project_id,
        category=category,
        stage_id=stage_id,
        filename=file.filename,
        stored_name=stored_name,
        size_bytes=len(contents),
        content_type=file.content_type,
        uploaded_by=request.session.get("username"),
    )
    session.add(attachment)
    session.add(
        DevProjectHistory(
            dev_project_id=dev_project_id,
            summary=f"新增附件：{file.filename}",
            changes_json="[]",
            changed_by=request.session.get("username"),
        )
    )
    session.commit()
    session.refresh(attachment)
    return attachment


@router.get("/{dev_project_id}/attachments/{attachment_id}/download")
def download_dev_attachment(dev_project_id: int, attachment_id: int, session: Session = Depends(get_session)):
    attachment = session.get(DevProjectAttachment, attachment_id)
    if not attachment or attachment.dev_project_id != dev_project_id:
        raise HTTPException(status_code=404, detail="找不到附件")
    path = DEV_PROJECT_UPLOADS_DIR / attachment.stored_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="找不到附件檔案")
    return FileResponse(path, filename=attachment.filename, media_type=attachment.content_type or "application/octet-stream")


@router.patch(
    "/{dev_project_id}/attachments/{attachment_id}",
    response_model=DevAttachmentOut,
    dependencies=[can_manage_dev_attachments],
)
def rename_dev_attachment(
    dev_project_id: int,
    attachment_id: int,
    payload: RenameDevAttachmentPayload,
    request: Request,
    session: Session = Depends(get_session),
):
    attachment = session.get(DevProjectAttachment, attachment_id)
    if not attachment or attachment.dev_project_id != dev_project_id:
        raise HTTPException(status_code=404, detail="找不到附件")

    old_filename = attachment.filename
    if payload.filename != old_filename:
        attachment.filename = payload.filename
        session.add(attachment)
        session.add(
            DevProjectHistory(
                dev_project_id=dev_project_id,
                summary=f"附件更名：{old_filename} → {payload.filename}",
                changes_json="[]",
                changed_by=request.session.get("username"),
            )
        )
    session.commit()
    session.refresh(attachment)
    return attachment


@router.delete("/{dev_project_id}/attachments/{attachment_id}", dependencies=[can_manage_dev_attachments])
def delete_dev_attachment(
    dev_project_id: int, attachment_id: int, request: Request, session: Session = Depends(get_session)
):
    attachment = session.get(DevProjectAttachment, attachment_id)
    if not attachment or attachment.dev_project_id != dev_project_id:
        raise HTTPException(status_code=404, detail="找不到附件")

    (DEV_PROJECT_UPLOADS_DIR / attachment.stored_name).unlink(missing_ok=True)
    session.delete(attachment)
    session.add(
        DevProjectHistory(
            dev_project_id=dev_project_id,
            summary=f"刪除附件：{attachment.filename}",
            changes_json="[]",
            changed_by=request.session.get("username"),
        )
    )
    session.commit()
    return {"ok": True}


@router.patch("/{dev_project_id}", response_model=DevProjectDetailOut)
def update_dev_project(
    dev_project_id: int, payload: UpdateDevProjectPayload, request: Request, session: Session = Depends(get_session)
):
    project = session.get(DevProject, dev_project_id)
    if not project:
        raise HTTPException(status_code=404, detail="找不到專案")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="沒有要更新的欄位")

    role = request.session.get("role")
    other_fields_present = any(key != "status" for key in updates)
    if other_fields_present and role != "admin":
        raise HTTPException(status_code=403, detail="權限不足")
    if "status" in updates and role not in ("admin", "poweruser"):
        raise HTTPException(status_code=403, detail="權限不足")

    changes = []
    for key, value in updates.items():
        old_value = getattr(project, key)
        if old_value != value:
            changes.append(
                {
                    "field": key,
                    "label": DEV_PROJECT_FIELD_LABELS.get(key, key),
                    "old": _stringify(old_value),
                    "new": _stringify(value),
                }
            )
        setattr(project, key, value)

    project.updated_at = datetime.utcnow()
    session.add(project)
    _record_dev_history(session, dev_project_id, "基本資料更新", changes, request.session.get("username"))
    session.commit()
    session.refresh(project)

    stages = session.exec(
        select(DevProjectStage)
        .where(DevProjectStage.dev_project_id == dev_project_id)
        .order_by(DevProjectStage.sequence)
    ).all()
    base = _build_dev_project_out(project, stages)
    return DevProjectDetailOut(**base.model_dump(), stages=[_build_stage_out(s) for s in stages])


@router.patch("/{dev_project_id}/stages/{stage_id}", response_model=DevStageOut, dependencies=[can_edit_dev_projects])
def update_dev_stage(
    dev_project_id: int,
    stage_id: int,
    payload: UpdateDevStagePayload,
    request: Request,
    session: Session = Depends(get_session),
):
    stage = session.get(DevProjectStage, stage_id)
    if not stage or stage.dev_project_id != dev_project_id:
        raise HTTPException(status_code=404, detail="找不到階段")

    updates = payload.model_dump(exclude_unset=True)
    changes = []
    for key, value in updates.items():
        old_value = getattr(stage, key)
        if old_value != value:
            changes.append(
                {
                    "field": key,
                    "label": DEV_PROJECT_STAGE_FIELD_LABELS.get(key, key),
                    "old": _stringify(old_value),
                    "new": _stringify(value),
                }
            )
        setattr(stage, key, value)
    session.add(stage)

    project = session.get(DevProject, dev_project_id)
    if project:
        project.updated_at = datetime.utcnow()
        session.add(project)

    _record_dev_history(
        session, dev_project_id, f"{stage.stage_name} 階段更新", changes, request.session.get("username")
    )
    session.commit()
    session.refresh(stage)
    return _build_stage_out(stage)
