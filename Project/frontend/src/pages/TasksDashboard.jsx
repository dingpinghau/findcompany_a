import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TASK_DONE_STATUSES, api, canEditTasks } from "../api";

function formatDaysRemaining(days) {
  if (days === null || days === undefined) return "-";
  if (days < 0) return `已逾期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天到期";
  return `${days} 天`;
}

export default function TasksDashboard({ user }) {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listTasks().then(setTasks).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!tasks) return null;

  const pendingCount = tasks.filter((t) => !TASK_DONE_STATUSES.includes(t.status)).length;

  return (
    <div>
      <div className="page-header">
        <h1>Task 總覽</h1>
        <div className="actions-row" style={{ marginTop: 0 }}>
          <Link className="btn" to="/tasks/search">
            事件搜尋
          </Link>
          {canEditTasks(user.role) && (
            <Link className="btn btn-primary" to="/tasks/new">
              + 新增Task
            </Link>
          )}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">目前尚待處理的Task數量</div>
          <div className="value">{pendingCount}</div>
        </div>
      </div>

      <div className="card">
        <h2>Task 列表</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Task名稱</th>
                <th>狀態</th>
                <th>開始日</th>
                <th>結束日</th>
                <th>剩餘天數</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link className="project-name-link" to={`/tasks/${t.id}`}>
                      {t.name}
                    </Link>
                  </td>
                  <td>
                    <span className="badge">{t.status}</span>
                  </td>
                  <td>{t.start_date || "-"}</td>
                  <td>{t.end_date || "-"}</td>
                  <td>{formatDaysRemaining(t.days_remaining)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tasks.length === 0 && <p className="muted">目前沒有 Task。</p>}
        </div>
      </div>
    </div>
  );
}
