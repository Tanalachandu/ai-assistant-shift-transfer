import { useState } from "react";
import API from "../api";
import { toast } from "./Toaster";

export default function UpdateAvailability() {
  const [availability, setAvailability] = useState("");
  const [message, setMessage] = useState("");

  const handleUpdate = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await API.patch(
        "/api/employees/my-availability",
        { availability: Number(availability) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(res.data.message);
      toast("Availability updated", "success");
    } catch (err) {
      setMessage("Error updating availability");
      toast("Error updating availability", "danger");
    }
  };

  return (
    <div className="card p-3 mt-3">
      <h4>Update Availability</h4>
      <input
        type="number"
        min="0"
        max="1"
        step="0.1"
        value={availability}
        onChange={(e) => setAvailability(e.target.value)}
        className="form-control my-2"
        placeholder="Enter availability (0 - 1)"
      />
      <button className="btn btn-primary" onClick={handleUpdate}>
        Update
      </button>
      {message && <p className="mt-2 text-success">{message}</p>}
    </div>
  );
}
