import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, CLOSED_STATUSES } from "../api";

const money = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 });

function formatNumber(value) {
  if (value === null || value === undefined) return "-";
  return money.format(value);
}

export default function HistoryProjects() {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listProjects().then(setProjects).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!projects) return null;

  const closed = projects.filter((p) => CLOSED_STATUSES.includes(p.status));

  return (
    <div>
      <div className="page-header">
        <h1>前期專案查詢</h1>
      </div>
      <p className="muted" style={{ marginBottom: 16 }}>
        已流標、NO-GO 或已結案的案件會歸檔在這裡，不會出現在首頁的進行中專案總覽。
      </p>
      <div className="card">
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>案名</th>
              <th>業務處</th>
              <th>狀態</th>
              <th>投標日</th>
              <th className="text-right">預算金額(NT$)</th>
              <th>No Go 原因</th>
            </tr>
          </thead>
          <tbody>
            {closed.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link className="project-name-link" to={`/projects/${p.id}`}>
                    {p.name}
                  </Link>
                </td>
                <td>{p.business_unit || "-"}</td>
                <td>
                  <span className="badge closed">{p.status}</span>
                </td>
                <td>{p.bid_date || "-"}</td>
                <td className="text-right">{formatNumber(p.budget_amount)}</td>
                <td>{p.no_go_reason || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
