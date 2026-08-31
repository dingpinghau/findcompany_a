import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api, canEditDevProjectMaster, canEditProjects, canEditTasks } from "./api";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import DevProjectDetail from "./pages/DevProjectDetail";
import DevProjectNew from "./pages/DevProjectNew";
import DevProjectSearch from "./pages/DevProjectSearch";
import DevProjectsDashboard from "./pages/DevProjectsDashboard";
import HistoryProjects from "./pages/HistoryProjects";
import Login from "./pages/Login";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectNew from "./pages/ProjectNew";
import TaskDetail from "./pages/TaskDetail";
import TaskNew from "./pages/TaskNew";
import TaskSearch from "./pages/TaskSearch";
import TasksDashboard from "./pages/TasksDashboard";
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
        <Route path="/dev-projects" element={<DevProjectsDashboard user={user} />} />
        <Route
          path="/dev-projects/new"
          element={canEditDevProjectMaster(user.role) ? <DevProjectNew /> : <Navigate to="/dev-projects" replace />}
        />
        <Route path="/dev-projects/search" element={<DevProjectSearch />} />
        <Route path="/dev-projects/:id" element={<DevProjectDetail user={user} />} />
        <Route path="/tasks" element={<TasksDashboard user={user} />} />
        <Route
          path="/tasks/new"
          element={canEditTasks(user.role) ? <TaskNew /> : <Navigate to="/tasks" replace />}
        />
        <Route path="/tasks/search" element={<TaskSearch />} />
        <Route path="/tasks/:id" element={<TaskDetail user={user} />} />
        <Route path="/admin/users" element={user.role === "admin" ? <Users /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
