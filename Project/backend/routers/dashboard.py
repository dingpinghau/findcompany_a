from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.auth import require_login
from backend.database import get_session
from backend.models import ACTIVE_STATUSES, Project, ProjectStage

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(require_login)])


class DashboardSummary(BaseModel):
    total_projects: int
    potential_revenue: float
    overdue_projects: int
    status_counts: dict[str, int]


@router.get("/summary", response_model=DashboardSummary)
def get_summary(session: Session = Depends(get_session)):
    # Only the active pipeline (待公告/公開徵求/進行中/已得標) shows on the home
    # dashboard — closed-out cases (已流標/NO-GO/已結案) live on 前期專案查詢 instead.
    projects = [p for p in session.exec(select(Project)).all() if p.status in ACTIVE_STATUSES]
    today = date.today()

    status_counts = {status: 0 for status in ACTIVE_STATUSES}
    potential_revenue = 0.0
    overdue_projects = 0

    for project in projects:
        status_counts[project.status] = status_counts.get(project.status, 0) + 1
        if project.budget_amount:
            potential_revenue += project.budget_amount

        stages = session.exec(
            select(ProjectStage).where(ProjectStage.project_id == project.id)
        ).all()
        is_overdue = any(
            (s.actual_date and s.planned_date and s.actual_date > s.planned_date)
            or (not s.actual_date and s.planned_date and today > s.planned_date)
            for s in stages
        )
        if is_overdue:
            overdue_projects += 1

    return DashboardSummary(
        total_projects=len(projects),
        potential_revenue=potential_revenue,
        overdue_projects=overdue_projects,
        status_counts=status_counts,
    )
