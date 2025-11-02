import jwt from "jsonwebtoken";

// ✅ Verify JWT token
export const verifyToken = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // contains { id, role, name, email }
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// ✅ Restrict route to supervisors
export const isSupervisor = (req, res, next) => {
  if (req.user?.role !== "supervisor") {
    return res.status(403).json({ error: "Access denied: Supervisor only" });
  }
  next();
};

// ✅ Restrict route to employees
export const isEmployee = (req, res, next) => {
  if (req.user?.role !== "employee") {
    return res.status(403).json({ error: "Access denied: Employee only" });
  }
  next();
};
