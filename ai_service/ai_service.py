from flask import Flask, request, jsonify
import numpy as np
import joblib

app = Flask(__name__)

# --- Load trained model ---
try:
    model = joblib.load("model.pkl")
    print("✅ AI model loaded successfully.")
except Exception as e:
    model = None
    print(f"⚠️ Warning: model not loaded properly - {e}")

@app.route("/score_and_assign", methods=["POST"])
def score_and_assign():
    data = request.json or {}
    shifts = data.get("shifts", [])
    candidates = data.get("candidates", [])

    if not shifts or not candidates:
        return jsonify({"error": "Provide 'shifts' and 'candidates'"}), 400

    if model is None:
        return jsonify({"error": "AI model not loaded. Please train the model first."}), 500

    print(f"🤖 AI Model: Analyzing {len(shifts)} shifts with {len(candidates)} candidates...")
    
    # We'll use the AI model to compute scores
    raw_scores = np.zeros((len(shifts), len(candidates)))

    for i, s in enumerate(shifts):
        for j, c in enumerate(candidates):
            # Extract base features
            skill_match = float(c.get("skill_match", 0))
            preference = float(c.get("preference", 0))
            availability = float(c.get("availability", 1))
            attendance_score = float(c.get("attendance_score", 1))
            recent_swaps = float(c.get("recent_swaps", 0))
            urgency = float(s.get("urgency", 0))
            
            # FAIRNESS FEATURES: Multiple fairness metrics
            shifts_already_assigned = float(c.get("shifts_already_assigned", 0))
            shifts_relative_to_average = float(c.get("shifts_relative_to_average", 0))
            shifts_normalized = float(c.get("shifts_normalized", 0))
            fairness_score = float(c.get("fairness_score", 1.0))
            
            # Fallback normalization if not provided
            if shifts_normalized == 0 and shifts_already_assigned > 0:
                shifts_normalized = min(shifts_already_assigned / 10.0, 1.0)
            if fairness_score == 1.0 and shifts_normalized > 0:
                fairness_score = 1.0 - shifts_normalized
            if shifts_relative_to_average == 0:
                avg_shifts = float(c.get("average_shifts_per_employee", 0))
                if avg_shifts > 0:
                    shifts_relative_to_average = shifts_already_assigned / avg_shifts
                else:
                    shifts_relative_to_average = 0
            
            # Engineer features (must match training data exactly)
            skill_preference_interaction = skill_match * preference
            availability_skill = availability * skill_match
            attendance_preference = attendance_score * preference
            urgency_skill = urgency * skill_match
            swap_penalty = recent_swaps / 5.0  # Normalized
            unavailability_penalty = (1 - availability) * 2.0
            
            # Composite scores
            reliability_score = attendance_score * 0.6 + (1 - swap_penalty) * 0.4
            fitness_score = skill_match * 0.5 + preference * 0.3 + reliability_score * 0.2
            
            # Feature vector matching training (order matters!)
            x = np.array([[
                skill_match,
                preference,
                availability,
                attendance_score,
                recent_swaps,
                urgency,
                shifts_already_assigned / 10.0,  # Normalized absolute count
                shifts_relative_to_average,  # Relative to team average
                shifts_normalized,  # Normalized 0-1
                fairness_score,  # Inverse fairness
                skill_preference_interaction,
                availability_skill,
                attendance_preference,
                urgency_skill,
                swap_penalty,
                reliability_score,
                fitness_score
            ]])

            # AI Model makes the prediction
            score = model.predict(x)[0]
            raw_scores[i, j] = score

    # --- AI Optimization: Use Hungarian algorithm to find optimal assignments ---
    from scipy.optimize import linear_sum_assignment
    cost = -raw_scores  # Negative because we want to maximize scores
    rows, cols = linear_sum_assignment(cost)

    assignments = [
        {"shift_index": int(r), "candidate_index": int(c), "score": float(raw_scores[r, c])}
        for r, c in zip(rows, cols)
    ]

    print(f"✅ AI Model: Generated {len(assignments)} optimal assignments")
    
    return jsonify({
        "assignments": assignments,
        "raw_scores": raw_scores.tolist()
    })


if __name__ == "__main__":
    app.run(port=5001, debug=True)
