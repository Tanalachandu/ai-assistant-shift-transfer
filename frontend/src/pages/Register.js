import { useState } from "react";
import API from "../api";
import { useNavigate } from "react-router-dom";
import { toast } from "../components/Toaster";

export default function Register() {
  const [form,setForm] = useState({ name:"", email:"", password:"", role:"employee"});
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post("/api/auth/register", form);
      toast("Registered successfully. Please login.", "success");
      navigate("/login");
    } catch (err) {
      toast(err.response?.data?.error || "Register failed", "danger");
    }
  };

  return (
    <div className="container d-flex align-items-center justify-content-center" style={{minHeight: '70vh'}}>
      <div className="card shadow-sm p-4" style={{maxWidth: 520, width: '100%'}}>
        <h3 className="mb-1 text-center"><span className="brand-gradient">Create your account</span></h3>
        <p className="text-muted text-center mb-4">Join Shift AI</p>

        <form onSubmit={handleSubmit} className="row g-3">
          <div className="col-md-6">
            <label className="form-label">Name</label>
            <input name="name" className="form-control" placeholder="Full name" onChange={e=>setForm({...form, name:e.target.value})} required />
          </div>
          <div className="col-md-6">
            <label className="form-label">Role</label>
            <select className="form-select" value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
              <option value="employee">Employee</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">Email</label>
            <input name="email" type="email" className="form-control" placeholder="you@example.com" onChange={e=>setForm({...form, email:e.target.value})} autoComplete="email" required />
          </div>
          <div className="col-12">
            <label className="form-label">Password</label>
            <input name="password" type="password" className="form-control" placeholder="Create a password" onChange={e=>setForm({...form, password:e.target.value})} autoComplete="new-password" required />
          </div>
          <div className="col-12 d-grid">
            <button className="btn btn-primary">Register</button>
          </div>
          <div className="col-12 text-center">
            <small className="text-muted">Already have an account? <a href="/login">Login</a></small>
          </div>
        </form>
      </div>
    </div>
  );
}
