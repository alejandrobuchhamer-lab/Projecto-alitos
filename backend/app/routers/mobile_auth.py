from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.usuario import Usuario
from app.config import settings

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


@router.get("/me")
def mobile_me(token: str, db: Session = Depends(get_db)):
    payload = verificar_token(token)
    if not payload:
        raise HTTPException(401, "Token inválido o expirado")
    user = db.query(Usuario).filter(Usuario.id == int(payload["sub"]), Usuario.activo == True).first()
    if not user:
        raise HTTPException(401, "Usuario no encontrado")
    return {"id": user.id, "username": user.username, "nombre": user.nombre, "rol": user.rol}
