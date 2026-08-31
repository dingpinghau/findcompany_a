import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { TASK_STATUS_OPTIONS, api, canEditTasks } from "../api";
import BackButton from "../components/BackButton";

function formatDaysRemaining(days) {
  if (days === null || days === undefined) return "-";
  if (days < 0) return `已逾期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天到期";
  return `${days} 天`;
}

export default function TaskDetail({ user }) {
  const { id } = useParams();
  const editable = canEditTasks(user.role);
  const [task, setTask] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const load = () => {
    api
      .getTask(id)
      .then((t) => {
        setTask(t);
        setForm({
          name: t.name,
          start_date: t.start_date || "",
          end_date: t.end_date || "",
          owner: t.owner || "",
          partner_unit: t.partner_unit || "",
          partner_action: t.partner_action || "",
          status: t.status,
        });
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [id]);

  if (error) return <p className="error-text">{error}</p>;
  if (!task || !form) return null;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editable) return;
    setSaving(true);
    setSavedMsg("");
    try {
      const payload = {
        ...form,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        owner: form.owner || null,
        partner_unit: form.partner_unit || null,
        partner_action: form.partner_action || null,
      };
      const updated = await api.updateTask(task.id, payload);
      setTask(updated);
      setSavedMsg("已儲存");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <BackButton />
      <div className="page-header">
        <h1>{task.name}</h1>
        <span className="badge">{task.status}</span>
      </div>

      <form className="card" onSubmit={handleSave}>
        <h2>Task 資料</h2>
        <div className="form-grid">
          <div className="field span-2">
            <label>Task名稱</label>
            <input value={form.name} onChange={set("name")} required disabled={!editable} />
          </div>
          <div className="field">
            <label>開始時間</label>
            <input type="date" value={form.start_date} onChange={set("start_date")} disabled={!editable} />
          </div>
          <div className="field">
            <label>結束時間</label>
            <input type="date" value={form.end_date} onChange={set("end_date")} disabled={!editable} />
          </div>
          <div className="field">
            <label>負責人</label>
            <input value={form.owner} onChange={set("owner")} disabled={!editable} />
          </div>
          <div className="field">
            <label>協力單位</label>
            <input value={form.partner_unit} onChange={set("partner_unit")} disabled={!editable} />
          </div>
          <div className="field">
            <label>狀態</label>
            <select value={form.status} onChange={set("status")} disabled={!editable}>
              {TASK_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>剩餘天數</label>
            <input value={formatDaysRemaining(task.days_remaining)} disabled />
          </div>
          <div className="field span-2">
            <label>協力單位需要配合執行事項</label>
            <textarea value={form.partner_action} onChange={set("partner_action")} disabled={!editable} />
          </div>
        </div>
        {editable && (
          <div className="actions-row">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "儲存中..." : "儲存"}
            </button>
            {savedMsg && <span className="muted">{savedMsg}</span>}
          </div>
        )}
      </form>
    </div>
  );
}
