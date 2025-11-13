import { useState } from "react";
import API from "../api"; // axios instance
import { useNavigate } from "react-router-dom";
import { toast } from "../components/Toaster";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  const handleChange = e => setForm({...form, [e.target.name]: e.target.value});

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post("/api/auth/login", form);
      const { token, user } = res.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      window.dispatchEvent(new Event("auth-change"));
      navigate("/");
    } catch (err) {
      toast(err.response?.data?.error || "Login failed", "danger");
    }
  };

  return (
    <div className="container d-flex align-items-center justify-content-center" style={{minHeight: '70vh'}}>
      <div className="card shadow-sm p-4" style={{maxWidth: 420, width: '100%'}}>
        <h3 className="mb-1 text-center"><span className="brand-gradient">Welcome back</span></h3>
        <p className="text-muted text-center mb-4">Sign in to continue</p>

        <form onSubmit={handleSubmit} className="row g-3">
          <div className="col-12">
            <label className="form-label">Email</label>
            <input name="email" type="email" placeholder="you@example.com" onChange={handleChange} className="form-control" autoComplete="email" required />
          </div>
          <div className="col-12">
            <label className="form-label">Password</label>
            <input name="password" type="password" placeholder="••••••••" onChange={handleChange} className="form-control" autoComplete="current-password" required />
          </div>
          <div className="col-12 d-grid">
            <button className="btn btn-primary">Login</button>
          </div>
          <div className="col-12 text-center">
            <small className="text-muted">Don't have an account? <a href="/register">Register</a></small>
          </div>
        </form>
      </div>
    </div>
  );
}
