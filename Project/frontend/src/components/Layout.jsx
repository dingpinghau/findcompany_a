import { NavLink } from "react-router-dom";
import { api, canEditProjects } from "../api";
import BrandLogo from "./BrandLogo";

export default function Layout({ user, onLogout, children }) {
  const handleLogout = async () => {
    await api.logout();
    onLogout();
  };

  return (
    <div className="app-shell">
      <div className="topnav">
        <div className="topnav-brand-group">
          <BrandLogo />
          <div className="topnav-brand">ICT Major SI Project Management Platform</div>
        </div>
        <div className="topnav-links">
          <NavLink to="/" end>
            首頁
          </NavLink>
          {canEditProjects(user.role) && <NavLink to="/projects/new">建立與維護專案</NavLink>}
          <NavLink to="/history">前期專案查詢</NavLink>
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
