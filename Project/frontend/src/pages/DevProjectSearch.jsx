import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DEV_PROJECT_CATEGORIES, DEV_PROJECT_STATUS_OPTIONS, api } from "../api";
import BackButton from "../components/BackButton";

export default function DevProjectSearch() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState("");

  const runSearch = () => {
    api
      .listDevProjects({ q, category, status })
      .then(setProjects)
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
        <h1>專案搜尋</h1>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field span-2">
            <label>關鍵字（專案名稱／PM／TPM）</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="field">
            <label>類別</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">全部</option>
              {DEV_PROJECT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>狀態</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">全部</option>
              {DEV_PROJECT_STATUS_OPTIONS.map((s) => (
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
      {projects && (
        <div className="card">
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
          {projects.length === 0 && <p className="muted">沒有符合條件的專案。</p>}
        </div>
      )}
    </div>
  );
}
