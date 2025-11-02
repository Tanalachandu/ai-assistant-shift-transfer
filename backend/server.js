import express from "express";
import axios from "axios";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import mongoose from "mongoose"; // ✅ MongoDB
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Employee from "./models/Employee.js";
import Shift from "./models/Shift.js";
import Attendance from "./models/Attendance.js";
// import Leave from "./models/Leave.js"; // removed while sudden leave is disabled
import Issue from "./models/Issue.js";
import AuditLog from "./models/AuditLog.js";
import { sendEmail } from "./utils/sendEmail.js";
import authRoutes from "./routes/authRoutes.js";
import { verifyToken, isSupervisor } from "./middleware/authMiddleware.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, ".env"),
  path.resolve(process.cwd(), ".env"),
];

let envLoaded = false;
for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    const result = dotenv.config({ path: candidate });
    if (!result.error) {
      envLoaded = true;
      break;
    }
  }
}

if (!envLoaded) {
  dotenv.config();
}

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn(
    "⚠️ EMAIL_USER or EMAIL_PASS not set. Email notifications will be disabled until they are provided."
  );
}

console.log(
  "Email Config:",
  process.env.EMAIL_USER,
  process.env.EMAIL_PASS ? "✅ loaded" : "❌ missing"
);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use("/api/auth", authRoutes);

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected locally"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// AI service URL from environment variable
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001/score_and_assign";
// Standard work-hour caps (not per-employee input)
const DEFAULT_MAX_SHIFTS_PER_DAY = 1;
const DEFAULT_MAX_SHIFTS_PER_WEEK = 5;

// Log AI service configuration
if (AI_SERVICE_URL) {
  console.log(`🤖 AI Service configured: ${AI_SERVICE_URL}`);
} else {
  console.warn("⚠️ AI_SERVICE_URL not set. AI assignment will not work.");
}

// Root test endpoint
app.get("/", (req, res) => {
  res.send("Backend is running successfully!");
});

// ✅ Get all assigned shifts (for supervisor dashboard)
app.get("/api/assigned-shifts", verifyToken, async (req, res) => {
    try {
      const assigned = await Shift.find({ assignedTo: { $ne: null } }).populate("assignedTo");
      res.json(assigned);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // ✅ Supervisor override – change assigned employee
app.post(
  "/api/override-shift",
  verifyToken,
  isSupervisor,
  async (req, res) => {
    try {
      const { shiftId, newEmployeeId } = req.body;
  
      const shift = await Shift.findById(shiftId);
      if (!shift) return res.status(404).json({ error: "Shift not found" });
  
      const employee = await Employee.findById(newEmployeeId);
      if (!employee) return res.status(404).json({ error: "Employee not found" });
  
      // Get previous employee info if shift was previously assigned
      const previousAssignedTo = shift.assignedTo;
      let previousEmployee = null;
      if (previousAssignedTo) {
        previousEmployee = await Employee.findById(previousAssignedTo);
      }
      
      // Fairness warnings for manual overrides
      try {
        const dateStr = (shift.date || "").trim();
        if (dateStr) {
          const wk = weekKey(dateStr);
          const dayCount = await Shift.countDocuments({ assignedTo: employee._id, date: dateStr });
          const weekDocs = await Shift.find({ assignedTo: employee._id, date: { $regex: /^\d{4}-\d{2}-\d{2}$/ } }).select("date");
          let weekCount = 0;
          for (const doc of weekDocs) {
            if (weekKey(doc.date) === wk) weekCount += 1;
          }
          const maxDay = DEFAULT_MAX_SHIFTS_PER_DAY;
          const maxWeek = DEFAULT_MAX_SHIFTS_PER_WEEK;
          if (dayCount + 1 > maxDay || weekCount + 1 > maxWeek) {
            await Issue.create({
              type: "fairness_cap_exceeded",
              severity: "medium",
              message: `Override may exceed cap for ${employee.name} (day ${dayCount + 1}/${maxDay}, week ${weekCount + 1}/${maxWeek}) on ${dateStr}`,
              metadata: { employeeId: employee._id, shiftId: shift._id, date: dateStr },
            }).catch(() => {});
          }
        }
      } catch (_) {}
      shift.assignedTo = newEmployeeId;
      await shift.save();

      // Audit log for supervisor override with transfer info
      try {
        const fromMessage = previousEmployee 
          ? ` from ${previousEmployee.name}` 
          : "";
        await AuditLog.create({
          action: "supervisor_override",
          actor: req.user?.email || "supervisor",
          message: `Supervisor transferred${fromMessage} → ${employee.name}`,
          before: { 
            assignedTo: previousAssignedTo,
            previousEmployeeId: previousEmployee?._id || null,
            previousEmployeeName: previousEmployee?.name || null
          },
          after: { 
            assignedTo: employee._id,
            newEmployeeName: employee.name
          },
          metadata: { date: shift.date, urgency: shift.urgency },
        });
      } catch (e) {
        console.error("Audit log failed (override):", e.message);
      }

      // Notify the newly assigned employee
      try {
        if (employee.email) {
          await sendEmail(
            employee.email,
            "Shift Reassignment Notification",
            `Hi ${employee.name},\n\nYou have been assigned to shift ${shift._id} (urgency ${shift.urgency}).\nDate: ${shift.date || "unspecified"}\n\nBest,\nShiftAI`
          );
        }
      } catch (e) {
        console.error("Email notify failed (override):", e.message);
      }

      res.json({ message: "✅ Shift reassigned successfully", shift });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);
  
// ✅ Add new employee
app.post("/api/add-employee", verifyToken, isSupervisor, async (req, res) => {
  try {
    const emp = new Employee(req.body);
    await emp.save();
    res.json({ message: "Employee added successfully", emp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Employee self-update (availability)
app.patch("/api/employees/my-availability", verifyToken, async (req, res) => {
  try {
    const { availability } = req.body;
    if (typeof availability !== "number" || availability < 0 || availability > 1) {
      return res.status(400).json({ error: "Availability must be a number between 0 and 1." });
    }

    let employee;

    if (req.user.role === "supervisor" && req.body.employeeId) {
      employee = await Employee.findById(req.body.employeeId);
    } else if (req.user.email) {
      employee = await Employee.findOne({ email: req.user.email });
    }

    if (!employee) {
      return res.status(404).json({ error: "Employee record not found." });
    }

    employee.availability = availability;
    await employee.save();

    // AUTOMATIC REASSIGNMENT: If employee becomes unavailable, free all their assigned shifts
      if (availability === 0) {
      try {
          const affected = await Shift.find({ assignedTo: employee._id });
        const affectedCount = affected.length;
        
        if (affectedCount > 0) {
          await Shift.updateMany({ assignedTo: employee._id }, { $set: { assignedTo: null } });
          
          // Audit logs for each unassignment
          for (const s of affected) {
            try {
              await AuditLog.create({
                action: "ai_unassign",
                actor: "ai",
                message: `Auto-unassigned ${employee.name} due to unavailability`,
                before: { assignedTo: employee._id, shiftId: s._id },
                after: { assignedTo: null },
                metadata: { date: s.date, urgency: s.urgency },
              });
            } catch (e) {
              console.error("Audit log failed (unassign):", e.message);
            }
          }
          
          console.log(`🔄 Auto-reassignment: Freed ${affectedCount} shifts from ${employee.name}`);
          }
      } catch (e) {
        console.error("Unassign on unavailability failed:", e.message);
      }
    }

    res.json({ message: "Availability updated", employee });
    
    // AUTOMATIC REASSIGNMENT: Trigger immediate auto-assign after availability change
    if (availability === 0) {
      console.log("🔄 Triggering automatic reassignment after availability change...");
    assignUnassignedWithAI().catch((e) =>
      console.error("Auto-assign after my-availability failed:", e.message)
    );
    } else {
      // Even if availability increases, check for unassigned shifts
      assignUnassignedWithAI().catch((e) =>
        console.error("Auto-assign after availability update failed:", e.message)
      );
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get all employees
app.get("/api/employees", verifyToken, async (req, res) => {
  try {
    const employees = await Employee.find();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Update employee preferred shift (supervisor only)
app.patch("/api/employees/:id/preferred-shift", verifyToken, isSupervisor, async (req, res) => {
  try {
    const { preferredShift } = req.body;
    const allowed = ["morning", "evening", "none"];
    if (!allowed.includes(preferredShift)) {
      return res.status(400).json({ error: "preferredShift must be one of: morning, evening, none" });
    }
    const emp = await Employee.findByIdAndUpdate(
      req.params.id,
      { preferredShift },
      { new: true }
    );
    if (!emp) return res.status(404).json({ error: "Employee not found" });
    res.json({ message: "Preferred shift updated", employee: emp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Add a new shift - automatically assigns via AI
app.post("/api/add-shift", verifyToken, isSupervisor, async (req, res) => {
  try {
    const shift = new Shift(req.body);
    await shift.save();
    
    console.log("🔄 New shift added, triggering automatic AI assignment...");
    // Fire-and-forget auto-assign after adding a new shift
    assignUnassignedWithAI().catch((e) =>
      console.error("Auto-assign after add-shift failed:", e.message)
    );
    res.json({ message: "Shift added successfully. AI will automatically assign it.", shift });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Delete Employee
app.delete("/api/delete-employee/:id", verifyToken, isSupervisor, async (req, res) => {
    try {
      const emp = await Employee.findByIdAndDelete(req.params.id);
      if (!emp) return res.status(404).json({ error: "Employee not found" });
      res.json({ message: "Employee deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // ✅ Delete Shift
app.delete("/api/delete-shift/:id", verifyToken, isSupervisor, async (req, res) => {
    try {
      const shift = await Shift.findByIdAndDelete(req.params.id);
      if (!shift) return res.status(404).json({ error: "Shift not found" });
      res.json({ message: "Shift deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  

// ✅ Get all shifts
app.get("/api/shifts", verifyToken, async (req, res) => {
  try {
    const shifts = await Shift.find().populate("assignedTo");
    res.json(shifts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: assign unassigned shifts via AI
async function assignUnassignedWithAI() {
  // 1️⃣ Fetch data from MongoDB
  const employees = await Employee.find();
  const shifts = await Shift.find({ assignedTo: null }); // only unassigned

    const existingAssignments = await Shift.find({
      assignedTo: { $ne: null },
    }).select("assignedTo date");

    const employeeAssignedDates = new Map(); // employeeId -> Map(date->count)
    const employeeAssignedWeeks = new Map(); // employeeId -> Map(week->count)
    const employeeAssignedMonths = new Map(); // employeeId -> Map(month->count)
    for (const assignment of existingAssignments) {
      if (!assignment.assignedTo) continue;
      const normalizedDate = (assignment.date || "").trim();
      if (!normalizedDate) continue;

      const key = assignment.assignedTo.toString();
      if (!employeeAssignedDates.has(key)) {
        employeeAssignedDates.set(key, new Map());
      }
      const dateMap = employeeAssignedDates.get(key);
      dateMap.set(normalizedDate, (dateMap.get(normalizedDate) || 0) + 1);

      const wk = weekKey(normalizedDate);
      if (!employeeAssignedWeeks.has(key)) {
        employeeAssignedWeeks.set(key, new Map());
      }
      const wkMap = employeeAssignedWeeks.get(key);
      wkMap.set(wk, (wkMap.get(wk) || 0) + 1);

      const month = monthKey(normalizedDate);
      if (!employeeAssignedMonths.has(key)) {
        employeeAssignedMonths.set(key, new Map());
      }
      const monthMap = employeeAssignedMonths.get(key);
      monthMap.set(month, (monthMap.get(month) || 0) + 1);
    }

  if (employees.length === 0 || shifts.length === 0) {
    console.log(
      `Assign skipped: employees=${employees.length}, unassignedShifts=${shifts.length}`
    );
    return { message: "No employees or unassigned shifts available.", assignments: [] };
  }

    // 2️⃣ Prepare data for Flask - include fairness information
    // Count how many shifts each employee already has assigned (TOTAL from database)
    const employeeShiftCounts = new Map(); // TOTAL shifts per employee
    for (const assignment of existingAssignments) {
      if (assignment.assignedTo) {
        const key = assignment.assignedTo.toString();
        employeeShiftCounts.set(key, (employeeShiftCounts.get(key) || 0) + 1);
      }
    }
    
    // Log current distribution for debugging
    const shiftDistribution = Array.from(employeeShiftCounts.entries())
      .map(([empId, count]) => {
        const emp = employees.find(e => e._id.toString() === empId);
        return emp ? `${emp.name}(${count})` : `Unknown(${count})`;
      })
      .join(", ");
    console.log(`📊 CURRENT TOTAL SHIFTS PER EMPLOYEE: ${shiftDistribution}`);
    const zeroShiftsEmployees = employees.filter(e => {
      const count = employeeShiftCounts.get(e._id.toString()) || 0;
      return count === 0;
    });
    console.log(`📊 EMPLOYEES WITH ZERO SHIFTS: ${zeroShiftsEmployees.map(e => e.name).join(", ") || "None"}`);
    
    // Calculate total shifts and fairness metrics
    const totalShiftsAssigned = Array.from(employeeShiftCounts.values()).reduce((sum, count) => sum + count, 0);
    const totalEmployees = employees.length;
    const averageShiftsPerEmployee = totalEmployees > 0 ? totalShiftsAssigned / totalEmployees : 0;
    
    // Calculate min/max for normalization
    const shiftCounts = Array.from(employeeShiftCounts.values());
    const minShifts = shiftCounts.length > 0 ? Math.min(...shiftCounts, 0) : 0;
    const maxShifts = shiftCounts.length > 0 ? Math.max(...shiftCounts, 0) : 0;
    const maxPossibleShifts = Math.max(maxShifts, totalShiftsAssigned / Math.max(totalEmployees, 1) * 2); // Use 2x average as max
    
    const payload = {
      shifts: shifts.map((s) => ({ urgency: s.urgency })),
      candidates: employees.map((e) => {
        const employeeIdStr = e._id.toString();
        const shiftsAlreadyAssigned = employeeShiftCounts.get(employeeIdStr) || 0;
        
        // FAIRNESS METRICS: Multiple ways to measure fairness
        const shiftsRelativeToAverage = averageShiftsPerEmployee > 0 
          ? shiftsAlreadyAssigned / averageShiftsPerEmployee 
          : 0; // Ratio to average (1.0 = average, >1.0 = above average, <1.0 = below average)
        
        const shiftsNormalized = maxPossibleShifts > 0 
          ? Math.min(shiftsAlreadyAssigned / maxPossibleShifts, 1.0) 
          : 0; // Normalized 0-1
        
        const fairnessScore = 1.0 - shiftsNormalized; // Higher = more fair (0 shifts = 1.0, max shifts = 0.0)
        
        return {
        skill_match: e.skill_match,
        preference: e.preference,
        availability: e.availability,
        attendance_score: e.attendance_score,
        recent_swaps: e.recent_swaps,
          shifts_already_assigned: shiftsAlreadyAssigned,  // Absolute count
          shifts_relative_to_average: shiftsRelativeToAverage,  // Relative to team average
          shifts_normalized: shiftsNormalized,  // Normalized 0-1
          fairness_score: fairnessScore,  // Inverse of normalized (1.0 = most fair, 0.0 = least fair)
          total_shifts_assigned: totalShiftsAssigned,  // Total context
          average_shifts_per_employee: averageShiftsPerEmployee,  // Team average
        };
      }),
    };

    // 3️⃣ Send to Flask AI service - AI makes the decision
  let result;
  let aiUsed = false;
  try {
    console.log(`🤖 Sending ${shifts.length} shifts and ${employees.length} candidates to AI service...`);
    const aiRes = await axios.post(AI_SERVICE_URL, payload, {
      timeout: 10000, // 10 second timeout
    });
    result = aiRes.data;
    aiUsed = true;
    console.log(`✅ AI successfully analyzed and assigned shifts using machine learning model`);
    
    // Log assignment distribution
    if (result.assignments) {
      const assignmentCounts = {};
      result.assignments.forEach(assg => {
        const empIdx = assg.candidate_index;
        assignmentCounts[empIdx] = (assignmentCounts[empIdx] || 0) + 1;
      });
      console.log(`📊 AI Assignment distribution:`, assignmentCounts);
    }
  } catch (e) {
    console.error(`❌ AI service error: ${e.message}`);
    throw new Error(`AI assignment failed: ${e.message}. Please ensure the AI service is running at ${AI_SERVICE_URL}`);
  }

    // 4️⃣ Apply all AI assignments
    const assignments = result.assignments || [];
  if (assignments.length === 0) {
    throw new Error("No assignments returned by AI.");
  }

    const updates = [];
    const assignedEmployeeIds = new Set(); // Track employees assigned in this batch
    const assignedEmployeeIndices = new Set(); // Track employee indices assigned in this batch

    const rawScores = Array.isArray(result.raw_scores)
      ? result.raw_scores
      : [];

    // Process Hungarian algorithm assignments while enforcing fair distribution
    const assignmentsByShift = new Map();
    for (const assignment of assignments) {
      if (typeof assignment.shift_index !== "number") continue;
      assignmentsByShift.set(assignment.shift_index, assignment);
    }

    // Count how many shifts each employee gets from Hungarian algorithm
    const employeeAssignmentCounts = new Map();
    assignments.forEach(assg => {
      const empIdx = assg.candidate_index;
      employeeAssignmentCounts.set(empIdx, (employeeAssignmentCounts.get(empIdx) || 0) + 1);
    });
    
    console.log(`📊 Hungarian algorithm assigned:`, 
      Array.from(employeeAssignmentCounts.entries()).map(([idx, count]) => 
        `${employees[idx]?.name || idx}: ${count}`
      ).join(", ")
    );
    
    // Check if Hungarian algorithm is assigning too many to one person
    const maxAssignments = Math.max(...Array.from(employeeAssignmentCounts.values()), 0);
    if (maxAssignments > shifts.length / 2 && shifts.length > 1) {
      console.log(`⚠️ WARNING: Hungarian algorithm assigned ${maxAssignments} shifts to one employee. Fairness logic will override.`);
    }

    // Track assignments made in THIS batch for rotation fairness
    const batchAssignmentCountsByEmployeeId = new Map(); // employeeId -> count in this batch
    
    // Sort shifts to process those with fewer viable candidates first (fair distribution)
    // Also prioritize shifts on dates that have fewer assignments already
    const shiftProcessingOrder = [];
    for (let shiftIndex = 0; shiftIndex < shifts.length; shiftIndex += 1) {
      const shift = shifts[shiftIndex];
      if (!shift || shift.assignedTo) continue;
      
      const shiftDate = (shift.date || "").trim();
      const shiftWeek = shiftDate ? weekKey(shiftDate) : "";
      const shiftScores = rawScores[shiftIndex] || [];
      
      // Count viable candidates considering current batch assignments
      let viableCandidates = 0;
      for (let idx = 0; idx < employees.length; idx++) {
        const emp = employees[idx];
        if (!emp || emp.availability === 0) continue;
        if (assignedEmployeeIndices.has(idx)) continue;
        
        // Check day/week constraints
        if (shiftDate) {
          const empIdStr = emp._id.toString();
          const datesForEmployee = employeeAssignedDates.get(empIdStr);
          const countForDay = datesForEmployee?.get(shiftDate) || 0;
          if (countForDay >= DEFAULT_MAX_SHIFTS_PER_DAY) continue;

          const weekForEmployee = employeeAssignedWeeks.get(empIdStr);
          const countForWeek = weekForEmployee?.get(shiftWeek) || 0;
          if (countForWeek >= DEFAULT_MAX_SHIFTS_PER_WEEK) continue;
        }
        
        viableCandidates++;
      }
      
      // Count how many employees already have shifts on this date (for prioritization)
      let employeesOnDate = 0;
      if (shiftDate) {
        employeeAssignedDates.forEach((dateMap) => {
          if (dateMap.has(shiftDate)) employeesOnDate++;
        });
      }
      
      shiftProcessingOrder.push({ 
        shiftIndex, 
        viableCandidates,
        employeesOnDate, // Fewer = higher priority (distribute dates)
        shiftDate 
      });
    }
    // Process shifts with: 1) Fewer viable candidates, 2) Fewer employees already on that date
    shiftProcessingOrder.sort((a, b) => {
      if (a.viableCandidates !== b.viableCandidates) {
        return a.viableCandidates - b.viableCandidates;
      }
      return a.employeesOnDate - b.employeesOnDate;
    });

    for (const { shiftIndex } of shiftProcessingOrder) {
      const selectedShift = shifts[shiftIndex];
      if (!selectedShift || selectedShift.assignedTo) {
        continue;
      }

      const aiAssignment = assignmentsByShift.get(shiftIndex);
      const shiftDate = (selectedShift.date || "").trim();
      const hasShiftDate = shiftDate.length > 0;
      const shiftWeek = hasShiftDate ? weekKey(shiftDate) : "";
      const shiftMonth = hasShiftDate ? monthKey(shiftDate) : "";
      const shiftScores = rawScores[shiftIndex] || [];

      let chosenCandidate = null;

      // Comprehensive constraint checking with preference support
      const checkConstraints = (candidateIdx, requirePreferredShift = false) => {
        const candidate = employees[candidateIdx];
        if (!candidate) return { valid: false, reason: "invalid_candidate" };
        
        // CONSTRAINT 1: Must not be already assigned in this batch
        if (assignedEmployeeIndices.has(candidateIdx)) {
          return { valid: false, reason: "already_assigned_in_batch" };
        }
        
        // CONSTRAINT 2: Must be available
        if (candidate.availability === 0) {
          return { valid: false, reason: "unavailable" };
        }

        const employeeIdStr = candidate._id.toString();
        
        // CONSTRAINT 3: Must not be assigned to another shift in this batch (by ID)
        if (assignedEmployeeIds.has(employeeIdStr)) {
          return { valid: false, reason: "already_assigned_in_batch" };
        }
        
        // CONSTRAINT 4: Check day/week/month limits
        if (hasShiftDate) {
          const datesForEmployee = employeeAssignedDates.get(employeeIdStr);
          const countForDay = datesForEmployee?.get(shiftDate) || 0;
          if (countForDay >= DEFAULT_MAX_SHIFTS_PER_DAY) {
            return { valid: false, reason: "max_shifts_per_day_exceeded" };
          }

          const weekForEmployee = employeeAssignedWeeks.get(employeeIdStr);
          const countForWeek = weekForEmployee?.get(shiftWeek) || 0;
          if (countForWeek >= DEFAULT_MAX_SHIFTS_PER_WEEK) {
            return { valid: false, reason: "max_shifts_per_week_exceeded" };
          }
          
          // Monthly balance check (soft constraint - encourages but doesn't block)
          const monthForEmployee = employeeAssignedMonths.get(employeeIdStr);
          const countForMonth = monthForEmployee?.get(shiftMonth) || 0;
          // Note: Monthly balance is handled by AI fairness features
          // This check just prevents extreme imbalances
          const maxReasonableShiftsPerMonth = 20; // Configurable limit
          if (countForMonth >= maxReasonableShiftsPerMonth) {
            return { valid: false, reason: "monthly_balance_limit_exceeded" };
          }
        }
        
        // CONSTRAINT 5: Check preferred shift type (if required)
        let preferenceMatch = true;
        let preferenceReason = null;
        if (requirePreferredShift && selectedShift.shiftType) {
          if (candidate.preferredShift && candidate.preferredShift !== "none") {
            if (candidate.preferredShift !== selectedShift.shiftType) {
              preferenceMatch = false;
              preferenceReason = "preferred_shift_mismatch";
            }
          }
        }
        
        if (requirePreferredShift && !preferenceMatch) {
          return { valid: false, reason: preferenceReason || "preference_not_met" };
        }
        
        return { 
          valid: true, 
          preferenceMatch,
          hasPreferredShift: candidate.preferredShift && candidate.preferredShift !== "none"
        };
      };

      // Use real-time batch counts (updated as we process shifts in this loop)
      // This ensures we rotate properly - each assignment increases the count immediately

      // Track assignments made in THIS batch on THIS date
      const batchAssignmentsOnThisDate = new Map();
      Array.from(assignedEmployeeIndices).forEach(idx => {
        const emp = employees[idx];
        if (emp && hasShiftDate) {
          const empIdStr = emp._id.toString();
          const existingAssignment = updates.find(u => 
            u.employeeIdStr === empIdStr && 
            u.shift?.date === shiftDate
          );
          if (existingAssignment) {
            batchAssignmentsOnThisDate.set(empIdStr, true);
          }
        }
      });

      // STRICT PREFERENCE-BASED ASSIGNMENT
      // CRITICAL: For THIS shift type, FIRST look ONLY at employees who prefer this shift type.
      // ONLY if NO employees with this preference are available, then consider others.
      
      const shiftType = selectedShift.shiftType || "morning";
      // Normalize shiftType for consistent comparison
      const normalizedShiftTypeForLoop = (shiftType || "morning").toString().toLowerCase().trim();
      
      // Build candidate lists - STRICT preference checking
      let preferenceMatchedCandidates = [];
      let fallbackCandidates = [];
      
      for (let idx = 0; idx < shiftScores.length; idx++) {
        const candidate = employees[idx];
        if (!candidate) continue;
        
        // Get REAL-TIME batch count (updates as we process shifts)
        const realTimeBatchCount = batchAssignmentCountsByEmployeeId.get(candidate._id.toString()) || 0;
        const hungarianCount = employeeAssignmentCounts.get(idx) || 0;
        const isAIRecommended = aiAssignment?.candidate_index === idx;
        const employeeIdStr = candidate._id.toString();
        
        // Check constraints (availability, limits, etc.)
        const constraintCheck = checkConstraints(idx, false);
        if (!constraintCheck.valid) continue;
        
        // Check if already assigned on this specific date
        let alreadyOnThisDate = false;
        if (hasShiftDate) {
          const datesForEmployee = employeeAssignedDates.get(employeeIdStr);
          if (datesForEmployee?.has(shiftDate)) {
            alreadyOnThisDate = true;
          }
          if (batchAssignmentsOnThisDate.has(employeeIdStr)) {
            alreadyOnThisDate = true;
          }
        }
        
        // STRICT PREFERENCE CHECK: Does this employee prefer THIS shift type?
        // Normalize values for comparison (handle case sensitivity, whitespace, etc.)
        const employeePreferredShift = (candidate.preferredShift || "none").toString().toLowerCase().trim();
        const strictlyMatchesPreference = (employeePreferredShift !== "none" && employeePreferredShift === normalizedShiftTypeForLoop);
        
        const candidateData = {
          idx,
          score: shiftScores[idx] || 0,
          candidate,
          employeeIdStr,
          batchAssignmentCount: realTimeBatchCount,
          realTimeBatchCount: realTimeBatchCount,
          hungarianCount,
          isAIRecommended,
          alreadyOnThisDate,
          availability: candidate.availability,
          preferredShift: employeePreferredShift,
          preferenceMatch: strictlyMatchesPreference,
          hasPreferredShift: employeePreferredShift !== "none"
        };
        
        // STRICT CATEGORIZATION: Only employees who EXACTLY match the shift type preference go to preferenceMatchedCandidates
        if (strictlyMatchesPreference) {
          preferenceMatchedCandidates.push(candidateData);
        } else {
          // All others (no preference, different preference) go to fallback
          fallbackCandidates.push(candidateData);
        }
      }
      
      // ABSOLUTELY STRICT PREFERENCE-FIRST SELECTION
      // CRITICAL RULE: For THIS shift type, FIRST look ONLY at employees who prefer this shift type.
      // NEVER consider fallback candidates if ANY preference-matched candidate exists (even with many shifts).
      // ONLY if NO preference-matched candidates exist at all (they all failed constraints), then consider fallback.
      
      // First, check if ANY employees prefer this shift type (in the full employee list, before constraint filtering)
      const allEmployeesWhoPreferThisShift = employees.filter(e => {
        const empPref = (e.preferredShift || "none").toString().toLowerCase().trim();
        return empPref !== "none" && empPref === normalizedShiftTypeForLoop;
      });
      
      console.log(`  🔍 Shift Type: "${shiftType}" (normalized: "${normalizedShiftTypeForLoop}")`);
      console.log(`  📊 Total employees who prefer ${normalizedShiftTypeForLoop}: ${allEmployeesWhoPreferThisShift.length}`);
      if (allEmployeesWhoPreferThisShift.length > 0) {
        console.log(`     - Employees: ${allEmployeesWhoPreferThisShift.map(e => `${e.name}(${(e.preferredShift || "none").toString().toLowerCase().trim()})`).join(", ")}`);
      }
      console.log(`  📊 Preference-matched candidates (after constraints): ${preferenceMatchedCandidates.length}`);
      if (preferenceMatchedCandidates.length > 0) {
        console.log(`     - Candidates: ${preferenceMatchedCandidates.map(c => `${c.candidate.name}(${(c.candidate.preferredShift || "none").toString().toLowerCase().trim()})`).join(", ")}`);
      }
      console.log(`  📊 Fallback candidates (after constraints): ${fallbackCandidates.length}`);
      
      // Get TOTAL shift counts from database for each candidate
      preferenceMatchedCandidates.forEach(c => {
        c.totalShiftsFromDB = employeeShiftCounts.get(c.employeeIdStr) || 0;
        c.realTimeBatchCount = batchAssignmentCountsByEmployeeId.get(c.employeeIdStr) || 0;
      });
      fallbackCandidates.forEach(c => {
        c.totalShiftsFromDB = employeeShiftCounts.get(c.employeeIdStr) || 0;
        c.realTimeBatchCount = batchAssignmentCountsByEmployeeId.get(c.employeeIdStr) || 0;
      });
      
      let candidatesFiltered = [];
      
      // ABSOLUTE RULE: If ANY preference-matched candidates exist (passed constraints), USE ONLY THEM
      // Even if they have 10 shifts and fallback candidates have 0 shifts!
      if (preferenceMatchedCandidates.length > 0) {
        // PREFERENCE-MATCHED CANDIDATES EXIST: STRICTLY USE ONLY THEM (NO EXCEPTIONS)
        // Within preference-matched candidates, prioritize by fairness (0 shifts first, then minimum shifts)
        
        const preferenceMatchedWithZeroShifts = preferenceMatchedCandidates.filter(c => c.totalShiftsFromDB === 0);
        const preferenceMatchedWithShifts = preferenceMatchedCandidates.filter(c => c.totalShiftsFromDB > 0);
        
        console.log(`  ✅ STRICT PREFERENCE-FIRST: Using ${preferenceMatchedCandidates.length} preference-matched candidates ONLY for ${normalizedShiftTypeForLoop} shift`);
        console.log(`     - ${preferenceMatchedWithZeroShifts.length} with 0 shifts, ${preferenceMatchedWithShifts.length} with existing shifts`);
        console.log(`     - IGNORING ${fallbackCandidates.length} fallback candidates (even if they have fewer shifts!)`);
        
        if (preferenceMatchedWithZeroShifts.length > 0) {
          // Within preference-matched: prioritize those with 0 shifts
          candidatesFiltered = preferenceMatchedWithZeroShifts;
          console.log(`     → Selecting from ${preferenceMatchedWithZeroShifts.length} preference-matched employees with 0 shifts`);
        } else {
          // Within preference-matched: find minimum shifts
          // CRITICAL: Even if preference-matched employees have 10 shifts, we use them over fallback with 0 shifts!
          const minTotalShifts = Math.min(...preferenceMatchedWithShifts.map(c => c.totalShiftsFromDB));
          candidatesFiltered = preferenceMatchedWithShifts.filter(c => c.totalShiftsFromDB === minTotalShifts);
          console.log(`     → Selecting from ${candidatesFiltered.length} preference-matched employees with minimum ${minTotalShifts} shifts`);
          console.log(`     ⚠️ NOTE: Using preference-matched employees even if fallback candidates have fewer shifts!`);
        }
        
        console.log(`     Candidates: ${candidatesFiltered.map(c => `${c.candidate.name}(${c.preferredShift}, total:${c.totalShiftsFromDB}, batch:${c.realTimeBatchCount})`).join(", ")}`);
      } else if (allEmployeesWhoPreferThisShift.length > 0) {
        // Edge case: Employees who prefer this shift exist, but ALL failed constraints
        // This means they're unavailable, over capacity, etc. In this case, we can fall back.
        console.log(`  ⚠️ EDGE CASE: ${allEmployeesWhoPreferThisShift.length} employees prefer ${normalizedShiftTypeForLoop}, but ALL failed constraints (unavailable/over capacity)`);
        console.log(`     → Falling back to non-preferred candidates`);
        
        const fallbackWithZeroShifts = fallbackCandidates.filter(c => c.totalShiftsFromDB === 0);
        const fallbackWithShifts = fallbackCandidates.filter(c => c.totalShiftsFromDB > 0);
        
        if (fallbackWithZeroShifts.length > 0) {
          candidatesFiltered = fallbackWithZeroShifts;
          console.log(`     → Selecting from ${fallbackWithZeroShifts.length} fallback employees with 0 shifts`);
        } else if (fallbackCandidates.length > 0) {
          const minTotalShifts = Math.min(...fallbackWithShifts.map(c => c.totalShiftsFromDB));
          candidatesFiltered = fallbackWithShifts.filter(c => c.totalShiftsFromDB === minTotalShifts);
          console.log(`     → Selecting from ${candidatesFiltered.length} fallback employees with minimum ${minTotalShifts} shifts`);
        }
        
        if (candidatesFiltered.length > 0) {
          console.log(`     Candidates: ${candidatesFiltered.map(c => `${c.candidate.name}(${c.preferredShift || "none"}, total:${c.totalShiftsFromDB}, batch:${c.realTimeBatchCount})`).join(", ")}`);
        }
      } else {
        // NO employees prefer this shift type at all - use fallback
        console.log(`  ⚠️ FALLBACK: No employees prefer ${normalizedShiftTypeForLoop} shift at all. Using fallback candidates.`);
        
        const fallbackWithZeroShifts = fallbackCandidates.filter(c => c.totalShiftsFromDB === 0);
        const fallbackWithShifts = fallbackCandidates.filter(c => c.totalShiftsFromDB > 0);
        
        if (fallbackWithZeroShifts.length > 0) {
          candidatesFiltered = fallbackWithZeroShifts;
          console.log(`     → Selecting from ${fallbackWithZeroShifts.length} fallback employees with 0 shifts`);
        } else if (fallbackCandidates.length > 0) {
          const minTotalShifts = Math.min(...fallbackWithShifts.map(c => c.totalShiftsFromDB));
          candidatesFiltered = fallbackWithShifts.filter(c => c.totalShiftsFromDB === minTotalShifts);
          console.log(`     → Selecting from ${candidatesFiltered.length} fallback employees with minimum ${minTotalShifts} shifts`);
        }
        
        if (candidatesFiltered.length > 0) {
          console.log(`     Candidates: ${candidatesFiltered.map(c => `${c.candidate.name}(${c.preferredShift || "none"}, total:${c.totalShiftsFromDB}, batch:${c.realTimeBatchCount})`).join(", ")}`);
        }
      }
      
      candidatesFiltered.sort((a, b) => {
        // Priority 1: Prefer employees with FEWER TOTAL shifts (from database)
        if (a.totalShiftsFromDB !== b.totalShiftsFromDB) {
          return a.totalShiftsFromDB - b.totalShiftsFromDB;
        }
        
        // Priority 2: Among same TOTAL shifts, rotate based on batch assignments (real-time)
        if (a.realTimeBatchCount !== b.realTimeBatchCount) {
          return a.realTimeBatchCount - b.realTimeBatchCount;
        }
        
        // Priority 3: Prefer employees NOT already assigned on this date
        if (a.alreadyOnThisDate !== b.alreadyOnThisDate) {
          return a.alreadyOnThisDate ? 1 : -1;
        }
        
        // Priority 4: Prefer preference match
        if (a.preferenceMatch !== b.preferenceMatch) {
          return b.preferenceMatch ? 1 : -1;
        }
        
        // Priority 5: Prefer Hungarian algorithm's choice (but only as tiebreaker)
        if (a.isAIRecommended !== b.isAIRecommended) {
          return b.isAIRecommended ? 1 : -1;
        }
        
        // Priority 6: Higher availability
        if (Math.abs(a.availability - b.availability) > 0.1) {
          return b.availability - a.availability;
        }
        
        // Priority 7: Higher score (LAST - fairness is enforced by filtering above)
        return (b.score ?? -Infinity) - (a.score ?? -Infinity);
      });

      // FINAL VERIFICATION: Ensure we're selecting from the correct group
      if (candidatesFiltered.length > 0) {
        const selectedFromPreferenceMatched = candidatesFiltered[0].preferenceMatch === true;
        const selectedShiftType = candidatesFiltered[0].preferredShift;
        console.log(`  ✅ FINAL SELECTION: ${candidatesFiltered.length} candidates filtered`);
        console.log(`     - Selecting from ${selectedFromPreferenceMatched ? 'PREFERENCE-MATCHED' : 'FALLBACK'} candidates`);
        console.log(`     - Selected candidate's preference: ${selectedShiftType || 'none'}`);
        console.log(`     - Shift type needed: ${normalizedShiftTypeForLoop}`);
        
        // CRITICAL CHECK: If we have preference-matched candidates but selected fallback, something is wrong!
        if (preferenceMatchedCandidates.length > 0 && !selectedFromPreferenceMatched) {
          console.error(`  ❌ ERROR: Preference-matched candidates exist (${preferenceMatchedCandidates.length}) but selected fallback!`);
          console.error(`     This should NEVER happen - there's a bug in the filtering logic!`);
        }
      }
      
      // Select the best candidate from filtered list (fairness enforced by filtering)
      if (candidatesFiltered.length > 0) {
        const best = candidatesFiltered[0];
        
        // DOUBLE-CHECK: Make absolutely sure this employee isn't already assigned in batch
        if (assignedEmployeeIndices.has(best.idx) || assignedEmployeeIds.has(best.employeeIdStr)) {
          console.log(`  ⚠️ WARNING: ${best.candidate.name} was already assigned, skipping...`);
          // Try next candidate
          if (candidatesFiltered.length > 1) {
            const nextBest = candidatesFiltered[1];
            chosenCandidate = {
              employee: nextBest.candidate,
              employeeIdStr: nextBest.employeeIdStr,
              score: nextBest.score
            };
            console.log(`  ✓ Assigning to: ${chosenCandidate.employee.name} - fallback candidate`);
          }
        } else {
          chosenCandidate = {
            employee: best.candidate,
            employeeIdStr: best.employeeIdStr,
            score: best.score
          };
          
          const assignmentReason = best.totalShiftsFromDB === 0 
            ? `FAIR (0 TOTAL shifts - giving first assignment)` 
            : best.totalShiftsFromDB < Math.min(...Array.from(employeeShiftCounts.values()).filter(v => v > 0), Infinity)
            ? `FAIR (${best.totalShiftsFromDB} TOTAL shifts - below average)`
            : best.preferenceMatch 
            ? `preference match (${best.preferredShift})`
            : best.isAIRecommended 
            ? "AI recommended" 
            : `fair (${best.totalShiftsFromDB} TOTAL, ${best.realTimeBatchCount} batch)`;
          console.log(`  ✓ Assigning to: ${chosenCandidate.employee.name} - ${assignmentReason}`);
        }
      }
      
      // If still no candidate, log detailed info for debugging
      if (!chosenCandidate && viableCandidates.length > 0) {
        console.log(`  ❌ DEBUG: ${viableCandidates.length} viable candidates but none selected. Reasons:`);
        viableCandidates.slice(0, 5).forEach(c => {
          console.log(`    - ${c.candidate.name}: batch=${c.batchAssignmentCount}, alreadyOnDate=${c.alreadyOnThisDate}, assigned=${assignedEmployeeIndices.has(c.idx)}`);
        });
      }

      if (!chosenCandidate) {
        console.log(
          `⚠️ No eligible candidate found for shift ${selectedShift._id} on ${shiftDate || "unspecified date"}. Skipping.`
        );
        continue;
      }
      
      console.log(
        `✅ Assigning shift ${shiftIndex} (${shiftDate || "no date"}) to employee ${chosenCandidate.employee.name} (idx: ${chosenCandidate.employeeIdStr.substring(0, 8)})`
      );

      const { employee: selectedEmployee, employeeIdStr, score } = chosenCandidate;

      // Get previous assignment info if any (though should be null at this point)
      const previousAssignedTo = selectedShift.assignedTo;
      let previousEmployee = null;
      if (previousAssignedTo) {
        previousEmployee = await Employee.findById(previousAssignedTo);
      }

      // Mark this employee as assigned in this batch (CRITICAL for rotation)
      assignedEmployeeIds.add(employeeIdStr);
      const employeeIndex = employees.findIndex(e => e._id.toString() === employeeIdStr);
      if (employeeIndex >= 0) {
        assignedEmployeeIndices.add(employeeIndex);
      }
      
      // Update real-time batch count for rotation (MUST happen immediately)
      const currentCount = batchAssignmentCountsByEmployeeId.get(employeeIdStr) || 0;
      batchAssignmentCountsByEmployeeId.set(employeeIdStr, currentCount + 1);
      
      // ALSO update the TOTAL counts map (so next shifts in this batch see the updated total)
      const previousTotal = employeeShiftCounts.get(employeeIdStr) || 0;
      employeeShiftCounts.set(employeeIdStr, previousTotal + 1);
      
      console.log(`  📊 Updated counts: ${selectedEmployee.name} - TOTAL: ${previousTotal}→${previousTotal + 1}, Batch: ${currentCount}→${currentCount + 1}`);

      // IMMEDIATELY update the date/week/month tracking maps so next shifts know this employee is taken
      if (hasShiftDate) {
        if (!employeeAssignedDates.has(employeeIdStr)) {
          employeeAssignedDates.set(employeeIdStr, new Map());
        }
        const dateMap = employeeAssignedDates.get(employeeIdStr);
        dateMap.set(shiftDate, (dateMap.get(shiftDate) || 0) + 1);
        
        if (!employeeAssignedWeeks.has(employeeIdStr)) {
          employeeAssignedWeeks.set(employeeIdStr, new Map());
        }
        const weekMap = employeeAssignedWeeks.get(employeeIdStr);
        weekMap.set(shiftWeek, (weekMap.get(shiftWeek) || 0) + 1);
        
        if (!employeeAssignedMonths.has(employeeIdStr)) {
          employeeAssignedMonths.set(employeeIdStr, new Map());
        }
        const monthMap = employeeAssignedMonths.get(employeeIdStr);
        monthMap.set(shiftMonth, (monthMap.get(shiftMonth) || 0) + 1);
      }

      selectedShift.assignedTo = selectedEmployee._id;
      await selectedShift.save();

      try {
        const fromMessage = previousEmployee 
          ? ` (transferred from ${previousEmployee.name})` 
          : "";
        await AuditLog.create({
          action: "ai_assign",
          actor: "ai",
          message: `AI assigned ${selectedEmployee.name}${fromMessage}`,
          before: { 
            assignedTo: previousAssignedTo,
            previousEmployeeId: previousEmployee?._id || null,
            previousEmployeeName: previousEmployee?.name || null,
            shiftId: selectedShift._id 
          },
          after: { 
            assignedTo: selectedEmployee._id,
            newEmployeeName: selectedEmployee.name
          },
          metadata: { score, date: selectedShift.date, urgency: selectedShift.urgency },
        });
      } catch (e) {
        console.error("Audit log failed (assign):", e.message);
      }

      assignedEmployeeIds.add(employeeIdStr);
      selectedEmployee.recent_swaps = Math.min(
        (selectedEmployee.recent_swaps || 0) + 1,
        5
      );
      await selectedEmployee.save();

      // Note: Date/week tracking already updated above before saving

      if (selectedEmployee.email) {
        await sendEmail(
          selectedEmployee.email,
          "Shift Assigned Successfully ✅",
          `Hi ${selectedEmployee.name},\n\nYou have been assigned a new shift with urgency level ${selectedShift.urgency}.\n\nBest,\nShiftAI`
        );
      }

      await sendEmail(
        process.env.SUPERVISOR_EMAIL,
        "Shift Assignment Updated ⚙️",
        `Employee ${selectedEmployee.name} has been assigned to shift ID: ${selectedShift._id}.`
      );

      updates.push({
        shift: selectedShift,
        employee: selectedEmployee,
        score,
      });
    }

    // Slightly reduce recent_swaps for employees not assigned, so they become more eligible next round
    const decayPromises = employees
      .filter((e) => !assignedEmployeeIds.has(e._id.toString()))
      .map((e) => {
        if ((e.recent_swaps || 0) > 0) {
          e.recent_swaps = Math.max((e.recent_swaps || 0) - 1, 0);
          return e.save();
        }
        return Promise.resolve();
      });

  await Promise.all(decayPromises);

  // ✅ Return all assignments made
  return {
    message: `✅ All shifts assigned successfully using ${aiUsed ? "AI (Machine Learning Model)" : "fallback logic"}!`,
    assignments: updates,
    raw_scores: result.raw_scores,
    aiUsed: aiUsed,
  };
}

// ✅ Intelligent AI-based shift assignment (manual trigger)
app.post("/api/assign", verifyToken, isSupervisor, async (req, res) => {
  try {
    console.log("🤖 AI Assignment triggered by supervisor");
    const result = await assignUnassignedWithAI();
    res.json(result);
  } catch (err) {
    console.error("❌ AI assignment error:", err.message);
    res.status(500).json({ error: "AI assignment failed", details: err.message });
  }
});
// ✅ Analytics endpoint
app.get("/api/analytics", verifyToken, isSupervisor, async (req, res) => {
    try {
      const employees = await Employee.find();
      const shifts = await Shift.find().populate("assignedTo");
  
      const totalEmployees = employees.length;
      const totalShifts = shifts.length;
      const assignedShifts = shifts.filter((s) => s.assignedTo).length;
  
      // Calculate shift distribution per employee
      const shiftDistribution = employees.map((emp) => ({
        name: emp.name,
        shiftsAssigned: shifts.filter((s) => s.assignedTo?._id.equals(emp._id)).length,
      }));
  
      // Urgency distribution
      const urgencyLevels = shifts.map((s) => s.urgency);
      const avgUrgency =
        urgencyLevels.length > 0
          ? urgencyLevels.reduce((a, b) => a + b, 0) / urgencyLevels.length
          : 0;
  
      res.json({
        totalEmployees,
        totalShifts,
        assignedShifts,
        shiftDistribution,
        avgUrgency,
      });
    } catch (err) {
      console.error("Analytics error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });
// ✅ Update Employee Availability (Employee only)
app.put("/api/update-availability", verifyToken, async (req, res) => {
    try {
      const { availability } = req.body;
      if (typeof availability !== "number" || availability < 0 || availability > 1) {
        return res.status(400).json({ error: "Availability must be a number between 0 and 1." });
      }

      // Link user -> employee by email from token
      const userEmail = req.user?.email;
      if (!userEmail) {
        return res.status(400).json({ error: "User email missing from token" });
      }

      const emp = await Employee.findOne({ email: userEmail });
      if (!emp) return res.status(404).json({ error: "Employee not found" });

      emp.availability = availability;
      await emp.save();

      // AUTOMATIC REASSIGNMENT: If employee becomes unavailable, free all their assigned shifts
      if (availability === 0) {
        try {
          const affected = await Shift.find({ assignedTo: emp._id });
          const affectedCount = affected.length;
          
          if (affectedCount > 0) {
          await Shift.updateMany({ assignedTo: emp._id }, { $set: { assignedTo: null } });
            
            // Audit logs
            for (const s of affected) {
              try {
                await AuditLog.create({
                  action: "ai_unassign",
                  actor: "ai",
                  message: `Auto-unassigned ${emp.name} due to unavailability`,
                  before: { assignedTo: emp._id, shiftId: s._id },
                  after: { assignedTo: null },
                  metadata: { date: s.date, urgency: s.urgency },
                });
              } catch (e) {
                console.error("Audit log failed (unassign PUT):", e.message);
              }
            }
            
            console.log(`🔄 Auto-reassignment: Freed ${affectedCount} shifts from ${emp.name}`);
          }
        } catch (e) {
          console.error("Unassign on unavailability (PUT) failed:", e.message);
        }
      }

      res.json({ message: "Availability updated successfully", emp });
      
      // AUTOMATIC REASSIGNMENT: Always trigger auto-assign after availability changes
      console.log("🔄 Triggering automatic reassignment after availability update...");
      assignUnassignedWithAI().catch((e) =>
        console.error("Auto-assign after availability update failed:", e.message)
      );
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
// ================= Monitoring Module =================
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function weekKey(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const dayNum = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dayNum + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Employee: Check-in
app.post("/api/monitor/check-in", verifyToken, async (req, res) => {
  try {
    const userEmail = req.user?.email;
    const employee = await Employee.findOne({ email: userEmail });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const date = todayStr();
    const record = await Attendance.findOneAndUpdate(
      { employee: employee._id, date },
      { $setOnInsert: { employee: employee._id, date }, $set: { checkInAt: new Date() } },
      { upsert: true, new: true }
    );
    res.json({ message: "Checked in", attendance: record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Employee: Check-out
app.post("/api/monitor/check-out", verifyToken, async (req, res) => {
  try {
    const userEmail = req.user?.email;
    const employee = await Employee.findOne({ email: userEmail });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const date = todayStr();
    const record = await Attendance.findOneAndUpdate(
      { employee: employee._id, date },
      { $set: { checkOutAt: new Date() } },
      { new: true }
    );
    res.json({ message: "Checked out", attendance: record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sudden leave request endpoint disabled for now

// Supervisor: List issues
app.get("/api/monitor/issues", verifyToken, isSupervisor, async (req, res) => {
  try {
    const issues = await Issue.find({ resolved: false }).sort({ createdAt: -1 });
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supervisor: Resolve issue
app.post("/api/monitor/issues/:id/resolve", verifyToken, isSupervisor, async (req, res) => {
  try {
    const issue = await Issue.findByIdAndUpdate(req.params.id, { resolved: true }, { new: true });
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    res.json({ message: "Issue resolved", issue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Audit logs (supervisor)
app.get("/api/audit-logs", verifyToken, isSupervisor, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Periodic scanner for automatic issue detection
async function runMonitoringScan() {
  try {
    const today = todayStr();

    // 1) Understaffed shifts (no assignment)
    const understaffed = await Shift.find({ assignedTo: null });
    for (const s of understaffed) {
      await Issue.create({
        type: "understaffed_shift",
        severity: s.urgency >= 0.8 ? "high" : s.urgency >= 0.5 ? "medium" : "low",
        message: `Understaffed shift (urgency ${s.urgency}) on ${s.date || "unspecified date"}`,
        metadata: { shiftId: s._id, date: s.date, urgency: s.urgency },
      }).catch(() => {});
    }

    // 2) Possible absenteeism: assigned today, no check-in by 10:00
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 10) {
      const todaysAssigned = await Shift.find({ date: today, assignedTo: { $ne: null } }).populate("assignedTo");
      for (const s of todaysAssigned) {
        const att = await Attendance.findOne({ employee: s.assignedTo?._id, date: today });
        if (!att || !att.checkInAt) {
          await Issue.create({
            type: "possible_absenteeism",
            severity: "medium",
            message: `No check-in for ${s.assignedTo?.name || "employee"} on ${today}`,
            metadata: { shiftId: s._id, employeeId: s.assignedTo?._id, date: today },
          }).catch(() => {});
        }
      }
    }
    // AUTOMATIC ASSIGNMENT: Auto-assign periodically if unassigned shifts exist
    const unassignedCount = await Shift.countDocuments({ assignedTo: null });
    if (unassignedCount > 0) {
      console.log(`🔄 Periodic auto-assignment: Found ${unassignedCount} unassigned shifts`);
      await assignUnassignedWithAI().catch((e) =>
        console.error("Auto-assign in scanner failed:", e.message)
      );
    }
    
    // AUTOMATIC REASSIGNMENT: Check for shifts assigned to unavailable employees
    try {
      const unavailableEmployees = await Employee.find({ availability: 0 });
      const unavailableIds = unavailableEmployees.map(e => e._id);
      if (unavailableIds.length > 0) {
        const shiftsToReassign = await Shift.find({ 
          assignedTo: { $in: unavailableIds } 
        });
        if (shiftsToReassign.length > 0) {
          console.log(`🔄 Found ${shiftsToReassign.length} shifts assigned to unavailable employees, reassigning...`);
          await Shift.updateMany(
            { assignedTo: { $in: unavailableIds } },
            { $set: { assignedTo: null } }
          );
          // Trigger reassignment
          await assignUnassignedWithAI().catch((e) =>
            console.error("Auto-reassign in scanner failed:", e.message)
          );
        }
      }
    } catch (e) {
      console.error("Reassignment check failed:", e.message);
    }
  } catch (err) {
    console.error("Monitoring scan error:", err.message);
  }
}

setInterval(runMonitoringScan, 5 * 60 * 1000);
runMonitoringScan();

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`🚀 Backend running on port ${port}`));
