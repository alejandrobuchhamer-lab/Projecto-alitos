from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.usuario import Usuario
from app.config import settings
import re

router = APIRouter(prefix="/api/mobile", tags=["mobile"])

try:
    from jose import jwt
    _JWT_AVAILABLE = True
except ImportError:
    _JWT_AVAILABLE = False

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    nombre: str
    rol: str
    must_change_password: bool = False


class CambiarPinRequest(BaseModel):
    nuevo_pin: str


class ResetPinRequest(BaseModel):
    user_id: int
    nuevo_pin: str


def crear_token(user: Usuario) -> str:
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "rol": user.rol,
        "exp": datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def verificar_token(token: str) -> dict | None:
    if not _JWT_AVAILABLE:
        return None
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except Exception:
        return None


@router.post("/login", response_model=TokenResponse)
def mobile_login(data: LoginRequest, db: Session = Depends(get_db)):
    if not _JWT_AVAILABLE:
        raise HTTPException(503, "JWT no disponible — instalá python-jose en el servidor")
    user = db.query(Usuario).filter(
        Usuario.username == data.username,
        Usuario.activo == True,
    ).first()
    if not user or not user.check_password(data.password):
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    return TokenResponse(
        access_token=crear_token(user),
        user_id=user.id,
        username=user.username,
        nombre=user.nombre,
        rol=user.rol,
        must_change_password=bool(user.must_change_password),
    )


def get_mobile_user(authorization: str = Header(None)) -> dict:
    """FastAPI dependency — extrae y valida el JWT del header Authorization: Bearer <token>."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    token = authorization.split(" ", 1)[1]
    payload = verificar_token(token)
    if not payload:
        raise HTTPException(401, "Token inválido o expirado")
    return payload


@router.get("/usuarios")
def listar_usuarios_mobile(db: Session = Depends(get_db)):
    """Lista de usuarios activos para el user picker de la app móvil."""
    ROL_LABEL = {"admin": "Administrador", "vendedor": "Vendedor", "produccion": "Producción"}
    ROL_VIEW  = {"admin": "admin", "vendedor": "vendedor", "produccion": "produccion"}
    users = db.query(Usuario).filter(Usuario.activo == True).order_by(Usuario.nombre).all()
    return [{
        "id":        u.id,
        "username":  u.username,
        "nombre":    u.nombre,
        "first":     u.nombre.split()[0],
        "rol":       u.rol,
        "roleLabel": ROL_LABEL.get(u.rol, u.rol),
        "view":      ROL_VIEW.get(u.rol, "vendedor"),
        "foto":      u.foto or None,
    } for u in users]


@router.get("/me")
def mobile_me(token: str, db: Session = Depends(get_db)):
    payload = verificar_token(token)
    if not payload:
        raise HTTPException(401, "Token inválido o expirado")
    user = db.query(Usuario).filter(Usuario.id == int(payload["sub"]), Usuario.activo == True).first()
    if not user:
        raise HTTPException(401, "Usuario no encontrado")
    return {"id": user.id, "username": user.username, "nombre": user.nombre, "rol": user.rol}


@router.post("/cambiar_pin")
def cambiar_pin(data: CambiarPinRequest, authorization: str = Header(None), db: Session = Depends(get_db)):
    """Vendedora cambia su propio PIN. Requiere token válido."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = verificar_token(authorization.split(" ", 1)[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    if not re.fullmatch(r"\d{6}", data.nuevo_pin):
        raise HTTPException(400, "El PIN debe tener exactamente 6 dígitos")
    user = db.query(Usuario).filter(Usuario.id == int(payload["sub"]), Usuario.activo == True).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    user.set_password(data.nuevo_pin)
    user.must_change_password = False
    user.pin_temporal = None
    db.commit()
    return {"ok": True}


def _require_admin(request: Request, authorization: str, db: Session) -> None:
    """Acepta Bearer token (app móvil) O cookie de sesión (web). Solo admin."""
    # Bearer token (móvil)
    if authorization and authorization.startswith("Bearer "):
        payload = verificar_token(authorization.split(" ", 1)[1])
        if payload and payload.get("rol") == "admin":
            return
        raise HTTPException(403, "Solo administradores")
    # Cookie de sesión (navegador web — AuthMiddleware inyecta request.state.user como ORM)
    web_user = getattr(request.state, "user", None)
    if web_user and getattr(web_user, "rol", None) == "admin":
        return
    raise HTTPException(401, "Autenticación requerida")


@router.get("/admin/usuarios_pins")
def admin_listar_pins(request: Request, authorization: str = Header(None), db: Session = Depends(get_db)):
    """Solo admin — lista usuarios con pin_temporal visible."""
    _require_admin(request, authorization, db)
    users = db.query(Usuario).filter(Usuario.activo == True).order_by(Usuario.nombre).all()
    return [{
        "id": u.id,
        "username": u.username,
        "nombre": u.nombre,
        "rol": u.rol,
        "must_change_password": bool(u.must_change_password),
        "pin_temporal": u.pin_temporal or "",
    } for u in users]


@router.post("/admin/reset_pin")
def admin_reset_pin(request: Request, data: ResetPinRequest, authorization: str = Header(None), db: Session = Depends(get_db)):
    """Solo admin — resetea el PIN de un usuario y lo obliga a cambiarlo."""
    _require_admin(request, authorization, db)
    if not re.fullmatch(r"\d{6}", data.nuevo_pin):
        raise HTTPException(400, "El PIN debe tener exactamente 6 dígitos")
    user = db.query(Usuario).filter(Usuario.id == data.user_id, Usuario.activo == True).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    user.set_password(data.nuevo_pin)
    user.must_change_password = True
    user.pin_temporal = data.nuevo_pin
    db.commit()
    return {"ok": True}


class ActualizarPerfilRequest(BaseModel):
    nombre: str | None = None
    telefono: str | None = None
    bio: str | None = None
    foto: str | None = None


@router.get("/perfil")
def get_perfil(authorization: str = Header(None), db: Session = Depends(get_db)):
    """Devuelve el perfil del usuario autenticado."""
    payload = get_mobile_user(authorization)
    user = db.query(Usuario).filter(Usuario.id == int(payload["sub"]), Usuario.activo == True).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    return {
        "id":       user.id,
        "username": user.username,
        "nombre":   user.nombre,
        "rol":      user.rol,
        "telefono": user.telefono or "",
        "bio":      user.bio or "",
        "foto":     user.foto or None,
    }


@router.patch("/perfil")
def actualizar_perfil(data: ActualizarPerfilRequest, authorization: str = Header(None), db: Session = Depends(get_db)):
    """El usuario actualiza su propio perfil (nombre, foto, teléfono, bio)."""
    payload = get_mobile_user(authorization)
    user = db.query(Usuario).filter(Usuario.id == int(payload["sub"]), Usuario.activo == True).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    if data.nombre is not None:
        nombre = data.nombre.strip()
        if not nombre:
            raise HTTPException(400, "El nombre no puede estar vacío")
        user.nombre = nombre
    if data.telefono is not None:
        user.telefono = data.telefono.strip() or None
    if data.bio is not None:
        user.bio = data.bio.strip()[:200] or None
    if data.foto is not None:
        user.foto = data.foto or None
    db.commit()
    return {
        "id":       user.id,
        "username": user.username,
        "nombre":   user.nombre,
        "rol":      user.rol,
        "telefono": user.telefono or "",
        "bio":      user.bio or "",
        "foto":     user.foto or None,
    }
