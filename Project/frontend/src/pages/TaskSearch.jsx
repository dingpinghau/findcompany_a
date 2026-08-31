import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TASK_STATUS_OPTIONS, api } from "../api";
import BackButton from "../components/BackButton";

function formatDaysRemaining(days) {
  if (days === null || days === undefined) return "-";
  if (days < 0) return `已逾期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天到期";
  return `${days} 天`;
}

export default function TaskSearch() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState("");

  const runSearch = () => {
    api
      .listTasks({ q, status })
      .then(setTasks)
      .catch((err) => setError(err.message));
  };

  useEffect(runSearch, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    runSearch();
  };

  return (
    <div>
      <BackButton />
      <div className="page-header">
        <h1>事件搜尋</h1>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field span-2">
            <label>關鍵字（Task名稱／負責人／協力單位）</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="field">
            <label>狀態</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">全部</option>
              {TASK_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="actions-row">
          <button className="btn btn-primary" type="submit">
            搜尋
          </button>
        </div>
      </form>

      {error && <p className="error-text">{error}</p>}
      {tasks && (
        <div className="card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Task名稱</th>
                  <th>負責人</th>
                  <th>協力單位</th>
                  <th>狀態</th>
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
                    <td>{t.owner || "-"}</td>
                    <td>{t.partner_unit || "-"}</td>
                    <td>
                      <span className="badge">{t.status}</span>
                    </td>
                    <td>{t.end_date || "-"}</td>
                    <td>{formatDaysRemaining(t.days_remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tasks.length === 0 && <p className="muted">沒有符合條件的 Task。</p>}
        </div>
      )}
    </div>
  );
}
