import { useEffect, useMemo, useState } from "react";
import API from "../api";
import EmployeeForm from "../components/EmployeeForm";
import EmployeeList from "../components/EmployeeList";
import UpdateAvailability from "../components/UpdateAvailability";
import { toast } from "../components/Toaster";

export default function Home() {
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [myAvailability, setMyAvailability] = useState("1");
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "null"), []);
  const isSupervisor = user?.role === "supervisor";

  const myEmployeeRecord = useMemo(() => {
    if (!user?.email) return null;
    return employees.find((emp) => emp.email === user.email) || null;
  }, [employees, user]);

  const listColumnClass = useMemo(() => {
    if (isSupervisor) return "col-md-8";
    if (myEmployeeRecord) return "col-md-8";
    return "col-12";
  }, [isSupervisor, myEmployeeRecord]);

  useEffect(() => {
    API.get("/api/employees").then((res) => setEmployees(res.data));
    API.get("/api/shifts").then((res) => setShifts(res.data));
  }, []);

  useEffect(() => {
    if (myEmployeeRecord) {
      setMyAvailability(String(myEmployeeRecord.availability ?? ""));
    }
  }, [myEmployeeRecord]);

  const assignedCount = shifts.filter((s) => s.assignedTo).length;
  const handleAdd = (newEmp) => setEmployees([...employees, newEmp]);

  const handleAvailabilitySubmit = async (e) => {
    e.preventDefault();
    const valueNum = parseFloat(myAvailability);
    if (Number.isNaN(valueNum) || valueNum < 0 || valueNum > 1) {
      toast("Availability must be between 0 and 1", "danger");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await API.patch(
        "/api/employees/my-availability",
        { availability: valueNum },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updatedEmployee = res.data.employee;
      setEmployees((prev) =>
        prev.map((emp) => (emp._id === updatedEmployee._id ? updatedEmployee : emp))
      );
      toast("Availability updated", "success");
    } catch (err) {
      toast(err.response?.data?.error || "Failed to update availability", "danger");
    }
  };

  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      const token = localStorage.getItem("token");
      await API.post(
        "/api/monitor/check-in",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast("Checked in", "success");
    } catch (e) {
      toast(e.response?.data?.error || "Check-in failed", "danger");
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setCheckingOut(true);
      const token = localStorage.getItem("token");
      await API.post(
        "/api/monitor/check-out",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast("Checked out", "success");
    } catch (e) {
      toast(e.response?.data?.error || "Check-out failed", "danger");
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="container mt-4">
      <h2 className="text-center mb-4 fw-bold">📊 Dashboard Overview</h2>

      {/* Only for Employees */}
      {user?.role === "employee" && (
        <>
          <UpdateAvailability />
          <div className="card p-3 mt-3">
            <div className="d-flex align-items-center justify-content-between">
              <h4 className="mb-2">Attendance</h4>
              <span className="text-muted small">Use the buttons to record today's status</span>
            </div>
            <div className="d-flex gap-2">
              <button
                className="btn btn-primary"
                onClick={handleCheckIn}
                disabled={checkingIn}
                title="Record your check-in time"
              >
                {checkingIn ? "Checking In…" : "Check In"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleCheckOut}
                disabled={checkingOut}
                title="Record your check-out time"
              >
                {checkingOut ? "Checking Out…" : "Check Out"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Stats Section */}
      <div className="row text-center mb-4 fade-in">
        <div className="col-md-4 mb-3">
          <div className="card stat-card border-0 shadow-sm">
            <div className="card-body">
              <h5 className="card-title text-muted mb-2">👥 Employees</h5>
              <p className="display-6 text-primary fw-bold mb-0">{employees.length}</p>
            </div>
          </div>
        </div>

        <div className="col-md-4 mb-3">
          <div className="card stat-card border-0 shadow-sm">
            <div className="card-body">
              <h5 className="card-title text-muted mb-2">📅 Total Shifts</h5>
              <p className="display-6 text-success fw-bold mb-0">{shifts.length}</p>
            </div>
          </div>
        </div>

        <div className="col-md-4 mb-3">
          <div className="card stat-card border-0 shadow-sm">
            <div className="card-body">
              <h5 className="card-title text-muted mb-2">✅ Assigned</h5>
              <p className="display-6 text-warning fw-bold mb-0">{assignedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <hr className="mb-4" />

      {/* Employee Management Section */}
      <div className="row">
        {isSupervisor && (
          <div className="col-md-4 mb-4">
            <div className="card shadow-sm p-3">
              <h4 className="mb-3 text-center text-primary">➕ Add Employee</h4>
              <EmployeeForm onAdd={handleAdd} />
            </div>
          </div>
        )}

        {/* Availability UI handled by UpdateAvailability above for employees */}

        <div className={listColumnClass}>
          <div className="card shadow-sm p-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h4 className="mb-0 text-primary">👥 Employee List</h4>
              <button className="btn btn-outline-secondary btn-sm" onClick={()=>{
                API.get("/api/employees").then((res) => setEmployees(res.data));
                API.get("/api/shifts").then((res) => setShifts(res.data));
              }}>Refresh</button>
            </div>
            {employees.length === 0 ? (
              <div className="empty-state">No employees found.</div>
            ) : (
              <EmployeeList />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
