import { useEffect, useState } from "react";
import API from "../api";
import { toast } from "../components/Toaster";

export default function SupervisorPanel() {
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState([]);
  // Audit logs removed from Supervisor view

  useEffect(() => {
    const fetchData = async () => {
      const [shiftRes, empRes, issuesRes] = await Promise.all([
        API.get("/api/assigned-shifts"),
        API.get("/api/employees"),
        API.get("/api/monitor/issues"),
      ]);
      setShifts(shiftRes.data);
      setEmployees(empRes.data);
      setIssues(issuesRes.data);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleOverride = async (shiftId, newEmpId) => {
    if (!newEmpId) return;
    const confirm = window.confirm("Are you sure you want to reassign this shift?");
    if (!confirm) return;

    await API.post("/api/override-shift", { shiftId, newEmployeeId: newEmpId });
    toast("Shift reassigned", "success");
    const updated = await API.get("/api/assigned-shifts");
    setShifts(updated.data);
  };

  const getUrgencyColor = (urgency) => {
    if (urgency >= 0.8) return "bg-danger text-white"; // High urgency
    if (urgency >= 0.5) return "bg-warning"; // Medium urgency
    return "bg-success text-white"; // Low urgency
  };

  if (loading) return <div className="p-3">Loading supervisor data...</div>;

  return (
    <div className="container mt-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="mb-0">🧑‍💼 Supervisor Overrides</h2>
        <span className="text-muted">{shifts.length} assigned • {issues.length} issues</span>
      </div>

      <div className="card shadow-sm p-3">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h5 className="mb-0 text-primary">Active Shift Assignments</h5>
          <button className="btn btn-outline-secondary btn-sm" onClick={async()=>{
            const updated = await API.get("/api/assigned-shifts");
            setShifts(updated.data);
          }}>Refresh</button>
        </div>

        {shifts.length === 0 ? (
          <div className="empty-state">No assigned shifts found.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-dark table-striped table-hover align-middle mb-0">
              <thead className="table-dark">
                <tr>
                  <th>Date</th>
                  <th>Urgency</th>
                  <th>Current Employee</th>
                  <th>Reassign To</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s._id}>
                    <td>{s.date ? s.date.slice(0, 10) : "—"}</td>
                    <td>
                      <span
                        className={`badge ${
                          s.urgency >= 0.8 ? 'text-bg-danger' : s.urgency >= 0.5 ? 'text-bg-warning text-dark' : 'text-bg-success'
                        }`}
                      >
                        {Number(s.urgency).toFixed(2)}
                      </span>
                    </td>
                    <td>{s.assignedTo?.name || "Unassigned"}</td>
                    <td>
                      <select
                        className="form-select"
                        onChange={(e) => handleOverride(s._id, e.target.value)}
                        defaultValue=""
                      >
                        <option value="">Select Employee</option>
                        {employees.map((e) => (
                          <option key={e._id} value={e._id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card shadow-sm p-3 mt-4">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h5 className="mb-0 text-danger">Open Issues</h5>
          <button className="btn btn-outline-secondary btn-sm" onClick={async()=>{
            const res = await API.get("/api/monitor/issues");
            setIssues(res.data);
          }}>Refresh</button>
        </div>
        {issues.length === 0 ? (
          <div className="empty-state">No open issues.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-dark table-striped table-hover align-middle mb-0">
              <thead className="table-dark">
                <tr>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Message</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((i) => (
                  <tr key={i._id}>
                    <td>{i.type}</td>
                    <td>
                      <span className={`badge ${i.severity === 'high' ? 'text-bg-danger' : i.severity === 'medium' ? 'text-bg-warning text-dark' : 'text-bg-success'}`}>{i.severity}</span>
                    </td>
                    <td>{i.message}</td>
                    <td className="text-end">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={async () => {
                          await API.post(`/api/monitor/issues/${i._id}/resolve`);
                          toast("Issue resolved", "success");
                          const res = await API.get("/api/monitor/issues");
                          setIssues(res.data);
                        }}
                      >
                        Resolve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Logs section removed from Supervisor Panel */}
    </div>
  );
}
