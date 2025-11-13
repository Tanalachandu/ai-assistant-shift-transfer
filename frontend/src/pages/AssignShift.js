import { useState } from "react";
import API from "../api";

export default function AssignShift() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const assignShift = async () => {
    try {
      setLoading(true);
      const res = await API.post("/api/assign"); // AI makes the decision
      setResult(res.data);
    } catch (err) {
      console.error(err);
      setResult({ 
        error: "AI assignment failed", 
        details: err.response?.data?.details || err.message 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-4">
      <h2>🤖 AI-Powered Shift Assignment</h2>
      <p className="text-muted">
        Our machine learning model analyzes employee skills, preferences, availability, 
        attendance history, and shift urgency to make optimal assignments.
      </p>
      <button
        onClick={assignShift}
        disabled={loading}
        className="btn btn-success mt-2"
      >
        {loading ? "AI is analyzing and assigning..." : "Assign Shifts Using AI"}
      </button>

      {result && (
        <div className="mt-3">
          {result.error ? (
            <div className="alert alert-danger">
              <strong>Error:</strong> {result.error}
              {result.details && <div className="mt-2"><small>{result.details}</small></div>}
            </div>
          ) : (
            <div className="alert alert-success">
              <strong>{result.message || "✅ Assignments completed"}</strong>
              {result.aiUsed && (
                <div className="mt-2">
                  <small>🤖 Powered by Machine Learning Model</small>
                </div>
              )}
              {result.assignments && result.assignments.length > 0 && (
                <div className="mt-3">
                  <h5>Assignments Made ({result.assignments.length}):</h5>
                  <ul className="list-group mt-2">
                    {result.assignments.map((assign, idx) => (
                      <li key={idx} className="list-group-item">
                        <strong>{assign.employee?.name || 'Employee'}</strong> → 
                        Shift on {assign.shift?.date || 'N/A'} 
                        {assign.score !== undefined && (
                          <span className="badge bg-primary ms-2">Score: {assign.score.toFixed(2)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
