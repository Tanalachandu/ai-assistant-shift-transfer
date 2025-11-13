import { useEffect, useState } from "react";
import API from "../api";

export default function ShiftList({ refresh }) {
  const [shifts, setShifts] = useState([]);

  useEffect(() => {
    API.get("/api/shifts")
      .then((res) => setShifts(res.data))
      .catch(console.error);
  }, [refresh]);

  return (
    <div className="p-3">
      <h4>All Shifts</h4>
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Date</th>
            <th>Urgency</th>
            <th>Assigned To</th>
          </tr>
        </thead>
        <tbody>
          {shifts.map((s) => (
            <tr key={s._id}>
              <td>{s.date}</td>
              <td>{s.urgency}</td>
              <td>{s.assignedTo ? s.assignedTo.name : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
