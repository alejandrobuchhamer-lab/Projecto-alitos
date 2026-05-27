from fastapi import APIRouter, Depends, HTTPException, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.usuario import Usuario
from app.routers.auth import require_admin
from app.templates import templates

router = APIRouter(prefix="/admin", tags=["admin"])


class UsuarioCreate(BaseModel):
    username: str
    nombre: str
    password: str
    rol: str = "vendedor"


class UsuarioUpdate(BaseModel):
    nombre: str | None = None
    rol: str | None = None
    activo: bool | None = None
    password: str | None = None


@router.get("/", response_class=HTMLResponse)
def admin_panel(request: Request, db: Session = Depends(get_db), _admin: Usuario = Depends(require_admin)):
    usuarios = db.query(Usuario).order_by(Usuario.created_at.desc()).all()
    return templates.TemplateResponse("admin/usuarios.html", {
        "request": request,
        "usuarios": usuarios,
        "current_user": _admin,
    })


@router.get("/api/usuarios")
def listar_usuarios(db: Session = Depends(get_db), _admin: Usuario = Depends(require_admin)):
    return [
        {
            "id": u.id, "username": u.username, "nombre": u.nombre,
            "rol": u.rol, "activo": u.activo, "created_at": u.created_at,
        }
        for u in db.query(Usuario).order_by(Usuario.created_at.desc()).all()
    ]


@router.post("/api/usuarios", status_code=201)
def crear_usuario(data: UsuarioCreate, db: Session = Depends(get_db), _admin: Usuario = Depends(require_admin)):
    if db.query(Usuario).filter(Usuario.username == data.username).first():
        raise HTTPException(400, f"Ya existe el usuario '{data.username}'")
    if data.rol not in ("admin", "vendedor", "produccion"):
        raise HTTPException(400, "Rol invalido")
    u = Usuario(username=data.username, nombre=data.nombre, rol=data.rol)
    u.set_password(data.password)
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"id": u.id, "username": u.username, "nombre": u.nombre, "rol": u.rol}


@router.put("/api/usuarios/{user_id}")
def actualizar_usuario(
    user_id: int,
    data: UsuarioUpdate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    u = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    if data.nombre is not None:
        u.nombre = data.nombre
    if data.rol is not None:
        if data.rol not in ("admin", "vendedor", "produccion"):
            raise HTTPException(400, "Rol invalido")
        u.rol = data.rol
    if data.activo is not None:
        if not data.activo and u.id == _admin.id:
            raise HTTPException(400, "No podes desactivar tu propio usuario")
        u.activo = data.activo
    if data.password:
        u.set_password(data.password)
    db.commit()
    return {"ok": True}


@router.delete("/api/usuarios/{user_id}")
def eliminar_usuario(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    u = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    if u.id == _admin.id:
        raise HTTPException(400, "No podes eliminar tu propio usuario")
    u.activo = False
    db.commit()
    return {"ok": True}
