from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.usuario import Usuario, MODULOS_ACCIONES
from app.routers.auth import require_user
from app.templates import templates

router = APIRouter(prefix="/cuenta", tags=["cuenta"])


@router.get("/", response_class=HTMLResponse)
def perfil_page(request: Request, db: Session = Depends(get_db), user: Usuario = Depends(require_user)):
    return templates.TemplateResponse("cuenta/perfil.html", {
        "request": request,
        "modulos_acciones": MODULOS_ACCIONES,
    })


@router.put("/api/actualizar")
def actualizar_perfil(data: dict, db: Session = Depends(get_db), user: Usuario = Depends(require_user)):
    nombre = data.get("nombre", "").strip()
    if not nombre:
        raise HTTPException(400, "El nombre no puede estar vacío")
    user.nombre = nombre
    db.commit()
    return {"ok": True}


@router.put("/api/cambiar-password")
def cambiar_password(data: dict, db: Session = Depends(get_db), user: Usuario = Depends(require_user)):
    actual   = data.get("actual", "")
    nueva    = data.get("nueva", "")
    confirma = data.get("confirma", "")
    if not user.check_password(actual):
        raise HTTPException(400, "Contraseña actual incorrecta")
    if len(nueva) < 6:
        raise HTTPException(400, "La nueva contraseña debe tener al menos 6 caracteres")
    if nueva != confirma:
        raise HTTPException(400, "Las contraseñas no coinciden")
    user.set_password(nueva)
    db.commit()
    return {"ok": True}
