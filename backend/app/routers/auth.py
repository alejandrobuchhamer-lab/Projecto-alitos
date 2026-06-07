from fastapi import APIRouter, Depends, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.usuario import Usuario
from app.services.auth_service import create_session_token, verify_session_token
from app.templates import templates
from app.security import (
    is_rate_limited, record_failed_attempt, clear_attempts, remaining_lockout,
    generate_csrf_token, verify_csrf_token, audit_log,
)

router = APIRouter(prefix="/auth", tags=["auth"])

SESSION_MAX_AGE = 60 * 60 * 8  # 8 horas


def get_current_user(request: Request, db: Session = Depends(get_db)) -> Usuario | None:
    token = request.cookies.get("session")
    if not token:
        return None
    user_id = verify_session_token(token)
    if not user_id:
        return None
    return db.query(Usuario).filter(Usuario.id == user_id, Usuario.activo == True).first()


def require_user(request: Request, db: Session = Depends(get_db)) -> Usuario:
    user = get_current_user(request, db)
    if not user:
        raise _redirect_login()
    return user


def require_admin(request: Request, db: Session = Depends(get_db)) -> Usuario:
    user = require_user(request, db)
    if not user.es_admin:
        raise _redirect_forbidden()
    return user


def require_produccion(request: Request, db: Session = Depends(get_db)) -> Usuario:
    """Requiere rol admin o produccion."""
    user = require_user(request, db)
    if user.rol not in ("admin", "produccion"):
        raise _redirect_forbidden()
    return user


def require_vendedor(request: Request, db: Session = Depends(get_db)) -> Usuario:
    """Requiere rol admin o vendedor."""
    user = require_user(request, db)
    if user.rol not in ("admin", "vendedor"):
        raise _redirect_forbidden()
    return user


def _redirect_login():
    from fastapi import HTTPException
    return HTTPException(status_code=302, headers={"Location": "/auth/login"})


def _redirect_forbidden():
    from fastapi import HTTPException
    return HTTPException(status_code=302, headers={"Location": "/?acceso=denegado"})


def _get_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request, error: str = "", db: Session = Depends(get_db)):
    if get_current_user(request, db):
        return RedirectResponse("/", status_code=303)
    csrf = generate_csrf_token()
    response = templates.TemplateResponse(
        "auth/login.html",
        {"request": request, "error": error, "csrf_token": csrf},
    )
    response.set_cookie("csrf_token", csrf, httponly=True, samesite="lax", max_age=3600)
    return response


@router.post("/login")
def login_submit(
    request: Request,
    username: str = Form(..., max_length=80),
    password: str = Form(..., max_length=200),
    csrf_token: str = Form(default=""),
    db: Session = Depends(get_db),
):
    ip = _get_ip(request)
    cookie_csrf = request.cookies.get("csrf_token", "")

    # ── CSRF check ──────────────────────────────────────────────────────
    if not verify_csrf_token(cookie_csrf) or cookie_csrf != csrf_token:
        audit_log("login_csrf_fail", None, username[:80], "auth", ip=ip)
        return templates.TemplateResponse(
            "auth/login.html",
            {"request": request, "error": "Sesión inválida. Recargá la página e intentá de nuevo.", "csrf_token": generate_csrf_token()},
            status_code=403,
        )

    # ── Rate limiting ────────────────────────────────────────────────────
    if is_rate_limited(ip):
        mins = remaining_lockout(ip) // 60 + 1
        audit_log("login_blocked", None, username[:80], "auth", ip=ip)
        return templates.TemplateResponse(
            "auth/login.html",
            {"request": request, "error": f"Demasiados intentos fallidos. Intentá en {mins} minuto(s).", "csrf_token": generate_csrf_token()},
            status_code=429,
        )

    # ── Autenticación ────────────────────────────────────────────────────
    user = db.query(Usuario).filter(
        Usuario.username == username.strip(),
        Usuario.activo == True,
    ).first()

    if not user or not user.check_password(password):
        record_failed_attempt(ip)
        audit_log("login_fail", None, username[:80], "auth", ip=ip)
        return templates.TemplateResponse(
            "auth/login.html",
            {"request": request, "error": "Usuario o contraseña incorrectos.", "csrf_token": generate_csrf_token()},
            status_code=401,
        )

    # ── Login exitoso ────────────────────────────────────────────────────
    clear_attempts(ip)
    token = create_session_token(user.id)
    audit_log("login_ok", user.id, user.username, "auth", ip=ip)

    resp = RedirectResponse("/", status_code=303)
    resp.set_cookie(
        "session", token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
    )
    resp.delete_cookie("csrf_token")
    return resp


@router.get("/logout")
def logout(request: Request):
    ip = _get_ip(request)
    user = None
    token = request.cookies.get("session")
    if token:
        from app.services.auth_service import verify_session_token
        from app.database import SessionLocal
        uid = verify_session_token(token)
        if uid:
            db = SessionLocal()
            try:
                user = db.query(Usuario).filter(Usuario.id == uid).first()
            finally:
                db.close()
    audit_log("logout", user.id if user else None, user.username if user else None, "auth", ip=ip)
    resp = RedirectResponse("/auth/login", status_code=303)
    resp.delete_cookie("session")
    return resp
