"""
DRCH Root Gateway Entrypoint
Enables launching FastAPI from the workspace root or inside backend/:
  uvicorn main:app --reload --port 8000
  python main.py
"""
import os
import sys

# Add backend directory to sys.path so all imports resolve seamlessly
_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.join(_CURRENT_DIR, "backend")

if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from backend.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
