from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.auth import require_login, require_role
from backend.database import get_session
from backend.models import PROJECT_EDIT_ROLES, Project, ProjectStage, STAGE_DEFINITIONS

router = APIRouter(prefix="/api/projects", tags=["projects"], dependencies=[Depends(require_login)])
can_edit_projects = Depends(require_role(*PROJECT_EDIT_ROLES))


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


class ProjectDetailOut(ProjectOut):
    stages: list[StageOut]


class CreateProjectPayload(BaseModel):
    name: str
    business_unit: Optional[str] = None
    sales_rep: Optional[str] = None
    status: str = "待公告"
    budget_amount: Optional[float] = None
    estimated_bid_amount: Optional[float] = None
    estimated_cost: Optional[float] = None
    progress_notes: Optional[str] = None
    bid_date: date


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
def create_project(payload: CreateProjectPayload, session: Session = Depends(get_session)):
    project = Project(
        name=payload.name,
        business_unit=payload.business_unit,
        sales_rep=payload.sales_rep,
        status=payload.status,
        budget_amount=payload.budget_amount,
        estimated_bid_amount=payload.estimated_bid_amount,
        estimated_cost=payload.estimated_cost,
        progress_notes=payload.progress_notes,
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
            planned_date=payload.bid_date + timedelta(days=definition["offset_days"]),
        )
        session.add(stage)
        stages.append(stage)
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


@router.patch("/{project_id}", response_model=ProjectDetailOut, dependencies=[can_edit_projects])
def update_project(project_id: int, payload: UpdateProjectPayload, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="找不到專案")
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(project, key, value)
    project.updated_at = datetime.utcnow()
    session.add(project)
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
    project_id: int, stage_id: int, payload: UpdateStagePayload, session: Session = Depends(get_session)
):
    stage = session.get(ProjectStage, stage_id)
    if not stage or stage.project_id != project_id:
        raise HTTPException(status_code=404, detail="找不到關卡")
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(stage, key, value)
    session.add(stage)

    project = session.get(Project, project_id)
    if project:
        project.updated_at = datetime.utcnow()
        session.add(project)

    session.commit()
    session.refresh(stage)
    return _build_stage_out(stage, date.today())
