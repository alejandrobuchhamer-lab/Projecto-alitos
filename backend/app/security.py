"""
Módulo de seguridad de ALITOS:
- Rate limiting por IP para login
- Generación y verificación de CSRF tokens
- Logging de auditoría
"""

import time
import hmac
import hashlib
import secrets
import json
import os
from datetime import datetime
from collections import defaultdict
from pathlib import Path

# ──────────────────────────────────────────────
# Rate Limiting (en memoria — se resetea con cada restart)
# ──────────────────────────────────────────────
_attempts: dict[str, list[float]] = defaultdict(list)
MAX_ATTEMPTS = 5        # intentos fallidos permitidos
WINDOW_SECONDS = 900    # ventana de 15 minutos
LOCKOUT_SECONDS = 900   # bloqueo de 15 minutos


def is_rate_limited(ip: str) -> bool:
    now = time.time()
    # Limpiar intentos viejos fuera de la ventana
    _attempts[ip] = [t for t in _attempts[ip] if now - t < WINDOW_SECONDS]
    return len(_attempts[ip]) >= MAX_ATTEMPTS


def record_failed_attempt(ip: str):
    _attempts[ip].append(time.time())


def clear_attempts(ip: str):
    _attempts.pop(ip, None)


def remaining_lockout(ip: str) -> int:
    """Segundos restantes de bloqueo (0 si no está bloqueado)."""
    if not _attempts.get(ip):
        return 0
    now = time.time()
    oldest = min(_attempts[ip])
    remaining = int(LOCKOUT_SECONDS - (now - oldest))
    return max(0, remaining)


# ──────────────────────────────────────────────
# CSRF Tokens
# ──────────────────────────────────────────────
_CSRF_SECRET = os.environ.get("CSRF_SECRET", secrets.token_hex(32))


def generate_csrf_token(session_id: str = "") -> str:
    """Genera un token CSRF firmado con HMAC."""
    random_part = secrets.token_hex(16)
    payload = f"{session_id}:{random_part}:{int(time.time())}"
    sig = hmac.new(_CSRF_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"


def verify_csrf_token(token: str, max_age: int = 3600) -> bool:
    """Verifica un token CSRF. Retorna True si es válido."""
    try:
        parts = token.rsplit(":", 1)
        if len(parts) != 2:
            return False
        payload, sig = parts
        expected = hmac.new(_CSRF_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return False
        # Verificar antigüedad
        ts = int(payload.split(":")[-1])
        if time.time() - ts > max_age:
            return False
        return True
    except Exception:
        return False


# ──────────────────────────────────────────────
# Audit Log
# ──────────────────────────────────────────────
_LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
_LOG_DIR.mkdir(exist_ok=True)
_AUDIT_FILE = _LOG_DIR / "audit.jsonl"


def audit_log(
    action: str,
    user_id: int | None,
    username: str | None,
    resource: str,
    resource_id: str | None = None,
    details: dict | None = None,
    ip: str | None = None,
):
    """Registra una acción en el audit log (append-only JSONL)."""
    entry = {
        "ts": datetime.utcnow().isoformat(),
        "action": action,
        "user_id": user_id,
        "username": username,
        "resource": resource,
        "resource_id": str(resource_id) if resource_id else None,
        "ip": ip,
        "details": details or {},
    }
    try:
        with open(_AUDIT_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        pass  # El audit log nunca debe romper la app


def get_audit_log(limit: int = 100) -> list[dict]:
    """Lee las últimas N entradas del audit log."""
    if not _AUDIT_FILE.exists():
        return []
    try:
        lines = _AUDIT_FILE.read_text(encoding="utf-8").strip().splitlines()
        entries = [json.loads(l) for l in lines[-limit:]]
        return list(reversed(entries))
    except Exception:
        return []
