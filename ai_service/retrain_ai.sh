#!/bin/bash
# Script to retrain the AI model

echo "🚀 Retraining AI Model for Shift Assignment..."
echo ""

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "📦 Activating virtual environment..."
    source venv/bin/activate  # Linux/Mac
    # On Windows, use: venv\Scripts\activate
fi

# Run training script
echo "🎓 Starting training process..."
python train_model.py

echo ""
echo "✅ Training complete! The new model.pkl has been generated."
echo "🔄 Restart the AI service to use the new model."


