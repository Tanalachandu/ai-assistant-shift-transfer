@echo off
REM Script to retrain the AI model on Windows

echo 🚀 Retraining AI Model for Shift Assignment...
echo.

REM Activate virtual environment if it exists
if exist venv\Scripts\activate.bat (
    echo 📦 Activating virtual environment...
    call venv\Scripts\activate.bat
)

REM Run training script
echo 🎓 Starting training process...
python train_model.py

echo.
echo ✅ Training complete! The new model.pkl has been generated.
echo 🔄 Restart the AI service to use the new model.
pause


