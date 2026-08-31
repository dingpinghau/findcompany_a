import { NavLink, useLocation } from "react-router-dom";
import { api, canEditDevProjectMaster, canEditProjects, canEditTasks } from "../api";
import BrandLogo from "./BrandLogo";

export default function Layout({ user, onLogout, children }) {
  const location = useLocation();
  const handleLogout = async () => {
    await api.logout();
    onLogout();
  };

  const siActive = location.pathname === "/" || location.pathname.startsWith("/projects") || location.pathname.startsWith("/history");
  const projectActive = location.pathname.startsWith("/dev-projects");
  const taskActive = location.pathname.startsWith("/tasks");

  return (
    <div className="app-shell">
      <div className="topnav">
        <div className="topnav-brand-group">
          <BrandLogo />
          <div className="topnav-brand">ICT Management Platform</div>
        </div>
        <div className="topnav-links">
          <div className="topnav-menu">
            <NavLink to="/" className={`topnav-menu-trigger ${siActive ? "active" : ""}`}>
              SI
            </NavLink>
            <div className="topnav-submenu">
              {canEditProjects(user.role) && <NavLink to="/projects/new">建立與維護專案</NavLink>}
              <NavLink to="/history">前期專案查詢</NavLink>
            </div>
          </div>
          <div className="topnav-menu">
            <NavLink to="/dev-projects" className={`topnav-menu-trigger ${projectActive ? "active" : ""}`}>
              Project
            </NavLink>
            <div className="topnav-submenu">
              {canEditDevProjectMaster(user.role) && <NavLink to="/dev-projects/new">新增專案</NavLink>}
              <NavLink to="/dev-projects/search">專案搜尋</NavLink>
            </div>
          </div>
          <div className="topnav-menu">
            <NavLink to="/tasks" className={`topnav-menu-trigger ${taskActive ? "active" : ""}`}>
              Task
            </NavLink>
            <div className="topnav-submenu">
              {canEditTasks(user.role) && <NavLink to="/tasks/new">新增/編輯</NavLink>}
              <NavLink to="/tasks/search">事件搜尋</NavLink>
            </div>
          </div>
          {user.role === "admin" && <NavLink to="/admin/users">帳號管理</NavLink>}
        </div>
        <div className="topnav-user">
          <span className="muted">
            {user.username}（{user.role}）
          </span>
          <button className="link-button" onClick={handleLogout}>
            登出
          </button>
        </div>
      </div>
      <div className="main">{children}</div>
    </div>
  );
}
