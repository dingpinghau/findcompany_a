import { useEffect, useState } from "react";
import { api, ROLE_LABELS, ROLE_OPTIONS } from "../api";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = () => {
    api.listUsers().then(setUsers).catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.createUser({ username, password, role });
      setUsername("");
      setPassword("");
      setRole("user");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setError("");
    try {
      await api.deleteUser(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>帳號管理</h1>
      </div>

      <div className="card">
        <h2>現有帳號</h2>
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>帳號</th>
              <th>權限</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{ROLE_LABELS[u.role] || u.role}</td>
                <td>
                  <button className="btn btn-danger" onClick={() => handleDelete(u.id)}>
                    刪除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <form className="card" onSubmit={handleCreate}>
        <h2>新增帳號</h2>
        <div className="form-grid">
          <div className="field">
            <label>帳號</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="field">
            <label>密碼</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="field">
            <label>權限</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="actions-row">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "新增中..." : "新增帳號"}
          </button>
        </div>
      </form>
    </div>
  );
}
