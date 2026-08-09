import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, canEditProjects, CLOSED_STATUSES } from "../api";
import Roadmap from "../components/Roadmap";

const ROADMAP_STATUSES = ["公開徵求", "進行中", "待公告"];

const money = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 });

function formatMoney(value) {
  if (value === null || value === undefined) return "-";
  return `NT$ ${money.format(value)}`;
}

function formatNumber(value) {
  if (value === null || value === undefined) return "-";
  return money.format(value);
}

function StatusBadge({ status }) {
  return <span className="badge">{status}</span>;
}

export default function Dashboard({ user }) {
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.dashboardSummary(), api.listProjects()])
      .then(([s, p]) => {
        setSummary(s);
        setProjects(p);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!summary) return null;

  const maxStatusCount = Math.max(1, ...Object.values(summary.status_counts));
  const activeProjects = projects.filter((p) => !CLOSED_STATUSES.includes(p.status));
  const roadmapProjects = activeProjects.filter((p) => ROADMAP_STATUSES.includes(p.status));

  return (
    <div>
      <div className="page-header">
        <h1>專案總覽</h1>
        {canEditProjects(user.role) && (
          <Link className="btn btn-primary" to="/projects/new">
            + 建立與維護專案
          </Link>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">專案總數</div>
          <div className="value">{summary.total_projects}</div>
        </div>
        <div className="stat-card">
          <div className="label">潛在總營收（進行中案件預算金額）</div>
          <div className="value">{formatMoney(summary.potential_revenue)}</div>
        </div>
        <div className="stat-card overdue">
          <div className="label">逾期案件數</div>
          <div className="value">{summary.overdue_projects}</div>
        </div>
      </div>

      <div className="card">
        <h2>狀態分佈</h2>
        <div className="status-bars">
          {Object.entries(summary.status_counts).map(([status, count]) => (
            <div className="status-bar-row" key={status}>
              <span>{status}</span>
              <div className="status-bar-track">
                <div className="status-bar-fill" style={{ width: `${(count / maxStatusCount) * 100}%` }} />
              </div>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>專案時程 Roadmap</h2>
        <Roadmap projects={roadmapProjects} />
      </div>

      <div className="card">
        <h2>專案列表</h2>
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>案名</th>
              <th>業務處</th>
              <th>狀態</th>
              <th>投標日</th>
              <th>逾期</th>
              <th className="text-right">預算金額(NT$)</th>
            </tr>
          </thead>
          <tbody>
            {activeProjects.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link className="project-name-link" to={`/projects/${p.id}`}>
                    {p.name}
                  </Link>
                </td>
                <td>{p.business_unit || "-"}</td>
                <td>
                  <StatusBadge status={p.status} />
                </td>
                <td>{p.bid_date || "-"}</td>
                <td>{p.is_overdue ? <span className="badge overdue">逾期</span> : "-"}</td>
                <td className="text-right">{formatNumber(p.budget_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
