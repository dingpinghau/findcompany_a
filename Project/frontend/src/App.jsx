import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api, canEditProjects } from "./api";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import HistoryProjects from "./pages/HistoryProjects";
import Login from "./pages/Login";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectNew from "./pages/ProjectNew";
import Users from "./pages/Users";

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("app:unauthorized", onUnauthorized);
    return () => window.removeEventListener("app:unauthorized", onUnauthorized);
  }, []);

  if (user === undefined) return null;

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Layout user={user} onLogout={() => setUser(null)}>
      <Routes>
        <Route path="/" element={<Dashboard user={user} />} />
        <Route
          path="/projects/new"
          element={canEditProjects(user.role) ? <ProjectNew /> : <Navigate to="/" replace />}
        />
        <Route path="/projects/:id" element={<ProjectDetail user={user} />} />
        <Route path="/history" element={<HistoryProjects />} />
        <Route path="/admin/users" element={user.role === "admin" ? <Users /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
