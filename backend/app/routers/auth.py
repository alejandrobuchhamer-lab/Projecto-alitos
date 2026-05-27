from fastapi import APIRouter, Depends, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.usuario import Usuario
from app.services.auth_service import create_session_token, verify_session_token
from app.templates import templates

router = APIRouter(prefix="/auth", tags=["auth"])


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
        raise _redirect_login()
    return user


def _redirect_login():
    from fastapi import HTTPException
    return HTTPException(status_code=302, headers={"Location": "/auth/login"})


@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request, error: str = ""):
    return templates.TemplateResponse("auth/login.html", {"request": request, "error": error})


@router.post("/login")
def login_submit(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    user = db.query(Usuario).filter(Usuario.username == username, Usuario.activo == True).first()
    if not user or not user.check_password(password):
        return templates.TemplateResponse(
            "auth/login.html",
            {"request": request, "error": "Usuario o contrasena incorrectos"},
            status_code=401,
        )
    token = create_session_token(user.id)
    resp = RedirectResponse("/", status_code=303)
    resp.set_cookie("session", token, max_age=86400 * 7, httponly=True, samesite="lax")
    return resp


@router.get("/logout")
def logout():
    resp = RedirectResponse("/auth/login", status_code=303)
    resp.delete_cookie("session")
    return resp
