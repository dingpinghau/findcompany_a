from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel

STATUS_OPTIONS = ["待公告", "公開徵求", "進行中", "已得標", "已流標", "NO-GO", "已結案"]

# Statuses that no longer represent a "live" opportunity — excluded from
# potential-revenue totals and used to decide whether a project still needs
# stage tracking attention.
CLOSED_STATUSES = {"已流標", "NO-GO", "已結案"}
ACTIVE_STATUSES = [s for s in STATUS_OPTIONS if s not in CLOSED_STATUSES]

# The 8 fixed pipeline stages, with each stage's planned-date offset (in days)
# relative to the project's bid date (投標日), taken from the 政府標案流程說明
# sheet in 標案案件追蹤_20260806.xlsx.
STAGE_DEFINITIONS = [
    {"stage_key": "collect_docs", "stage_name": "領標", "sequence": 1, "offset_days": -14},
    {"stage_key": "kickoff_meeting", "stage_name": "建案會議", "sequence": 2, "offset_days": -11},
    {"stage_key": "solution_confirm", "stage_name": "解決方案確認", "sequence": 3, "offset_days": -9},
    {"stage_key": "benefit_calc", "stage_name": "效益試算", "sequence": 4, "offset_days": -8},
    {"stage_key": "review_meeting", "stage_name": "風評會議", "sequence": 5, "offset_days": -7},
    {"stage_key": "sales_signoff", "stage_name": "業務正式上簽", "sequence": 6, "offset_days": -6},
    {"stage_key": "approval_meeting", "stage_name": "允投會議", "sequence": 7, "offset_days": -2},
    {"stage_key": "bid_submit", "stage_name": "投標", "sequence": 8, "offset_days": 0},
]
BID_SUBMIT_STAGE_KEY = "bid_submit"

# admin: full access, including account management.
# poweruser: can create/maintain projects, but not manage accounts.
# user: read-only — cannot create/maintain projects or manage accounts.
ROLE_OPTIONS = ["admin", "poweruser", "user"]
PROJECT_EDIT_ROLES = ["admin", "poweruser"]

# Human labels for 專案歷程 change-log entries. Keyed by the field name on
# Project / ProjectStage.
PROJECT_FIELD_LABELS = {
    "name": "案名",
    "business_unit": "業務處",
    "sales_rep": "業務人員",
    "status": "狀態",
    "budget_amount": "預算金額",
    "estimated_bid_amount": "預計投標金額",
    "estimated_cost": "預計成本",
    "no_go_reason": "No Go 原因",
    "progress_notes": "進度說明",
    "show_new_progress": "顯示新進度標記",
}
STAGE_FIELD_LABELS = {
    "planned_date": "表定日",
    "actual_date": "實際日",
    "overdue_reason": "逾期原因",
}


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    password_hash: str
    role: str = Field(default="user")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    business_unit: Optional[str] = None
    sales_rep: Optional[str] = None
    status: str = Field(default="待公告")
    budget_amount: Optional[float] = None
    estimated_bid_amount: Optional[float] = None
    estimated_cost: Optional[float] = None
    no_go_reason: Optional[str] = None
    progress_notes: Optional[str] = None
    # Drives the "新進度" badge on the home page (roadmap + project list).
    # Auto-set to True on create and on any real edit to this project's basic
    # info; admin/poweruser can also flip it manually from the detail page.
    show_new_progress: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ProjectStage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    stage_key: str
    stage_name: str
    sequence: int
    offset_days: int
    planned_date: Optional[date] = None
    actual_date: Optional[date] = None
    overdue_reason: Optional[str] = None


class ProjectHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    changed_at: datetime = Field(default_factory=datetime.utcnow)
    changed_by: Optional[str] = None
    summary: str
    # JSON-encoded list of {field, label, old, new}
    changes_json: str
