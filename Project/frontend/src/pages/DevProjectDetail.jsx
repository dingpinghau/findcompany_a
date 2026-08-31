import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  DEV_PROJECT_CATEGORIES,
  DEV_PROJECT_STATUS_OPTIONS,
  api,
  canEditDevProjectMaster,
  canUpdateDevProjectProgress,
} from "../api";
import BackButton from "../components/BackButton";

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("zh-TW", { hour12: false });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ATTACHMENT_CATEGORY_LABELS = { content: "內容說明", benefit: "效益評估", progress: "進度更新" };

function DevStageRow({ devProjectId, stage, onSaved, editable }) {
  const [plannedStart, setPlannedStart] = useState(stage.planned_start_date || "");
  const [plannedEnd, setPlannedEnd] = useState(stage.planned_end_date || "");
  const [actualStart, setActualStart] = useState(stage.actual_start_date || "");
  const [actualEnd, setActualEnd] = useState(stage.actual_end_date || "");
  const [notes, setNotes] = useState(stage.notes || "");
  const [saving, setSaving] = useState(false);

  const dirty =
    plannedStart !== (stage.planned_start_date || "") ||
    plannedEnd !== (stage.planned_end_date || "") ||
    actualStart !== (stage.actual_start_date || "") ||
    actualEnd !== (stage.actual_end_date || "") ||
    notes !== (stage.notes || "");

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateDevProjectStage(devProjectId, stage.id, {
        planned_start_date: plannedStart || null,
        planned_end_date: plannedEnd || null,
        actual_start_date: actualStart || null,
        actual_end_date: actualEnd || null,
        notes: notes || null,
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
        <input type="date" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} disabled={!editable} />
      </td>
      <td className="date-cell">
        <input type="date" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} disabled={!editable} />
      </td>
      <td className="date-cell">
        <input type="date" value={actualStart} onChange={(e) => setActualStart(e.target.value)} disabled={!editable} />
      </td>
      <td className="date-cell">
        <input type="date" value={actualEnd} onChange={(e) => setActualEnd(e.target.value)} disabled={!editable} />
      </td>
      <td className="reason-cell">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="重點說明" disabled={!editable} />
      </td>
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

function DevAttachmentRow({ devProjectId, attachment, isAdmin, onChanged }) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(attachment.filename);
  const [saving, setSaving] = useState(false);

  const handleRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === attachment.filename) {
      setRenaming(false);
      setNewName(attachment.filename);
      return;
    }
    setSaving(true);
    try {
      await api.renameDevProjectAttachment(devProjectId, attachment.id, trimmed);
      setRenaming(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`確定要刪除附件「${attachment.filename}」嗎？此動作無法復原。`)) return;
    await api.deleteDevProjectAttachment(devProjectId, attachment.id);
    onChanged();
  };

  return (
    <tr>
      <td>
        {renaming ? (
          <input value={newName} onChange={(e) => setNewName(e.target.value)} disabled={saving} />
        ) : (
          <a href={`/api/dev-projects/${devProjectId}/attachments/${attachment.id}/download`}>{attachment.filename}</a>
        )}
      </td>
      <td>
        <span className="badge">{ATTACHMENT_CATEGORY_LABELS[attachment.category] || attachment.category}</span>
      </td>
      <td>{formatFileSize(attachment.size_bytes)}</td>
      <td>{formatDateTime(attachment.uploaded_at)}</td>
      <td>{attachment.uploaded_by || "-"}</td>
      <td>
        {isAdmin &&
          (renaming ? (
            <>
              <button className="btn" disabled={saving} onClick={handleRename}>
                {saving ? "儲存中..." : "儲存"}
              </button>
              <button
                type="button"
                className="btn"
                disabled={saving}
                onClick={() => {
                  setRenaming(false);
                  setNewName(attachment.filename);
                }}
              >
                取消
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn" onClick={() => setRenaming(true)}>
                編輯
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                刪除
              </button>
            </>
          ))}
      </td>
    </tr>
  );
}

function DevHistoryEntryRow({ entry, canDelete, selected, onToggleSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="history-entry">
      <button type="button" className="history-entry-header" onClick={() => setOpen(!open)}>
        <span className="history-entry-meta">
          {canDelete && (
            <input
              type="checkbox"
              checked={selected}
              onClick={(e) => e.stopPropagation()}
              onChange={() => onToggleSelect(entry.id)}
            />
          )}
          <span className="history-entry-date">{formatDateTime(entry.changed_at)}</span>
          <span className="history-entry-summary">{entry.summary}</span>
          {entry.changed_by && <span className="history-entry-by">by {entry.changed_by}</span>}
        </span>
        <span>{open ? "收合 ▲" : "查看異動 ▼"}</span>
      </button>
      {open && (
        <div className="history-entry-details">
          {entry.changes.length === 0 ? (
            <p className="history-empty">無欄位異動明細。</p>
          ) : (
            entry.changes.map((c, i) => (
              <div className="history-change-row" key={i}>
                <span>{c.label}</span>
                <span className="history-change-old">{c.old ?? "（空白）"}</span>
                <span className="arrow">→</span>
                <span className="history-change-new">{c.new ?? "（空白）"}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function DevProjectDetail({ user }) {
  const { id } = useParams();
  const editableMaster = canEditDevProjectMaster(user.role);
  const editableProgress = canUpdateDevProjectProgress(user.role);
  const isAdmin = user.role === "admin";

  const [project, setProject] = useState(null);
  const [form, setForm] = useState(null);
  const [statusValue, setStatusValue] = useState("");
  const [history, setHistory] = useState(null);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState([]);
  const [deletingHistory, setDeletingHistory] = useState(false);
  const [attachments, setAttachments] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadCategory, setUploadCategory] = useState("content");
  const [uploadStageId, setUploadStageId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [error, setError] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const loadHistory = () => {
    api
      .getDevProjectHistory(id)
      .then((h) => {
        setHistory(h);
        setSelectedHistoryIds([]);
      })
      .catch((err) => setError(err.message));
  };

  const loadAttachments = () => {
    api.listDevProjectAttachments(id).then(setAttachments).catch((err) => setError(err.message));
  };

  const toggleHistorySelect = (historyId) => {
    setSelectedHistoryIds((ids) => (ids.includes(historyId) ? ids.filter((x) => x !== historyId) : [...ids, historyId]));
  };

  const handleDeleteSelectedHistory = async () => {
    if (selectedHistoryIds.length === 0) return;
    if (!confirm(`確定要刪除選取的 ${selectedHistoryIds.length} 筆歷程紀錄嗎？此動作無法復原。`)) return;
    setDeletingHistory(true);
    try {
      await Promise.all(selectedHistoryIds.map((historyId) => api.deleteDevProjectHistory(project.id, historyId)));
      loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingHistory(false);
    }
  };

  const handleUploadFile = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploadError("");
    setUploading(true);
    try {
      await api.uploadDevProjectAttachment(project.id, uploadFile, uploadCategory, uploadStageId || null);
      setUploadFile(null);
      loadAttachments();
      loadHistory();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const load = () => {
    api
      .getDevProject(id)
      .then((p) => {
        setProject(p);
        setStatusValue(p.status);
        setForm({
          name: p.name,
          category: p.category,
          content_description: p.content_description || "",
          benefit_assessment: p.benefit_assessment || "",
          pm_name: p.pm_name || "",
          tpm_name: p.tpm_name || "",
          tpm_department: p.tpm_department || "",
          claude_team_link: p.claude_team_link || "",
          established_date: p.established_date || "",
        });
      })
      .catch((err) => setError(err.message));
    loadHistory();
    loadAttachments();
  };

  useEffect(load, [id]);

  if (error) return <p className="error-text">{error}</p>;
  if (!project || !form || !history || !attachments) return null;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleStageSaved = (updatedStage) => {
    setProject({
      ...project,
      stages: project.stages.map((s) => (s.id === updatedStage.id ? updatedStage : s)),
    });
    loadHistory();
  };

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    if (!editableMaster) return;
    setSavingInfo(true);
    setSavedMsg("");
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
      };
      const updated = await api.updateDevProject(project.id, payload);
      setProject(updated);
      setSavedMsg("已儲存");
      loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingInfo(false);
    }
  };

  const handleSaveStatus = async (e) => {
    e.preventDefault();
    if (!editableProgress) return;
    setSavingStatus(true);
    setStatusMsg("");
    try {
      const updated = await api.updateDevProject(project.id, { status: statusValue });
      setProject(updated);
      setStatusMsg("已儲存");
      loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div>
      <BackButton />
      <div className="page-header">
        <h1>{project.name}</h1>
        <span className="badge">{project.status}</span>
      </div>

      <form className="card" onSubmit={handleSaveInfo}>
        <h2>基本資料</h2>
        <div className="form-grid">
          <div className="field span-2">
            <label>專案名稱</label>
            <input value={form.name} onChange={set("name")} required disabled={!editableMaster} />
          </div>
          <div className="field">
            <label>類別</label>
            <select value={form.category} onChange={set("category")} disabled={!editableMaster}>
              {DEV_PROJECT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>立案時間</label>
            <input type="date" value={form.established_date} onChange={set("established_date")} disabled={!editableMaster} />
          </div>
          <div className="field">
            <label>負責PM</label>
            <input value={form.pm_name} onChange={set("pm_name")} disabled={!editableMaster} />
          </div>
          <div className="field">
            <label>負責TPM</label>
            <input value={form.tpm_name} onChange={set("tpm_name")} placeholder="姓名" disabled={!editableMaster} />
          </div>
          <div className="field">
            <label>TPM部門</label>
            <input value={form.tpm_department} onChange={set("tpm_department")} disabled={!editableMaster} />
          </div>
          <div className="field">
            <label>Claude team link</label>
            {editableMaster ? (
              <input value={form.claude_team_link} onChange={set("claude_team_link")} placeholder="https://..." />
            ) : form.claude_team_link ? (
              <a href={form.claude_team_link} target="_blank" rel="noreferrer">
                {form.claude_team_link}
              </a>
            ) : (
              <input value="-" disabled />
            )}
          </div>
          <div className="field span-2">
            <label>內容說明</label>
            <textarea value={form.content_description} onChange={set("content_description")} disabled={!editableMaster} />
          </div>
          <div className="field span-2">
            <label>效益評估</label>
            <textarea value={form.benefit_assessment} onChange={set("benefit_assessment")} disabled={!editableMaster} />
          </div>
        </div>
        {editableMaster && (
          <div className="actions-row">
            <button className="btn btn-primary" type="submit" disabled={savingInfo}>
              {savingInfo ? "儲存中..." : "儲存基本資料"}
            </button>
            {savedMsg && <span className="muted">{savedMsg}</span>}
          </div>
        )}
      </form>

      <form className="card" onSubmit={handleSaveStatus}>
        <h2>目前狀態</h2>
        <div className="form-grid">
          <div className="field">
            <label>狀態</label>
            <select value={statusValue} onChange={(e) => setStatusValue(e.target.value)} disabled={!editableProgress}>
              {DEV_PROJECT_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        {editableProgress && (
          <div className="actions-row">
            <button className="btn btn-primary" type="submit" disabled={savingStatus || statusValue === project.status}>
              {savingStatus ? "儲存中..." : "更新狀態"}
            </button>
            {statusMsg && <span className="muted">{statusMsg}</span>}
          </div>
        )}
      </form>

      <div className="card">
        <h2>各階段時程（專案進度更新）</h2>
        <div className="table-scroll">
          <table className="stage-table">
            <thead>
              <tr>
                <th>階段</th>
                <th>表定開始日</th>
                <th>表定結束日</th>
                <th>實際開始日</th>
                <th>實際結束日</th>
                <th>重點說明</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {project.stages
                .slice()
                .sort((a, b) => a.sequence - b.sequence)
                .map((stage) => (
                  <DevStageRow
                    key={`${stage.id}-${stage.planned_start_date}-${stage.planned_end_date}-${stage.actual_start_date}-${stage.actual_end_date}-${stage.notes}`}
                    devProjectId={project.id}
                    stage={stage}
                    onSaved={handleStageSaved}
                    editable={editableProgress}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>附件</h2>
        {editableProgress && (
          <form className="actions-row" onSubmit={handleUploadFile}>
            <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
              <option value="content">內容說明</option>
              <option value="benefit">效益評估</option>
              <option value="progress">進度更新</option>
            </select>
            {uploadCategory === "progress" && (
              <select value={uploadStageId} onChange={(e) => setUploadStageId(e.target.value)}>
                <option value="">（不指定階段）</option>
                {project.stages
                  .slice()
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.stage_name}
                    </option>
                  ))}
              </select>
            )}
            <input type="file" onChange={(e) => setUploadFile(e.target.files[0] || null)} disabled={uploading} />
            <button className="btn" type="submit" disabled={!uploadFile || uploading}>
              {uploading ? "上傳中..." : "上傳"}
            </button>
          </form>
        )}
        {uploadError && <p className="error-text">{uploadError}</p>}
        {attachments.length === 0 ? (
          <p className="history-empty">目前沒有附件。</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>檔名</th>
                  <th>分類</th>
                  <th>大小</th>
                  <th>上傳時間</th>
                  <th>上傳者</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {attachments.map((a) => (
                  <DevAttachmentRow
                    key={a.id}
                    devProjectId={project.id}
                    attachment={a}
                    isAdmin={isAdmin}
                    onChanged={() => {
                      loadAttachments();
                      loadHistory();
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>專案歷程</h2>
        {history.length === 0 ? (
          <p className="history-empty">目前沒有歷程紀錄。</p>
        ) : (
          <>
            {isAdmin && (
              <div className="actions-row">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeleteSelectedHistory}
                  disabled={selectedHistoryIds.length === 0 || deletingHistory}
                >
                  {deletingHistory ? "刪除中..." : `刪除已選取紀錄 (${selectedHistoryIds.length})`}
                </button>
              </div>
            )}
            <div className="history-list">
              {history.map((entry) => (
                <DevHistoryEntryRow
                  key={entry.id}
                  entry={entry}
                  canDelete={isAdmin}
                  selected={selectedHistoryIds.includes(entry.id)}
                  onToggleSelect={toggleHistorySelect}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
