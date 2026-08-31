import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  DEV_PROJECT_DEVELOPING_STATUSES,
  DEV_PROJECT_LIVE_STATUSES,
  DEV_PROJECT_PLANNING_STATUSES,
  api,
  canEditDevProjectMaster,
} from "../api";
import DevProjectRoadmap from "../components/DevProjectRoadmap";

export default function DevProjectsDashboard({ user }) {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listDevProjects().then(setProjects).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!projects) return null;

  const planningCount = projects.filter((p) => DEV_PROJECT_PLANNING_STATUSES.includes(p.status)).length;
  const developingCount = projects.filter((p) => DEV_PROJECT_DEVELOPING_STATUSES.includes(p.status)).length;
  const liveCount = projects.filter((p) => DEV_PROJECT_LIVE_STATUSES.includes(p.status)).length;

  return (
    <div>
      <div className="page-header">
        <h1>Project 總覽</h1>
        <div className="actions-row" style={{ marginTop: 0 }}>
          <Link className="btn" to="/dev-projects/search">
            專案搜尋
          </Link>
          {canEditDevProjectMaster(user.role) && (
            <Link className="btn btn-primary" to="/dev-projects/new">
              + 新增專案
            </Link>
          )}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">規劃中</div>
          <div className="value">{planningCount}</div>
        </div>
        <div className="stat-card">
          <div className="label">開發中</div>
          <div className="value">{developingCount}</div>
        </div>
        <div className="stat-card">
          <div className="label">已上線</div>
          <div className="value">{liveCount}</div>
        </div>
      </div>

      <div className="card">
        <h2>專案時程 Roadmap</h2>
        <DevProjectRoadmap projects={projects} />
      </div>

      <div className="card">
        <h2>專案列表</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>專案名稱</th>
                <th>類別</th>
                <th>負責PM</th>
                <th>負責TPM</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link className="project-name-link" to={`/dev-projects/${p.id}`}>
                      {p.name}
                    </Link>
                  </td>
                  <td>{p.category}</td>
                  <td>{p.pm_name || "-"}</td>
                  <td>{p.tpm_name || "-"}</td>
                  <td>
                    <span className="badge">{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
