import { useState } from "react";
import API from "../api";

export default function ShiftForm({ onAdd }) {
  const [form, setForm] = useState({
    date: "",
    urgency: ""
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post("/api/add-shift", form);
      onAdd(res.data.shift);
      setForm({ date: "", urgency: "" });
    } catch (err) {
      alert("Error adding shift");
      console.error(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 border rounded">
      <h4>Add New Shift</h4>
      <div className="mb-2">
        <label>Date:</label>
        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
          className="form-control"
          required
        />
      </div>
      <div className="mb-2">
        <label>Urgency (0–1):</label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="1"
          name="urgency"
          value={form.urgency}
          onChange={handleChange}
          className="form-control"
          required
        />
      </div>
      <button className="btn btn-primary w-100">Add Shift</button>
    </form>
  );
}
