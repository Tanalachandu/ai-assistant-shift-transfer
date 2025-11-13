import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Shifts from "./pages/Shifts";
import SupervisorPanel from "./pages/SupervisorPanel";
import Analytics from "./pages/Analytics";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AuditLogs from "./pages/AuditLogs";
import Toaster from "./components/Toaster";

function ProtectedRoute({ children, requireSupervisor = false, user }) {
  if (!user) return <Navigate to="/login" replace />;
  if (requireSupervisor && user.role !== "supervisor") return <Navigate to="/" replace />;
  return children;
}

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));

  const syncUser = useCallback(() => {
    const stored = JSON.parse(localStorage.getItem("user") || "null");
    setUser(stored);
  }, []);

  useEffect(() => {
    window.addEventListener("storage", syncUser);
    window.addEventListener("auth-change", syncUser);
    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("auth-change", syncUser);
    };
  }, [syncUser]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth-change"));
    window.location.href = "/login";
  };

  const isSupervisor = user?.role === "supervisor";

  return (
    <BrowserRouter>
      <Toaster />
      <nav className="navbar navbar-expand-lg px-3 dark-navbar">
        <Link className="navbar-brand" to="/">
          <span className="brand-gradient">Shift AI</span>
        </Link>
        {user && (
          <div className="navbar-nav me-auto">
            <NavLink className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} to="/">
              Employees
            </NavLink>
            <NavLink className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} to="/shifts">
              Shifts
            </NavLink>
            {isSupervisor && (
              <>
                <NavLink className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} to="/supervisor">
                  Supervisor
                </NavLink>
                <NavLink className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} to="/analytics">
                  Analytics
                </NavLink>
                <NavLink className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} to="/audit-logs">
                  Audit Logs
                </NavLink>
              </>
            )}
          </div>
        )}
        <div className="navbar-nav ms-auto">
          {!user ? (
            <>
              <Link className="nav-link" to="/login">
                Login
              </Link>
              <Link className="nav-link" to="/register">
                Register
              </Link>
            </>
          ) : (
            <>
              <span className="nav-link">Hello, {user.name}</span>
              <button
                type="button"
                className="btn btn-link nav-link"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          )}
        </div>
      </nav>

      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute user={user}>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shifts"
          element={
            <ProtectedRoute user={user}>
              <Shifts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor"
          element={
            <ProtectedRoute requireSupervisor user={user}>
              <SupervisorPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute requireSupervisor user={user}>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute requireSupervisor user={user}>
              <AuditLogs />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
