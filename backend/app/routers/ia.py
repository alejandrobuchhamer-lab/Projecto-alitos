from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.services.ia_service import proyectar_demanda, recomendar_produccion
from app.services.ia_chat_service import chat, get_historial, limpiar_historial
from app.services.analytics_service import get_analisis_precios_insumos, get_precio_historia_insumo
from app.templates import templates

router = APIRouter(prefix="/ia", tags=["ia"])


class ChatMessage(BaseModel):
    mensaje: str
    session_id: str = "default"


# ── Páginas HTML ────────────────────────────────────────────────────────────

@router.get("/asistente", response_class=HTMLResponse)
def asistente_html(request: Request, db: Session = Depends(get_db)):
    historial = get_historial(db, "default")
    return templates.TemplateResponse("ia/asistente.html", {
        "request": request,
        "historial": historial,
    })


# ── API Chat ────────────────────────────────────────────────────────────────

@router.post("/chat")
def chat_endpoint(data: ChatMessage, db: Session = Depends(get_db)):
    return chat(db, data.session_id, data.mensaje)


@router.get("/chat/historial/{session_id}")
def historial_endpoint(session_id: str, db: Session = Depends(get_db)):
    return get_historial(db, session_id)


@router.delete("/chat/historial/{session_id}")
def limpiar_endpoint(session_id: str, db: Session = Depends(get_db)):
    n = limpiar_historial(db, session_id)
    return {"eliminados": n}


# ── Analytics de precios ────────────────────────────────────────────────────

@router.get("/precios-insumos", response_class=HTMLResponse)
def precios_insumos_html(request: Request, db: Session = Depends(get_db)):
    analisis = get_analisis_precios_insumos(db)
    return templates.TemplateResponse("ia/precios_insumos.html", {
        "request": request,
        "analisis": analisis,
    })


@router.get("/api/precios-insumos")
def precios_insumos_api(db: Session = Depends(get_db)):
    return get_analisis_precios_insumos(db)


@router.get("/api/precio-historia/{insumo_id}")
def precio_historia_api(insumo_id: int, db: Session = Depends(get_db)):
    return get_precio_historia_insumo(db, insumo_id)


# ── Endpoints legacy ────────────────────────────────────────────────────────

@router.get("/recomendaciones-produccion")
def recomendaciones_produccion(db: Session = Depends(get_db)):
    return recomendar_produccion(db)


@router.get("/proyeccion-demanda/{producto_id}")
def proyeccion(producto_id: int, dias: int = 30, db: Session = Depends(get_db)):
    return proyectar_demanda(db, producto_id, dias)
