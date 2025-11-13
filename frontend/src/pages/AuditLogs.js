import { useEffect, useMemo, useState } from "react";
import API from "../api";

function formatDate(dt) {
  try {
    return new Date(dt).toLocaleString();
  } catch (_) {
    return String(dt);
  }
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState("");
  const [expandedRowId, setExpandedRowId] = useState(null);

  const fetchLogs = async (currentLimit) => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get(`/api/audit-logs?limit=${currentLimit}`);
      setLogs(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) =>
      [l.action, l.actor, l.message]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [logs, search]);

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center mb-3">
        <h2 className="me-auto m-0">Audit Logs</h2>
        <div className="d-flex gap-2">
          <input
            type="text"
            className="form-control"
            placeholder="Search action/actor/message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 320 }}
          />
          <button
            className="btn btn-outline-secondary"
            disabled={loading}
            onClick={() => fetchLogs(limit)}
          >
            Refresh
          </button>
          <button
            className="btn btn-outline-primary"
            disabled={loading}
            onClick={() => setLimit((v) => Math.min(v + 50, 500))}
          >
            Load more
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="table-responsive" style={{ maxHeight: 520 }}>
        <table className="table table-dark table-striped table-hover align-middle table-sticky table-compact">
          <thead>
            <tr>
              <th style={{ width: 140 }}>Time</th>
              <th style={{ width: 120 }}>Action</th>
              <th style={{ width: 120 }}>Actor</th>
              <th>Message</th>
              <th style={{ width: 100 }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5}>Loading...</td>
              </tr>
            )}
            {!loading && filteredLogs.length === 0 && (
              <tr>
                <td colSpan={5}>No logs found.</td>
              </tr>
            )}
            {!loading &&
              filteredLogs.map((log) => {
                const rowId = log._id || `${log.action}-${log.createdAt}-${Math.random()}`;
                const isExpanded = expandedRowId === rowId;
                
                // Extract transfer information for better display
                const fromEmployee = log.before?.previousEmployeeName || (log.before?.previousEmployeeId ? String(log.before.previousEmployeeId).substring(0, 8) : null);
                const toEmployee = log.after?.newEmployeeName || 
                  log.message?.match(/→ ([^\s]+)/)?.[1] || 
                  log.message?.match(/assigned ([^\s]+) to/)?.[1] ||
                  log.message?.match(/to ([^\s]+)/)?.[1];
                const hasTransfer = fromEmployee && toEmployee;
                
                return (
                  <>
                    <tr key={rowId}>
                      <td>{formatDate(log.createdAt)}</td>
                      <td><span className="badge text-bg-secondary">{log.action}</span></td>
                      <td>{log.actor || "-"}</td>
                      <td style={{ whiteSpace: "pre-wrap" }}>
                        {hasTransfer ? (
                          <span>
                            <span className="text-warning fw-bold">{fromEmployee}</span>
                            {" → "}
                            <span className="text-success fw-bold">{toEmployee}</span>
                            <small className="text-muted d-block mt-1">{log.message}</small>
                          </span>
                        ) : (
                          log.message
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setExpandedRowId(isExpanded ? null : rowId)}
                        >
                          {isExpanded ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={5}>
                          <div className="row g-3">
                            <div className="col-md-4">
                              <div className="card">
                                <div className="card-header">Before</div>
                                <div className="card-body"><pre className="m-0 small">{JSON.stringify(log.before || {}, null, 2)}</pre></div>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="card">
                                <div className="card-header">After</div>
                                <div className="card-body"><pre className="m-0 small">{JSON.stringify(log.after || {}, null, 2)}</pre></div>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="card">
                                <div className="card-header">Metadata</div>
                                <div className="card-body"><pre className="m-0 small">{JSON.stringify(log.metadata || {}, null, 2)}</pre></div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
          </tbody>
        </table>
      </div>
      <div className="text-muted small mt-2">Showing {filteredLogs.length} of {logs.length} loaded (limit {limit}).</div>
    </div>
  );
}


