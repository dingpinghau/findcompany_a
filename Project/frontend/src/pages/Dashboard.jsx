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

function compareValues(a, b, direction) {
  const dir = direction === "asc" ? 1 : -1;
  if (a === null || a === undefined || a === "") return b === null || b === undefined || b === "" ? 0 : 1;
  if (b === null || b === undefined || b === "") return -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * dir;
  return String(a).localeCompare(String(b), "zh-TW") * dir;
}

function SortableHeader({ column, sortConfig, onSort }) {
  const active = sortConfig.key === column.key;
  return (
    <th
      className={`th-sortable ${column.className || ""} ${active ? "active" : ""}`}
      onClick={() => onSort(column.key)}
    >
      {column.label}
      <span className="sort-arrow">{active ? (sortConfig.direction === "asc" ? "▲" : "▼") : "⇅"}</span>
    </th>
  );
}

export default function Dashboard({ user }) {
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }
    );
  };

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

  const sortedProjects = sortConfig.key
    ? [...activeProjects].sort((a, b) => compareValues(a[sortConfig.key], b[sortConfig.key], sortConfig.direction))
    : activeProjects;

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
              <SortableHeader column={{ key: "business_unit", label: "業務處" }} sortConfig={sortConfig} onSort={handleSort} />
              <SortableHeader column={{ key: "status", label: "狀態" }} sortConfig={sortConfig} onSort={handleSort} />
              <SortableHeader column={{ key: "bid_date", label: "投標日" }} sortConfig={sortConfig} onSort={handleSort} />
              <th>逾期</th>
              <SortableHeader
                column={{ key: "budget_amount", label: "預算金額(NT$)", className: "text-right" }}
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            </tr>
          </thead>
          <tbody>
            {sortedProjects.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link className="project-name-link" to={`/projects/${p.id}`}>
                    {p.name}
                  </Link>
                  {p.show_new_progress && <span className="badge new">新進度</span>}
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
