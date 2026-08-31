import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TASK_STATUS_OPTIONS, api } from "../api";
import BackButton from "../components/BackButton";

const empty = {
  name: "",
  start_date: "",
  end_date: "",
  owner: "",
  partner_unit: "",
  partner_action: "",
  status: TASK_STATUS_OPTIONS[0],
};

export default function TaskNew() {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        ...form,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        owner: form.owner || null,
        partner_unit: form.partner_unit || null,
        partner_action: form.partner_action || null,
      };
      const task = await api.createTask(payload);
      navigate(`/tasks/${task.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <BackButton />
      <div className="page-header">
        <h1>新增Task</h1>
      </div>
      <form className="card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field span-2">
            <label>Task名稱</label>
            <input value={form.name} onChange={set("name")} required />
          </div>
          <div className="field">
            <label>開始時間</label>
            <input type="date" value={form.start_date} onChange={set("start_date")} />
          </div>
          <div className="field">
            <label>結束時間</label>
            <input type="date" value={form.end_date} onChange={set("end_date")} />
          </div>
          <div className="field">
            <label>負責人</label>
            <input value={form.owner} onChange={set("owner")} />
          </div>
          <div className="field">
            <label>協力單位</label>
            <input value={form.partner_unit} onChange={set("partner_unit")} />
          </div>
          <div className="field">
            <label>狀態</label>
            <select value={form.status} onChange={set("status")}>
              {TASK_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field span-2">
            <label>協力單位需要配合執行事項</label>
            <textarea value={form.partner_action} onChange={set("partner_action")} />
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="actions-row">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "建立中..." : "建立Task"}
          </button>
        </div>
      </form>
    </div>
  );
}
