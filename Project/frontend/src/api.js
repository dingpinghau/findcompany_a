const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: options.body instanceof FormData ? undefined : options.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event("app:unauthorized"));
    throw new Error("未登入");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `請求失敗 (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (username, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),

  listProjects: () => request("/projects"),
  createProject: (payload) => request("/projects", { method: "POST", body: JSON.stringify(payload) }),
  getProject: (id) => request(`/projects/${id}`),
  updateProject: (id, payload) => request(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  updateStage: (projectId, stageId, payload) =>
    request(`/projects/${projectId}/stages/${stageId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  getProjectHistory: (id) => request(`/projects/${id}/history`),
  deleteProjectHistory: (projectId, historyId) =>
    request(`/projects/${projectId}/history/${historyId}`, { method: "DELETE" }),

  listAttachments: (projectId) => request(`/projects/${projectId}/attachments`),
  uploadAttachment: (projectId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/projects/${projectId}/attachments`, { method: "POST", body: formData });
  },
  renameAttachment: (projectId, attachmentId, filename) =>
    request(`/projects/${projectId}/attachments/${attachmentId}`, {
      method: "PATCH",
      body: JSON.stringify({ filename }),
    }),
  deleteAttachment: (projectId, attachmentId) =>
    request(`/projects/${projectId}/attachments/${attachmentId}`, { method: "DELETE" }),

  dashboardSummary: () => request("/dashboard/summary"),

  listUsers: () => request("/users"),
  createUser: (payload) => request("/users", { method: "POST", body: JSON.stringify(payload) }),
  deleteUser: (id) => request(`/users/${id}`, { method: "DELETE" }),
};

export const STATUS_OPTIONS = ["待公告", "公開徵求", "進行中", "已得標", "已流標", "NO-GO", "已結案"];
export const CLOSED_STATUSES = ["已流標", "NO-GO", "已結案"];

export const ROLE_OPTIONS = ["admin", "poweruser", "user"];
export const ROLE_LABELS = { admin: "管理員 (admin)", poweruser: "進階使用者 (poweruser)", user: "一般使用者 (user)" };
const PROJECT_EDIT_ROLES = ["admin", "poweruser"];
export const canEditProjects = (role) => PROJECT_EDIT_ROLES.includes(role);

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".png", ".jpg", ".jpeg", ".gif", ".zip", ".rar", ".7z", ".txt",
];
export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
