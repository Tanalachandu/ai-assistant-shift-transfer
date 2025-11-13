import { useState } from "react";
import API from "../api";

export default function EmployeeForm({ onAdd }) {
  const [form, setForm] = useState({
    name: "",
    email: "", // ✅ added email field
    skill_match: "",
    preference: "",
    availability: "",
    attendance_score: "",
    recent_swaps: "",
    preferredShift: "none"
  });

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      skill_match: parseFloat(form.skill_match) || 0,
      preference: parseFloat(form.preference) || 0,
      availability: Math.max(0, Math.min(1, parseInt(form.availability, 10) || 0)),
      attendance_score: parseFloat(form.attendance_score) || 0,
      recent_swaps: Math.max(0, parseInt(form.recent_swaps, 10) || 0),
    };
    const res = await API.post("/api/add-employee", payload);
    onAdd(res.data.emp);
    setForm({
      name: "",
      email: "",
      skill_match: "",
      preference: "",
      availability: "",
      attendance_score: "",
      recent_swaps: "",
      preferredShift: "none"
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-3">
      <h5 className="mb-3">Add Employee</h5>

      {/* Name */}
      <div className="mb-3">
        <label className="form-label">Name</label>
        <input
          name="name"
          placeholder="Full name"
          value={form.name}
          onChange={handleChange}
          className="form-control"
          required
        />
      </div>

      {/* Email */}
      <div className="mb-3">
        <label className="form-label">Email</label>
        <input
          name="email"
          type="email"
          placeholder="email@example.com"
          value={form.email}
          onChange={handleChange}
          className="form-control"
          required
        />
      </div>

      {/* Preferred Shift */}
      <div className="mb-3">
        <label className="form-label">Preferred Shift</label>
        <select name="preferredShift" className="form-select" value={form.preferredShift} onChange={handleChange}>
          <option value="none">No preference</option>
          <option value="morning">Morning</option>
          <option value="evening">Evening</option>
        </select>
      </div>

      {/* Other fields */}
      <div className="row g-2 mb-3">
        {["skill_match", "preference", "attendance_score"].map((field) => (
          <div className="col-6" key={field}>
            <label className="form-label text-capitalize" style={{ fontSize: "0.85rem" }}>
              {field.replace("_", " ")}
            </label>
            <input
              name={field}
              type="number"
              step="0.1"
              min="0"
              max="1"
              placeholder="0.0 - 1.0"
              value={form[field]}
              onChange={handleChange}
              className="form-control"
              required
            />
          </div>
        ))}
        {/* Availability: only 0 or 1 */}
        <div className="col-6">
          <label className="form-label">Availability</label>
          <select
            name="availability"
            className="form-select"
            value={form.availability}
            onChange={handleChange}
            required
          >
            <option value="1">1 (Available)</option>
            <option value="0">0 (Unavailable)</option>
          </select>
        </div>
        {/* Recent swaps: any integer >= 0 */}
        <div className="col-6">
          <label className="form-label">Recent Swaps</label>
          <input
            name="recent_swaps"
            type="number"
            step="1"
            min="0"
            placeholder="0, 1, 2, ..."
            value={form.recent_swaps}
            onChange={handleChange}
            className="form-control"
            required
          />
        </div>
      </div>

      <button className="btn btn-primary w-100 mt-2">➕ Add Employee</button>
    </form>
  );
}
