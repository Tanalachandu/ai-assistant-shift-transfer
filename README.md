# 🤖 AI-Powered Shift Assignment System

An intelligent shift management system that automatically assigns employee shifts using machine learning, ensuring fairness, respecting preferences, and managing all constraints with minimal human intervention.

## 🌟 Features

### ✨ AI-Powered Assignment
- **Machine Learning Model**: Gradient Boosting Regressor trained on 15,000+ samples
- **Fairness-Aware**: Considers total shifts assigned, relative to team average
- **Performance-Based**: Factors in skills, attendance, and preferences
- **Optimal Matching**: Uses Hungarian algorithm for global optimal assignment

### ⚖️ Fair Distribution
- **Round-Robin Priority**: Employees with zero shifts get highest priority
- **Balanced Workload**: Prevents top performers from monopolizing shifts
- **Historical Context**: Tracks weekly, monthly, and total shift distribution
- **Relative Fairness**: Compares each employee's load to team average

### 🎯 Preference Management
- **Shift Type Preferences**: Honors morning/evening shift preferences
- **Strict Preference-First**: Prioritizes employees who prefer the shift type
- **Smart Fallback**: Only uses non-preferred employees when no preferred ones are available
- **Fairness Within Preference**: Ensures balanced rotation among preferred employees

### 🔒 Constraint Enforcement
- ✅ **No Multiple Shifts Per Day**: Enforces 1 shift per day maximum
- ✅ **Weekly Limits**: Enforces 5 shifts per week maximum
- ✅ **Monthly Balance**: Tracks and encourages balanced monthly distribution
- ✅ **Availability Check**: Only assigns to available employees
- ✅ **Real-Time Tracking**: Updates constraints immediately after each assignment

### 🔄 Automatic Reassignment
- **Availability Changes**: Automatically unassigns and reassigns when employees become unavailable
- **Periodic Monitoring**: Scans every 5 minutes for unassigned shifts and violations
- **Gap Prevention**: Ensures all shifts are covered efficiently
- **Audit Logging**: Records all automatic actions for transparency

### 📊 Analytics & Monitoring
- **Audit Logs**: Complete history of all assignments, transfers, and changes
- **Analytics Dashboard**: Track shift distribution, employee workload, and patterns
- **Real-Time Updates**: Live tracking of shift assignments and availability

## 🏗️ Architecture

The system consists of three main components:

```
ai-assistant-shift-transfer/
├── frontend/          # React frontend application
├── backend/           # Node.js/Express backend API
└── ai_service/        # Python Flask AI service
```

### Frontend (`frontend/`)
- React-based user interface
- Employee management
- Shift assignment interface
- Analytics dashboard
- Audit log viewer

### Backend (`backend/`)
- Express.js REST API
- MongoDB database
- JWT authentication
- Constraint enforcement
- Fairness algorithms
- Email notifications

### AI Service (`ai_service/`)
- Flask API for ML model inference
- Gradient Boosting model
- Hungarian algorithm for optimal matching
- Feature engineering and scoring

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v16 or higher)
- **Python** (v3.8 or higher)
- **MongoDB** (local or cloud instance)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Tanalachandu/ai-assistant-shift-transfer.git
   cd ai-assistant-shift-transfer
   ```

2. **Set up Backend**
   ```bash
   cd backend
   npm install
   ```
   
   Create a `.env` file in the `backend` directory:
   ```env
   MONGO_URI=mongodb://localhost:27017/shift-assignment
   JWT_SECRET=your-secret-key-here
   PORT=5000
   SUPERVISOR_EMAIL=supervisor@example.com
   AI_SERVICE_URL=http://localhost:5001
   ```

3. **Set up Frontend**
   ```bash
   cd frontend
   npm install
   ```
   
   Create a `.env` file in the `frontend` directory:
   ```env
   REACT_APP_API_URL=http://localhost:5000
   ```

4. **Set up AI Service**
   ```bash
   cd ai_service
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On Linux/Mac
   source venv/bin/activate
   
   pip install -r requirements.txt
   ```

5. **Train the AI Model** (First time setup)
   ```bash
   cd ai_service
   python train_model.py
   ```
   
   This will generate `model.pkl` and `model_metadata.pkl` files.

### Running the Application

1. **Start MongoDB** (if running locally)
   ```bash
   mongod
   ```

2. **Start Backend**
   ```bash
   cd backend
   npm start
   ```
   Backend will run on `http://localhost:5000`

3. **Start AI Service**
   ```bash
   cd ai_service
   python ai_service.py
   ```
   AI Service will run on `http://localhost:5001`

4. **Start Frontend**
   ```bash
   cd frontend
   npm start
   ```
   Frontend will run on `http://localhost:3000`

## 📖 Usage

### 1. Initial Setup

1. **Create a Supervisor Account**
   - Register at `/register`
   - Login credentials will be saved in MongoDB

2. **Add Employees**
   - Go to Employee Management
   - Add employees with:
     - Name, Email
     - Skill Match (0-1)
     - Availability (0-1)
     - Attendance Score (0-1)
     - **Preferred Shift Type** (`morning`, `evening`, or `none`)

3. **Create Shifts**
   - Go to Shift Management
   - Create shifts with:
     - Date
     - Shift Type (`morning` or `evening`)
     - Urgency (0-1)

### 2. Automatic Assignment

1. **AI Assignment**
   - Go to "Assign Shift" page
   - Click "Assign Shifts Using AI"
   - The AI will analyze all unassigned shifts and make optimal assignments

2. **Preference-First Logic**
   - For evening shifts: Only considers employees who prefer "evening" first
   - For morning shifts: Only considers employees who prefer "morning" first
   - Only falls back to non-preferred employees if no preferred ones are available

3. **Fairness Enforcement**
   - Employees with 0 total shifts get highest priority
   - Among same preference group, prioritizes those with fewer shifts
   - Ensures balanced rotation over time

### 3. Manual Override

- Supervisors can manually assign/transfer shifts
- Manual assignments are logged in audit trail
- Manual assignments respect constraints (no multiple shifts per day)

### 4. Monitoring

- **Audit Logs**: View all assignment actions and changes
- **Analytics**: Track shift distribution and employee workload
- **Real-Time**: System automatically reassigns when availability changes

## 🔧 Configuration

### Backend Constants

In `backend/server.js`, you can adjust:

```javascript
const DEFAULT_MAX_SHIFTS_PER_DAY = 1;
const DEFAULT_MAX_SHIFTS_PER_WEEK = 5;
const PERIODIC_SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
```

### AI Model Training

To retrain the model with new parameters:

```bash
cd ai_service
python train_model.py
```

The model uses:
- **17 features**: skill_match, preference, availability, attendance_score, recent_swaps, urgency, fairness metrics, and engineered features
- **15,000 training samples** for robust learning
- **Hyperparameter tuning** for optimal performance

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Employees
- `GET /api/employees` - Get all employees
- `POST /api/employees` - Create employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

### Shifts
- `GET /api/shifts` - Get all shifts
- `POST /api/shifts` - Create shift
- `PUT /api/shifts/:id` - Update shift
- `DELETE /api/shifts/:id` - Delete shift
- `POST /api/assign` - AI-powered shift assignment

### Availability
- `GET /api/my-availability` - Get current user's availability
- `POST /api/update-availability` - Update availability (triggers auto-reassignment)

### Audit Logs
- `GET /api/audit-logs` - Get audit logs (supervisor only)

## 🤖 How the AI Works

### Feature Engineering
The AI model considers:
1. **Employee Features**: skill_match, preference, availability, attendance_score, recent_swaps
2. **Shift Features**: urgency, shiftType
3. **Fairness Features**: 
   - `shifts_already_assigned`: Total shifts from database
   - `shifts_relative_to_average`: Ratio to team average
   - `shifts_normalized`: Normalized 0-1 score
   - `fairness_score`: Inverse fairness (1.0 = most fair)

4. **Engineered Features**: 
   - skill_preference_interaction
   - availability_skill
   - attendance_preference
   - urgency_skill
   - reliability_score
   - fitness_score

### Assignment Process
1. **AI Scoring**: Model scores each employee for each shift
2. **Hungarian Algorithm**: Finds globally optimal assignment
3. **Preference Filtering**: Only considers preferred employees first
4. **Fairness Enforcement**: Prioritizes employees with fewer shifts
5. **Constraint Checking**: Validates day/week/month limits
6. **Assignment**: Selects best candidate respecting all rules

## 🛡️ Security

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access**: Supervisor and employee roles
- **Password Hashing**: bcrypt for password security
- **Environment Variables**: Sensitive data stored in .env files

## 📄 License

This project is private and proprietary.

## 👥 Contributing

This is a private project. For questions or issues, contact the repository owner.

## 📧 Support

For issues or questions, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ using React, Node.js, Express, MongoDB, Python, Flask, and Scikit-Learn**

