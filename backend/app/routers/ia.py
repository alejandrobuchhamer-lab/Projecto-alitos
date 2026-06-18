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


# ── BI: Proyecciones y break-even ───────────────────────────────────────────

@router.get("/proyecciones", response_class=HTMLResponse)
def proyecciones_html(request: Request, db: Session = Depends(get_db)):
    from app.models.produccion import Produccion, ConfiguracionProduccion, Horno
    from app.models.producto import ProductoTerminado
    from sqlalchemy import func
    from datetime import datetime, timedelta

    # Costo promedio por alfajor (últimas 10 producciones armado finalizadas)
    prods = db.query(Produccion).filter(
        Produccion.tipo_produccion.in_(["armado", "general"]),
        Produccion.estado == "finalizada",
        Produccion.costo_total_real > 0,
    ).order_by(Produccion.fecha_fin.desc()).limit(10).all()

    costo_unitario_prom = 0.0
    if prods:
        costos = [p.costo_unitario_total for p in prods if p.costo_unitario_total > 0]
        costo_unitario_prom = round(sum(costos) / len(costos), 2) if costos else 0.0

    # Precio de venta promedio
    productos = db.query(ProductoTerminado).filter(ProductoTerminado.activo == True).all()
    precios = [p.precio_venta for p in productos if p.precio_venta]
    precio_venta_prom = round(sum(precios) / len(precios), 2) if precios else 0.0

    # Config horno / MO
    cfg = db.query(ConfiguracionProduccion).filter(ConfiguracionProduccion.id == 1).first()
    precio_hora_mo = cfg.precio_hora_mano_obra if cfg else 0.0
    horno = None
    if cfg and cfg.horno_activo_id:
        horno = db.query(Horno).filter(Horno.id == cfg.horno_activo_id).first()

    # Ventas últimos 30 días para estadística real
    from app.models.vendedor import VentaVendedor
    hace30 = datetime.utcnow() - timedelta(days=30)
    ventas_recientes = db.query(
        func.sum(VentaVendedor.cantidad),
        func.sum(VentaVendedor.monto_total),
        func.count(VentaVendedor.id),
    ).filter(VentaVendedor.fecha >= hace30).first()

    return templates.TemplateResponse("ia/proyecciones.html", {
        "request": request,
        "costo_unitario_prom": costo_unitario_prom,
        "precio_venta_prom": precio_venta_prom,
        "precio_hora_mo": precio_hora_mo,
        "horno": {"nombre": horno.nombre, "potencia_kw": horno.potencia_kw, "precio_kwh": horno.precio_kwh} if horno else None,
        "ventas_30d_unidades": int(ventas_recientes[0] or 0),
        "ventas_30d_monto": float(ventas_recientes[1] or 0),
        "ventas_30d_count": int(ventas_recientes[2] or 0),
        "productos": [{"id": p.id, "nombre": p.nombre, "precio_venta": p.precio_venta} for p in productos],
    })


# ── Endpoints legacy ────────────────────────────────────────────────────────

@router.get("/recomendaciones-produccion")
def recomendaciones_produccion(db: Session = Depends(get_db)):
    return recomendar_produccion(db)


@router.get("/proyeccion-demanda/{producto_id}")
def proyeccion(producto_id: int, dias: int = 30, db: Session = Depends(get_db)):
    return proyectar_demanda(db, producto_id, dias)
