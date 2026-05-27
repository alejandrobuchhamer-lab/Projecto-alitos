import hmac
import hashlib
import time

_SECRET = "alitos-internal-2025-xK9mP"


def create_session_token(user_id: int) -> str:
    ts = int(time.time())
    payload = f"{user_id}:{ts}"
    sig = hmac.new(_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"


def verify_session_token(token: str) -> int | None:
    try:
        parts = token.rsplit(":", 2)
        if len(parts) != 3:
            return None
        user_id_str, ts_str, sig = parts
        payload = f"{user_id_str}:{ts_str}"
        expected = hmac.new(_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        if int(time.time()) - int(ts_str) > 86400 * 7:  # 7 days
            return None
        return int(user_id_str)
    except Exception:
        return None
