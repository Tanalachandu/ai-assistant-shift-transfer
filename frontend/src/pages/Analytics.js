import { useEffect, useState } from "react";
import API from "../api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function Analytics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    API.get("/api/analytics")
      .then((res) => setData(res.data))
      .catch(console.error);
  }, []);

  if (!data) return <p className="p-3">Loading analytics...</p>;

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="mb-0">📊 Shift Analytics Dashboard</h2>
        <span className="text-muted">Updated just now</span>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card p-3">
            <div className="text-muted small">Total Employees</div>
            <div className="display-6 text-primary fw-bold">{data.totalEmployees}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card p-3">
            <div className="text-muted small">Total Shifts</div>
            <div className="display-6 text-success fw-bold">{data.totalShifts}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card p-3">
            <div className="text-muted small">Assigned Shifts</div>
            <div className="display-6 text-warning fw-bold">{data.assignedShifts}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card p-3">
            <div className="text-muted small">Average Urgency</div>
            <div className="display-6 fw-bold">{data.avgUrgency.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="card p-3">
        <h5 className="mb-3">Employee Workload Distribution</h5>
        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer>
            <BarChart data={data.shiftDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" interval={0} angle={-20} height={60} textAnchor="end" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="shiftsAssigned" fill="#60a5fa" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
