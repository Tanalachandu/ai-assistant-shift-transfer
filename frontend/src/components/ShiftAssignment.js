import { useEffect, useState } from "react";
import API from "../api";

export default function ShiftAssignment() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));

  useEffect(() => {
    const syncUser = () => {
      setUser(JSON.parse(localStorage.getItem("user") || "null"));
    };
    window.addEventListener("storage", syncUser);
    window.addEventListener("auth-change", syncUser);
    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("auth-change", syncUser);
    };
  }, []);

  const supervisorDisabled = user?.role !== "supervisor";

  const assignShift = async () => {
    if (supervisorDisabled) return;
    try {
      setLoading(true);
      // ✅ Call backend — it now fetches real data (employees + unassigned shifts)
      const res = await API.post("/api/assign");
      setResult(res.data);
    } catch (err) {
      alert("AI assignment failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-4">
      <h3>AI Shift Assignment</h3>
      <button
        onClick={assignShift}
        className="btn btn-success"
        disabled={loading || supervisorDisabled}
      >
        {loading ? "Assigning..." : "Assign Using AI"}
      </button>
      {supervisorDisabled && (
        <p className="text-muted mt-2">Only supervisors can run AI assignments.</p>
      )}

      {result && (
        <div className="mt-4">
          <h5>✅ {result.message}</h5>
          <pre className="bg-light p-3 rounded">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
