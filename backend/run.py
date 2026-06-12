import uvicorn
import os
import subprocess
import sys
from pathlib import Path

def _start_app_server():
    """Levanta servidor HTTP para la app móvil en puerto 5500 (solo local)."""
    if os.environ.get("RAILWAY_ENVIRONMENT"):
        return  # no en producción
    app_dir = Path(__file__).resolve().parent.parent / "APP ALITOS"
    if not app_dir.exists():
        return
    subprocess.Popen(
        [sys.executable, "-m", "http.server", "5500", "--directory", str(app_dir)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

if __name__ == "__main__":
    _start_app_server()
    port = int(os.environ.get("PORT", 8000))
    reload = os.environ.get("RAILWAY_ENVIRONMENT") is None  # no reload en producción
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=reload,
        log_level="info",
    )
