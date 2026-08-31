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

ALLOWED_ATTACHMENT_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".png", ".jpg", ".jpeg", ".gif", ".zip", ".rar", ".7z", ".txt",
}
MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024


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


class ProjectAttachment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    filename: str
    stored_name: str
    size_bytes: int
    content_type: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    uploaded_by: Optional[str] = None


# ---------------------------------------------------------------------------
# "Project" module (internal software development project tracking).
# Entirely separate domain from the SI tender-case tracking above — no
# shared tables, no shared foreign keys. Only login/role plumbing is shared.
# ---------------------------------------------------------------------------

DEV_PROJECT_CATEGORIES = ["eService", "eSales", "eOperation", "eMarketing"]

DEV_PROJECT_STAGE_DEFINITIONS = [
    {"stage_key": "planning", "stage_name": "規劃", "sequence": 1},
    {"stage_key": "frontend_dev", "stage_name": "前端開發", "sequence": 2},
    {"stage_key": "backend_dev", "stage_name": "後端開發", "sequence": 3},
    {"stage_key": "testing", "stage_name": "測試", "sequence": 4},
    {"stage_key": "pending_launch", "stage_name": "預估上線", "sequence": 5},
]

DEV_PROJECT_STATUS_OPTIONS = ["規劃", "前端開發", "後端開發", "測試", "預估上線", "已上線"]
DEV_PROJECT_PLANNING_STATUSES = {"規劃"}
DEV_PROJECT_DEVELOPING_STATUSES = {"前端開發", "後端開發", "測試", "預估上線"}
DEV_PROJECT_LIVE_STATUSES = {"已上線"}

DEV_PROJECT_FIELD_LABELS = {
    "name": "專案名稱",
    "category": "類別",
    "content_description": "內容說明",
    "benefit_assessment": "效益評估",
    "pm_name": "負責PM",
    "tpm_name": "負責TPM",
    "tpm_department": "TPM部門",
    "claude_team_link": "Claude team link",
    "established_date": "立案時間",
    "status": "狀態",
}
DEV_PROJECT_STAGE_FIELD_LABELS = {
    "planned_start_date": "表定開始日",
    "planned_end_date": "表定結束日",
    "actual_start_date": "實際開始日",
    "actual_end_date": "實際結束日",
    "notes": "重點說明",
}


class DevProject(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    category: str
    content_description: Optional[str] = None
    benefit_assessment: Optional[str] = None
    pm_name: Optional[str] = None
    tpm_name: Optional[str] = None
    tpm_department: Optional[str] = None
    claude_team_link: Optional[str] = None
    established_date: Optional[date] = None
    status: str = Field(default="規劃")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DevProjectStage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    dev_project_id: int = Field(foreign_key="devproject.id", index=True)
    stage_key: str
    stage_name: str
    sequence: int
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    notes: Optional[str] = None


class DevProjectHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    dev_project_id: int = Field(foreign_key="devproject.id", index=True)
    changed_at: datetime = Field(default_factory=datetime.utcnow)
    changed_by: Optional[str] = None
    summary: str
    changes_json: str


class DevProjectAttachment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    dev_project_id: int = Field(foreign_key="devproject.id", index=True)
    category: str
    stage_id: Optional[int] = Field(default=None, foreign_key="devprojectstage.id")
    filename: str
    stored_name: str
    size_bytes: int
    content_type: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    uploaded_by: Optional[str] = None
