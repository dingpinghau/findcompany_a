import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEV_PROJECT_CATEGORIES, api } from "../api";
import BackButton from "../components/BackButton";

const STAGE_DEFINITIONS = [
  { stage_key: "planning", stage_name: "規劃" },
  { stage_key: "frontend_dev", stage_name: "前端開發" },
  { stage_key: "backend_dev", stage_name: "後端開發" },
  { stage_key: "testing", stage_name: "測試" },
  { stage_key: "pending_launch", stage_name: "預估上線" },
];

const emptyStagePlans = Object.fromEntries(
  STAGE_DEFINITIONS.map((s) => [s.stage_key, { planned_start_date: "", planned_end_date: "" }])
);

const empty = {
  name: "",
  category: DEV_PROJECT_CATEGORIES[0],
  content_description: "",
  benefit_assessment: "",
  pm_name: "",
  tpm_name: "",
  tpm_department: "",
  claude_team_link: "",
  established_date: "",
};

export default function DevProjectNew() {
  const [form, setForm] = useState(empty);
  const [stagePlans, setStagePlans] = useState(emptyStagePlans);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const setStagePlan = (stageKey, field) => (e) =>
    setStagePlans({ ...stagePlans, [stageKey]: { ...stagePlans[stageKey], [field]: e.target.value } });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        ...form,
        content_description: form.content_description || null,
        benefit_assessment: form.benefit_assessment || null,
        pm_name: form.pm_name || null,
        tpm_name: form.tpm_name || null,
        tpm_department: form.tpm_department || null,
        claude_team_link: form.claude_team_link || null,
        established_date: form.established_date || null,
        stages: STAGE_DEFINITIONS.map((s) => ({
          stage_key: s.stage_key,
          planned_start_date: stagePlans[s.stage_key].planned_start_date || null,
          planned_end_date: stagePlans[s.stage_key].planned_end_date || null,
        })),
      };
      const project = await api.createDevProject(payload);
      navigate(`/dev-projects/${project.id}`);
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
        <h1>新增專案</h1>
      </div>
      <form className="card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field span-2">
            <label>專案名稱</label>
            <input value={form.name} onChange={set("name")} required />
          </div>
          <div className="field">
            <label>類別</label>
            <select value={form.category} onChange={set("category")}>
              {DEV_PROJECT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>立案時間</label>
            <input type="date" value={form.established_date} onChange={set("established_date")} />
          </div>
          <div className="field">
            <label>負責PM</label>
            <input value={form.pm_name} onChange={set("pm_name")} />
          </div>
          <div className="field">
            <label>負責TPM</label>
            <input value={form.tpm_name} onChange={set("tpm_name")} placeholder="姓名" />
          </div>
          <div className="field">
            <label>TPM部門</label>
            <input value={form.tpm_department} onChange={set("tpm_department")} />
          </div>
          <div className="field">
            <label>Claude team link</label>
            <input value={form.claude_team_link} onChange={set("claude_team_link")} placeholder="https://..." />
          </div>
          <div className="field span-2">
            <label>內容說明</label>
            <textarea value={form.content_description} onChange={set("content_description")} />
          </div>
          <div className="field span-2">
            <label>效益評估</label>
            <textarea value={form.benefit_assessment} onChange={set("benefit_assessment")} />
          </div>
        </div>

        <h2 style={{ marginTop: 24 }}>專案時程</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>階段</th>
                <th>表定開始日</th>
                <th>表定結束日</th>
              </tr>
            </thead>
            <tbody>
              {STAGE_DEFINITIONS.map((s) => (
                <tr key={s.stage_key}>
                  <td>{s.stage_name}</td>
                  <td className="date-cell">
                    <input
                      type="date"
                      value={stagePlans[s.stage_key].planned_start_date}
                      onChange={setStagePlan(s.stage_key, "planned_start_date")}
                    />
                  </td>
                  <td className="date-cell">
                    <input
                      type="date"
                      value={stagePlans[s.stage_key].planned_end_date}
                      onChange={setStagePlan(s.stage_key, "planned_end_date")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p className="error-text">{error}</p>}
        <div className="actions-row">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "建立中..." : "建立專案"}
          </button>
        </div>
      </form>
      <p className="muted">建立後，可在專案詳細頁上傳內容說明/效益評估文件，並開始進行專案進度更新。</p>
    </div>
  );
}
