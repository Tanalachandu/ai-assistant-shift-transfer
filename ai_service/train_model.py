import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import joblib
import warnings
warnings.filterwarnings('ignore')

print("🚀 Starting Enhanced AI Model Training...")
print("=" * 60)

# --- Step 1: Enhanced Synthetic Dataset Generation ---
N = 15000  # Increased from 1000 to 15000 for better learning
np.random.seed(42)

print(f"📊 Generating {N:,} training samples...")

# More realistic distributions
data = pd.DataFrame({
    # Skill match: Most employees have decent skills, few experts
    "skill_match": np.clip(np.random.beta(2, 1, N), 0, 1),
    
    # Preference: Bimodal - some love work, some neutral
    "preference": np.clip(np.random.beta(1.5, 1.5, N), 0, 1),
    
    # Availability: Mostly available (0 or 1)
    "availability": np.random.choice([0, 1], N, p=[0.15, 0.85]),
    
    # Attendance: Most have good attendance, few poor
    "attendance_score": np.clip(np.random.beta(3, 1, N), 0.5, 1.0),
    
    # Recent swaps: Most have 0-2, few have many
    "recent_swaps": np.random.poisson(1.5, N).clip(0, 5),
    
    # Urgency: Various levels
    "urgency": np.clip(np.random.beta(1.5, 1.5, N), 0, 1),
    
    # FAIRNESS FEATURES: Multiple ways to measure fairness
    # Absolute count (normalized)
    "shifts_already_assigned": np.random.poisson(3, N).clip(0, 10) / 10.0,
})

# Calculate fairness features separately
avg_shifts = np.random.uniform(2, 6, N)
shifts_count = np.random.poisson(avg_shifts, N).clip(0, 10)
max_shifts = 10

data["shifts_relative_to_average"] = np.where(avg_shifts > 0, shifts_count / avg_shifts, 0)
data["shifts_normalized"] = shifts_count / max_shifts
data["fairness_score"] = 1.0 - (shifts_count / max_shifts)

# --- Step 2: Advanced Feature Engineering ---
print("🔧 Engineering features...")

# Interaction features (capture complex relationships)
data["skill_preference_interaction"] = data["skill_match"] * data["preference"]
data["availability_skill"] = data["availability"] * data["skill_match"]
data["attendance_preference"] = data["attendance_score"] * data["preference"]
data["urgency_skill"] = data["urgency"] * data["skill_match"]

# Penalty features
data["swap_penalty"] = data["recent_swaps"] / 5.0  # Normalized penalty
data["unavailability_penalty"] = (1 - data["availability"]) * 2.0

# Composite scores
data["reliability_score"] = (
    data["attendance_score"] * 0.6 + 
    (1 - data["swap_penalty"]) * 0.4
)

data["fitness_score"] = (
    data["skill_match"] * 0.5 + 
    data["preference"] * 0.3 + 
    data["reliability_score"] * 0.2
)

# --- Step 3: Enhanced Target Score (Business Logic) ---
print("📐 Calculating target scores with advanced business logic...")

# Base score from core factors
base_score = (
    0.35 * data["skill_match"] +           # Skills are important
    0.20 * data["preference"] +             # Employee satisfaction
    0.15 * data["attendance_score"] +       # Reliability
    0.10 * data["urgency"] * data["skill_match"] +  # Urgent shifts need skills
    0.08 * data["reliability_score"]        # Overall reliability
)

# Bonuses (positive adjustments)
preference_bonus = np.where(
    (data["preference"] > 0.7) & (data["skill_match"] > 0.6),
    0.15, 0
)
high_skill_urgent_bonus = np.where(
    (data["skill_match"] > 0.8) & (data["urgency"] > 0.7),
    0.10, 0
)
excellent_attendance_bonus = np.where(
    data["attendance_score"] > 0.95,
    0.08, 0
)

# Penalties (negative adjustments)
unavailability_penalty = (1 - data["availability"]) * 0.8  # Heavy penalty
swap_penalty = data["recent_swaps"] * 0.12
low_skill_high_urgency_penalty = np.where(
    (data["skill_match"] < 0.4) & (data["urgency"] > 0.8),
    -0.20, 0
)
poor_attendance_penalty = np.where(
    data["attendance_score"] < 0.7,
    -0.15, 0
)

# FAIRNESS PENALTIES: Multiple fairness considerations
# Penalty based on absolute shifts
fairness_penalty_absolute = data["shifts_already_assigned"] * 0.4

# Penalty based on relative to average (if above average, penalize more)
fairness_penalty_relative = np.where(
    data["shifts_relative_to_average"] > 1.2,  # 20% above average
    (data["shifts_relative_to_average"] - 1.0) * 0.5,  # Extra penalty for being above average
    0
)

# Penalty based on normalized shifts
fairness_penalty_normalized = data["shifts_normalized"] * 0.3

# Total fairness penalty
fairness_penalty = fairness_penalty_absolute + fairness_penalty_relative + fairness_penalty_normalized

# Bonus for employees with zero assignments or below average
zero_assignment_bonus = np.where(data["shifts_already_assigned"] == 0, 0.30, 0)  # Big bonus for 0 shifts
below_average_bonus = np.where(
    data["shifts_relative_to_average"] < 0.8,  # 20% below average
    0.15, 0
)  # Bonus for being under-assigned

# Final target score (with comprehensive fairness considerations)
data["score"] = (
    base_score +
    preference_bonus +
    high_skill_urgent_bonus +
    excellent_attendance_bonus +
    zero_assignment_bonus +  # Fairness bonus (absolute)
    below_average_bonus +  # Fairness bonus (relative)
    unavailability_penalty +
    swap_penalty +
    fairness_penalty +  # Comprehensive fairness penalty
    low_skill_high_urgency_penalty +
    poor_attendance_penalty
)

# Normalize to reasonable range
data["score"] = data["score"].clip(-1.5, 1.5)

# --- Step 4: Prepare Features ---
feature_cols = [
    "skill_match", "preference", "availability", "attendance_score",
    "recent_swaps", "urgency",
    "shifts_already_assigned",  # Absolute count (normalized)
    "shifts_relative_to_average",  # Relative to team average
    "shifts_normalized",  # Normalized 0-1
    "fairness_score",  # Inverse fairness (1.0 = most fair)
    "skill_preference_interaction", "availability_skill", "attendance_preference",
    "urgency_skill", "swap_penalty", "reliability_score", "fitness_score"
]

X = data[feature_cols]
y = data["score"]

print(f"✅ Using {len(feature_cols)} features")
print(f"   Features: {', '.join(feature_cols[:6])}... + {len(feature_cols)-6} engineered features")

# --- Step 5: Train/Test Split ---
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)
print(f"\n📦 Train set: {len(X_train):,} samples")
print(f"📦 Test set: {len(X_test):,} samples")

# --- Step 6: Hyperparameter Tuning ---
print("\n🔍 Performing hyperparameter tuning...")
print("   This may take a few minutes...")

# Use smaller sample for faster tuning
tune_sample = min(5000, len(X_train))
X_tune = X_train[:tune_sample]
y_tune = y_train[:tune_sample]

base_model = GradientBoostingRegressor(random_state=42)

# Quick grid search (can be expanded for better results)
grid_search = GridSearchCV(
    base_model,
    {
        'n_estimators': [300, 400],
        'learning_rate': [0.05, 0.07],
        'max_depth': [5, 6],
        'subsample': [0.9, 1.0]
    },
    cv=3,
    scoring='neg_mean_squared_error',
    n_jobs=-1,
    verbose=0
)

grid_search.fit(X_tune, y_tune)
best_params = grid_search.best_params_
print(f"✅ Best parameters found: {best_params}")

# --- Step 7: Train Final Model with Best Parameters ---
print("\n🏋️ Training final model with optimized parameters...")
model = GradientBoostingRegressor(**best_params, random_state=42)
model.fit(X_train, y_train)

# --- Step 8: Comprehensive Evaluation ---
print("\n📊 Evaluating model performance...")

# Predictions
train_preds = model.predict(X_train)
test_preds = model.predict(X_test)

# Metrics
train_mse = mean_squared_error(y_train, train_preds)
test_mse = mean_squared_error(y_test, test_preds)
train_mae = mean_absolute_error(y_train, train_preds)
test_mae = mean_absolute_error(y_test, test_preds)
train_r2 = r2_score(y_train, train_preds)
test_r2 = r2_score(y_test, test_preds)

print(f"\n📈 Training Metrics:")
print(f"   MSE: {train_mse:.6f}")
print(f"   MAE: {train_mae:.6f}")
print(f"   R²:  {train_r2:.4f}")

print(f"\n📈 Test Metrics:")
print(f"   MSE: {test_mse:.6f}")
print(f"   MAE: {test_mae:.6f}")
print(f"   R²:  {test_r2:.4f}")

# Cross-validation
print("\n🔄 Performing 5-fold cross-validation...")
cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='neg_mean_squared_error')
cv_rmse = np.sqrt(-cv_scores)
print(f"   CV RMSE: {cv_rmse.mean():.6f} (+/- {cv_rmse.std() * 2:.6f})")

# Feature Importance
feature_importance = pd.DataFrame({
    'feature': feature_cols,
    'importance': model.feature_importances_
}).sort_values('importance', ascending=False)

print(f"\n🎯 Top 5 Most Important Features:")
for idx, row in feature_importance.head(5).iterrows():
    print(f"   {row['feature']:30s}: {row['importance']:.4f}")

# --- Step 9: Save Model and Metadata ---
print("\n💾 Saving model and metadata...")
joblib.dump(model, "model.pkl")
print("   ✅ Model saved as model.pkl")

# Save feature list and metadata
metadata = {
    'feature_names': feature_cols,
    'best_params': best_params,
    'train_mse': float(train_mse),
    'test_mse': float(test_mse),
    'train_r2': float(train_r2),
    'test_r2': float(test_r2),
    'cv_rmse_mean': float(cv_rmse.mean()),
    'feature_importance': feature_importance.to_dict('records')
}

joblib.dump(metadata, "model_metadata.pkl")
print("   ✅ Metadata saved as model_metadata.pkl")

print("\n" + "=" * 60)
print("✅ Training completed successfully!")
print(f"🎯 Model performance: R² = {test_r2:.4f}, RMSE = {np.sqrt(test_mse):.6f}")
print("🤖 The AI model is ready to make optimal shift assignments!")
print("=" * 60)
