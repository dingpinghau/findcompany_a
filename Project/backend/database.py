import os
from pathlib import Path

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

# Configurable via DB_PATH so a deployment can point this at a mounted volume
# without that volume shadowing the application code directory (backend/).
DB_PATH = Path(os.environ.get("DB_PATH", Path(__file__).resolve().parent / "app.db"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})


def _migrate_user_role_column() -> None:
    """SQLModel's create_all only creates missing tables, not missing columns
    on tables that already exist — needed here since `role` was added to the
    User model after databases were already seeded."""
    with engine.begin() as conn:
        columns = [row[1] for row in conn.execute(text("PRAGMA table_info(user)"))]
        if "role" not in columns:
            conn.execute(text("ALTER TABLE user ADD COLUMN role TEXT DEFAULT 'user'"))


def _migrate_project_show_new_progress_column() -> None:
    """Added after existing databases were already seeded — same story as
    the role column above."""
    with engine.begin() as conn:
        columns = [row[1] for row in conn.execute(text("PRAGMA table_info(project)"))]
        if "show_new_progress" not in columns:
            conn.execute(text("ALTER TABLE project ADD COLUMN show_new_progress BOOLEAN DEFAULT 1"))


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _migrate_user_role_column()
    _migrate_project_show_new_progress_column()


def get_session():
    with Session(engine) as session:
        yield session
