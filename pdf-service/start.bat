@echo off

REM PDF Service Startup Script for Windows

echo 🚀 Starting PDF Extraction Service...

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed. Please install Python 3.11 or later.
    exit /b 1
)

echo ✅ Python found

REM Check if virtual environment exists, create if not
if not exist "venv" (
    echo 📦 Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo 📥 Installing dependencies...
python -m pip install -q --upgrade pip
python -m pip install -q -r requirements.txt

REM Run the service
echo.
echo ✨ Starting FastAPI server on http://localhost:8000
echo 📖 API docs available at http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo.

python main.py
