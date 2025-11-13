import { useEffect, useMemo, useState } from "react";
import API from "../api";
import { toast } from "../components/Toaster";

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: "", urgency: "0.5", shiftType: "morning" });
  const [adding, setAdding] = useState(false);
  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "null"), []);
  const isSupervisor = user?.role === "supervisor";

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = () => {
    setLoading(true);
    API.get("/api/shifts").then((res) => setShifts(res.data)).finally(() => setLoading(false));
  };

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleShiftTypeChange = (e) => {
    const value = e.target.value;
    setForm({ ...form, shiftType: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSupervisor) return;
    try {
      setAdding(true);
      await API.post("/api/add-shift", { date: form.date, urgency: Number(form.urgency), shiftType: form.shiftType });
      setForm({ date: "", urgency: "0.5", shiftType: "morning" });
      fetchShifts();
      toast("Shift added", "success");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!isSupervisor) return;
    if (!window.confirm("Delete this shift?")) return;
    await API.delete(`/api/delete-shift/${id}`);
    fetchShifts();
    toast("Shift deleted", "success");
  };

  return (
    <div className="container mt-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="mb-0">🗓 Shift Management</h2>
        <span className="text-muted">{loading ? "Loading..." : `${shifts.length} total`}</span>
      </div>

      {isSupervisor ? (
        <div className="card shadow-sm p-3 mb-4">
          <h5 className="mb-3 text-primary">Add New Shift</h5>
          <form onSubmit={handleSubmit} className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Date</label>
              <input
                type="date"
                name="date"
                className="form-control"
                value={form.date}
                onChange={handleChange}
                min={new Date().toISOString().slice(0,10)}
                required
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Urgency</label>
              <div className="d-flex align-items-center gap-2">
                <input
                  type="range"
                  name="urgency"
                  step="0.1"
                  min="0"
                  max="1"
                  className="form-range"
                  value={form.urgency}
                  onChange={handleChange}
                />
                <span className="badge text-bg-secondary">{Number(form.urgency).toFixed(1)}</span>
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label">Shift Type</label>
              <select name="shiftType" className="form-select" value={form.shiftType} onChange={handleShiftTypeChange}>
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
              </select>
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button className="btn btn-primary w-100" disabled={adding}>{adding ? "Adding…" : "Add Shift"}</button>
            </div>
          </form>
        </div>
      ) : (
        <div className="alert alert-info">View-only: shifts are managed by supervisors.</div>
      )}

      <div className="card shadow-sm p-3">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h5 className="mb-0">All Shifts</h5>
          <button className="btn btn-outline-secondary btn-sm" onClick={fetchShifts} disabled={loading}>Refresh</button>
        </div>
        {loading ? (
          <div className="empty-state">Loading shifts...</div>
        ) : shifts.length === 0 ? (
          <div className="empty-state">No shifts yet. {isSupervisor ? "Add a new shift to get started." : "Please check back later."}</div>
        ) : (
          <div className="table-responsive" style={{ maxHeight: 520 }}>
            <table className="table table-dark table-striped table-hover align-middle mb-0 table-sticky table-compact">
              <thead className="table-dark">
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Urgency</th>
                  <th>Assigned To</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s._id}>
                    <td>{s.date?.slice(0, 10) || "—"}</td>
                    <td className="text-capitalize">{s.shiftType || 'morning'}</td>
                    <td>
                      <span className={`badge ${s.urgency >= 0.8 ? 'text-bg-danger' : s.urgency >= 0.5 ? 'text-bg-warning text-dark' : 'text-bg-success'}`}>{Number(s.urgency).toFixed(2)}</span>
                    </td>
                    <td>{s.assignedTo ? s.assignedTo.name : <span className="text-muted">Unassigned</span>}</td>
                    <td className="text-end">
                      {isSupervisor ? (
                        <button onClick={() => handleDelete(s._id)} className="btn btn-danger btn-sm">🗑 Delete</button>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
