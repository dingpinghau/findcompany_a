import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, canEditProjects, STATUS_OPTIONS } from "../api";
import MoneyInput from "../components/MoneyInput";

const money = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 });

function formatMoney(value) {
  if (value === null || value === undefined) return "-";
  return `NT$ ${money.format(value)}`;
}

function StageRow({ projectId, stage, onSaved, editable }) {
  const [plannedDate, setPlannedDate] = useState(stage.planned_date || "");
  const [actualDate, setActualDate] = useState(stage.actual_date || "");
  const [reason, setReason] = useState(stage.overdue_reason || "");
  const [saving, setSaving] = useState(false);

  const dirty =
    plannedDate !== (stage.planned_date || "") ||
    actualDate !== (stage.actual_date || "") ||
    reason !== (stage.overdue_reason || "");

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateStage(projectId, stage.id, {
        planned_date: plannedDate || null,
        actual_date: actualDate || null,
        overdue_reason: reason || null,
      });
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td>{stage.stage_name}</td>
      <td className="date-cell">
        <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} disabled={!editable} />
      </td>
      <td className="date-cell">
        <input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} disabled={!editable} />
      </td>
      <td className="reason-cell">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="逾期原因 / 備註"
          disabled={!editable}
        />
      </td>
      <td>{stage.is_overdue ? <span className="badge overdue">逾期</span> : "-"}</td>
      <td>
        {editable && (
          <button className="btn" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? "儲存中..." : "儲存"}
          </button>
        )}
      </td>
    </tr>
  );
}

export default function ProjectDetail({ user }) {
  const { id } = useParams();
  const editable = canEditProjects(user.role);
  const [project, setProject] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const load = () => {
    api
      .getProject(id)
      .then((p) => {
        setProject(p);
        setForm({
          name: p.name,
          business_unit: p.business_unit || "",
          sales_rep: p.sales_rep || "",
          status: p.status,
          budget_amount: p.budget_amount ?? "",
          estimated_bid_amount: p.estimated_bid_amount ?? "",
          estimated_cost: p.estimated_cost ?? "",
          no_go_reason: p.no_go_reason || "",
          progress_notes: p.progress_notes || "",
        });
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [id]);

  if (error) return <p className="error-text">{error}</p>;
  if (!project || !form) return null;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleStageSaved = (updatedStage) => {
    setProject({
      ...project,
      stages: project.stages.map((s) => (s.id === updatedStage.id ? updatedStage : s)),
    });
  };

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    if (!editable) return;
    setSavingInfo(true);
    setSavedMsg("");
    try {
      const payload = {
        ...form,
        budget_amount: form.budget_amount === "" ? null : Number(form.budget_amount),
        estimated_bid_amount: form.estimated_bid_amount === "" ? null : Number(form.estimated_bid_amount),
        estimated_cost: form.estimated_cost === "" ? null : Number(form.estimated_cost),
        business_unit: form.business_unit || null,
        sales_rep: form.sales_rep || null,
        no_go_reason: form.no_go_reason || null,
        progress_notes: form.progress_notes || null,
      };
      const updated = await api.updateProject(project.id, payload);
      setProject(updated);
      setSavedMsg("已儲存");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingInfo(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>{project.name}</h1>
        {project.is_overdue && <span className="badge overdue">有關卡逾期</span>}
      </div>

      <form className="card" onSubmit={handleSaveInfo}>
        <h2>基本資料</h2>
        <div className="form-grid">
          <div className="field span-2">
            <label>案名</label>
            <input value={form.name} onChange={set("name")} required disabled={!editable} />
          </div>
          <div className="field">
            <label>業務處</label>
            <input value={form.business_unit} onChange={set("business_unit")} disabled={!editable} />
          </div>
          <div className="field">
            <label>業務人員</label>
            <input value={form.sales_rep} onChange={set("sales_rep")} disabled={!editable} />
          </div>
          <div className="field">
            <label>狀態</label>
            <select value={form.status} onChange={set("status")} disabled={!editable}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>投標日（依「投標」關卡）</label>
            <input value={project.bid_date || "-"} disabled />
          </div>
          <div className="field">
            <label>預算金額（含稅）</label>
            <MoneyInput
              value={form.budget_amount}
              onChange={(v) => setForm({ ...form, budget_amount: v })}
              disabled={!editable}
            />
          </div>
          <div className="field">
            <label>預計投標金額（含稅）</label>
            <MoneyInput
              value={form.estimated_bid_amount}
              onChange={(v) => setForm({ ...form, estimated_bid_amount: v })}
              disabled={!editable}
            />
          </div>
          <div className="field">
            <label>預計成本（含稅）</label>
            <MoneyInput
              value={form.estimated_cost}
              onChange={(v) => setForm({ ...form, estimated_cost: v })}
              disabled={!editable}
            />
          </div>
          {form.status === "NO-GO" && (
            <div className="field span-2">
              <label>No Go 原因</label>
              <input value={form.no_go_reason} onChange={set("no_go_reason")} disabled={!editable} />
            </div>
          )}
          <div className="field span-2">
            <label>進度說明</label>
            <textarea value={form.progress_notes} onChange={set("progress_notes")} disabled={!editable} />
          </div>
        </div>
        {editable && (
          <div className="actions-row">
            <button className="btn btn-primary" type="submit" disabled={savingInfo}>
              {savingInfo ? "儲存中..." : "儲存基本資料"}
            </button>
            {savedMsg && <span className="muted">{savedMsg}</span>}
          </div>
        )}
        <p className="muted" style={{ marginTop: 12 }}>
          預算金額：{formatMoney(project.budget_amount)} ／ 預計投標金額：{formatMoney(project.estimated_bid_amount)} ／
          預計成本：{formatMoney(project.estimated_cost)}
        </p>
      </form>

      <div className="card">
        <h2>各階段時程</h2>
        <div className="table-scroll">
        <table className="stage-table">
          <thead>
            <tr>
              <th>關卡</th>
              <th>表定日</th>
              <th>實際日</th>
              <th>逾期原因 / 備註</th>
              <th>逾期</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {project.stages
              .slice()
              .sort((a, b) => a.sequence - b.sequence)
              .map((stage) => (
                <StageRow
                  key={stage.id}
                  projectId={project.id}
                  stage={stage}
                  onSaved={handleStageSaved}
                  editable={editable}
                />
              ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
