import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, STATUS_OPTIONS } from "../api";
import BackButton from "../components/BackButton";
import MoneyInput from "../components/MoneyInput";

const empty = {
  name: "",
  business_unit: "",
  sales_rep: "",
  status: "待公告",
  budget_amount: "",
  estimated_bid_amount: "",
  estimated_cost: "",
  bid_date: "",
  progress_notes: "",
};

function toPayload(form) {
  return {
    ...form,
    budget_amount: form.budget_amount === "" ? null : form.budget_amount,
    estimated_bid_amount: form.estimated_bid_amount === "" ? null : form.estimated_bid_amount,
    estimated_cost: form.estimated_cost === "" ? null : form.estimated_cost,
    business_unit: form.business_unit || null,
    sales_rep: form.sales_rep || null,
    progress_notes: form.progress_notes || null,
  };
}

export default function ProjectNew() {
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
      const project = await api.createProject(toPayload(form));
      navigate(`/projects/${project.id}`);
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
        <h1>建立新專案</h1>
      </div>
      <form className="card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field span-2">
            <label>案名</label>
            <input value={form.name} onChange={set("name")} required />
          </div>
          <div className="field">
            <label>業務處</label>
            <input value={form.business_unit} onChange={set("business_unit")} />
          </div>
          <div className="field">
            <label>業務人員</label>
            <input value={form.sales_rep} onChange={set("sales_rep")} />
          </div>
          <div className="field">
            <label>狀態</label>
            <select value={form.status} onChange={set("status")}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>投標日</label>
            <input type="date" value={form.bid_date} onChange={set("bid_date")} required />
          </div>
          <div className="field">
            <label>預算金額（含稅）</label>
            <MoneyInput value={form.budget_amount} onChange={(v) => setForm({ ...form, budget_amount: v })} />
          </div>
          <div className="field">
            <label>預計投標金額（含稅）</label>
            <MoneyInput
              value={form.estimated_bid_amount}
              onChange={(v) => setForm({ ...form, estimated_bid_amount: v })}
            />
          </div>
          <div className="field">
            <label>預計成本（含稅）</label>
            <MoneyInput value={form.estimated_cost} onChange={(v) => setForm({ ...form, estimated_cost: v })} />
          </div>
          <div className="field span-2">
            <label>進度說明</label>
            <textarea value={form.progress_notes} onChange={set("progress_notes")} />
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="actions-row">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "建立中..." : "建立專案"}
          </button>
        </div>
      </form>
      <p className="muted">
        建立後，系統會依投標日自動算出 8 個關卡（領標、建案會議…）的表定日，可在專案細節頁調整並填寫實際完成日。
      </p>
    </div>
  );
}
