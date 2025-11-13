import { useEffect, useMemo, useState } from "react";
import API from "../api";
import { toast } from "./Toaster";

export default function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [filterShift, setFilterShift] = useState("all");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isSupervisor = user?.role === "supervisor";

  const fetchEmployees = () =>
    API.get("/api/employees")
      .then((res) => setEmployees(res.data))
      .catch(console.error);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this employee?")) return;
    await API.delete(`/api/delete-employee/${id}`);
    setEmployees(employees.filter((e) => e._id !== id));
  };

  const handlePreferredShiftChange = async (employeeId, value) => {
    try {
      await API.patch(`/api/employees/${employeeId}/preferred-shift`, { preferredShift: value });
      setEmployees((prev) => prev.map((e) => (e._id === employeeId ? { ...e, preferredShift: value } : e)));
      toast("Preferred shift updated", "success");
    } catch (e) {
      toast(e.response?.data?.error || "Update failed", "danger");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesText = !q || (e.name || "").toLowerCase().includes(q) || (e.email || "").toLowerCase().includes(q);
      const pref = e.preferredShift || "none";
      const matchesShift = filterShift === "all" || pref === filterShift;
      return matchesText && matchesShift;
    });
  }, [employees, search, filterShift]);

  return (
    <div className="p-3">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h3 className="mb-0">Employee List</h3>
        <div className="d-flex gap-2">
          <input
            className="form-control"
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
          <select className="form-select" value={filterShift} onChange={(e)=>setFilterShift(e.target.value)} style={{ width: 160 }}>
            <option value="all">All shifts</option>
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
            <option value="none">No preference</option>
          </select>
          <button className="btn btn-outline-secondary" onClick={fetchEmployees}>Refresh</button>
        </div>
      </div>
      <div className="table-responsive" style={{ maxHeight: 520 }}>
      <table className="table table-dark table-striped table-hover align-middle mb-0 table-sticky table-compact">
        <thead className="table-dark">
          <tr>
            <th>Name</th>
            <th>Skill</th>
            <th>Preference</th>
            <th>Pref Shift</th>
            <th>Availability</th>
            <th>Attendance</th>
            <th>Swaps</th>
            {isSupervisor && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map((e) => (
            <tr key={e._id}>
              <td>{e.name}</td>
              <td><span className="badge text-bg-primary">{Number(e.skill_match).toFixed(2)}</span></td>
              <td><span className="badge text-bg-info">{Number(e.preference).toFixed(2)}</span></td>
              <td className="text-capitalize">
                {isSupervisor ? (
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 140 }}
                    value={e.preferredShift || "none"}
                    onChange={(ev) => handlePreferredShiftChange(e._id, ev.target.value)}
                  >
                    <option value="none">No preference</option>
                    <option value="morning">Morning</option>
                    <option value="evening">Evening</option>
                  </select>
                ) : (
                  <span className="badge text-bg-secondary">{e.preferredShift && e.preferredShift !== 'none' ? e.preferredShift : '-'}</span>
                )}
              </td>
              <td><span className="badge text-bg-success">{Number(e.availability).toFixed(2)}</span></td>
              <td><span className="badge text-bg-secondary">{Number(e.attendance_score).toFixed(2)}</span></td>
              <td><span className="badge text-bg-warning text-dark">{e.recent_swaps}</span></td>
              {isSupervisor && (
                <td>
                  <button
                    onClick={() => handleDelete(e._id)}
                    className="btn btn-danger btn-sm"
                  >
                    🗑 Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
