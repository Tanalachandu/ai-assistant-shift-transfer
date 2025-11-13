import { useEffect, useState } from "react";

export function toast(message, variant = "success", durationMs = 3000) {
  window.dispatchEvent(
    new CustomEvent("app-toast", { detail: { message, variant, durationMs } })
  );
}

export default function Toaster() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const id = Math.random().toString(36).slice(2);
      const { message, variant, durationMs } = e.detail || {};
      const item = { id, message, variant };
      setToasts((prev) => [...prev, item]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs || 3000);
    };
    window.addEventListener("app-toast", handler);
    return () => window.removeEventListener("app-toast", handler);
  }, []);

  return (
    <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 2000 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`alert alert-${t.variant} shadow-sm mb-2`}
          role="alert"
          style={{ minWidth: 260, maxWidth: 420 }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}


