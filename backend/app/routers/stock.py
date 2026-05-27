from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.insumo import Insumo, LoteInsumo
from app.models.producto import ProductoTerminado, LoteProductoTerminado
from app.models.ajuste_stock import AjusteStock
from app.templates import templates

router = APIRouter(prefix="/stock", tags=["stock"])


# ── Página HTML ───────────────────────────────────────────────────────────────

@router.get("/conteo", response_class=HTMLResponse)
def conteo_html(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("stock/conteo.html", {"request": request})


# ── Items para contar ─────────────────────────────────────────────────────────

@router.get("/api/items-conteo")
def items_conteo(db: Session = Depends(get_db)):
    """Devuelve todos los insumos y alfajores con su stock actual del sistema."""

    # Insumos activos con stock > 0 (incluye envases/packaging)
    insumos = db.query(Insumo).filter(Insumo.activo == True).order_by(Insumo.nombre).all()
    items_insumos = []
    for ins in insumos:
        stock = ins.stock_actual
        items_insumos.append({
            "tipo": "insumo",
            "id": ins.id,
            "nombre": ins.nombre,
            "unidad": ins.unidad_medida,
            "categoria": ins.categoria,
            "stock_sistema": round(stock, 3),
        })

    # Alfajores terminados (tipo="alfajor") con stock > 0
    productos = db.query(ProductoTerminado).filter(ProductoTerminado.activo == True).order_by(ProductoTerminado.nombre).all()
    items_alfajores = []
    for prod in productos:
        stock = prod.stock_actual  # solo cuenta tipo="alfajor"
        if stock > 0:
            items_alfajores.append({
                "tipo": "alfajor",
                "id": prod.id,
                "nombre": prod.nombre,
                "unidad": prod.unidad_medida,
                "categoria": "alfajor",
                "stock_sistema": round(stock, 3),
            })

    return {
        "insumos": items_insumos,
        "alfajores": items_alfajores,
        "total": len(items_insumos) + len(items_alfajores),
    }


# ── Aplicar ajuste ────────────────────────────────────────────────────────────

class ItemAjuste(BaseModel):
    tipo: str          # "insumo" | "alfajor"
    id: int            # insumo_id o producto_id
    nombre: str
    stock_sistema: float
    stock_real: float
    motivo: str = "conteo físico"


@router.post("/api/aplicar-ajuste")
def aplicar_ajuste(items: list[ItemAjuste], db: Session = Depends(get_db)):
    """Aplica ajustes de stock para todos los ítems contados. Omite items sin diferencia."""
    resultados = []

    for item in items:
        diferencia = round(item.stock_real - item.stock_sistema, 4)
        if diferencia == 0:
            resultados.append({"nombre": item.nombre, "estado": "sin_cambio", "diferencia": 0})
            continue

        if item.tipo == "insumo":
            _ajustar_insumo(db, item.id, diferencia)
        elif item.tipo == "alfajor":
            _ajustar_alfajor(db, item.id, diferencia)
        else:
            continue

        # Registrar historial
        ajuste = AjusteStock(
            tipo=item.tipo,
            insumo_id=item.id if item.tipo == "insumo" else None,
            producto_id=item.id if item.tipo == "alfajor" else None,
            nombre=item.nombre,
            stock_sistema=item.stock_sistema,
            stock_real=item.stock_real,
            diferencia=diferencia,
            motivo=item.motivo,
        )
        db.add(ajuste)
        resultados.append({
            "nombre": item.nombre,
            "estado": "ajustado",
            "diferencia": diferencia,
        })

    db.commit()
    ajustados = sum(1 for r in resultados if r["estado"] == "ajustado")
    return {"ok": True, "ajustados": ajustados, "resultados": resultados}


def _ajustar_insumo(db: Session, insumo_id: int, diferencia: float):
    """Ajusta lotes de insumo FEFO (oldest first) hasta absorber la diferencia."""
    lotes = (
        db.query(LoteInsumo)
        .filter(LoteInsumo.insumo_id == insumo_id, LoteInsumo.activo == True, LoteInsumo.cantidad_actual > 0)
        .order_by(LoteInsumo.fecha_ingreso)  # FEFO: el más viejo primero
        .all()
    )

    if diferencia < 0:
        # Hay menos de lo que dice el sistema → reducir lotes FEFO
        restante = abs(diferencia)
        for lote in lotes:
            if restante <= 0:
                break
            quitar = min(restante, lote.cantidad_actual)
            lote.cantidad_actual = round(lote.cantidad_actual - quitar, 4)
            restante = round(restante - quitar, 4)
            if lote.cantidad_actual <= 0:
                lote.cantidad_actual = 0
                lote.activo = False
    else:
        # Hay más de lo que dice el sistema → sumar al lote más reciente
        if lotes:
            lote_reciente = sorted(lotes, key=lambda l: l.fecha_ingreso, reverse=True)[0]
            lote_reciente.cantidad_actual = round(lote_reciente.cantidad_actual + diferencia, 4)
        else:
            # No hay lotes activos — crear uno nuevo sin costo (ajuste físico)
            nuevo = LoteInsumo(
                insumo_id=insumo_id,
                numero_lote=f"AJ-{datetime.utcnow().strftime('%Y%m%d%H%M')}",
                cantidad_inicial=diferencia,
                cantidad_actual=diferencia,
                costo_unitario=0.0,
                notas="Creado por ajuste de conteo físico",
            )
            db.add(nuevo)


def _ajustar_alfajor(db: Session, producto_id: int, diferencia: float):
    """Ajusta el stock de alfajores (lotes tipo='alfajor') FEFO."""
    lotes = (
        db.query(LoteProductoTerminado)
        .filter(
            LoteProductoTerminado.producto_id == producto_id,
            LoteProductoTerminado.tipo == "alfajor",
            LoteProductoTerminado.activo == True,
            LoteProductoTerminado.cantidad_actual > 0,
        )
        .order_by(LoteProductoTerminado.fecha_produccion)
        .all()
    )

    if diferencia < 0:
        restante = abs(diferencia)
        for lote in lotes:
            if restante <= 0:
                break
            quitar = min(restante, lote.cantidad_actual)
            lote.cantidad_actual = round(lote.cantidad_actual - quitar, 1)
            restante = round(restante - quitar, 1)
            if lote.cantidad_actual <= 0:
                lote.cantidad_actual = 0
                lote.activo = False
    else:
        if lotes:
            lote_reciente = sorted(lotes, key=lambda l: l.fecha_produccion, reverse=True)[0]
            lote_reciente.cantidad_actual = round(lote_reciente.cantidad_actual + diferencia, 1)


# ── Historial de ajustes ──────────────────────────────────────────────────────

@router.get("/api/historial-ajustes")
def historial_ajustes(limit: int = 50, db: Session = Depends(get_db)):
    ajustes = (
        db.query(AjusteStock)
        .order_by(AjusteStock.fecha.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": a.id,
            "fecha": a.fecha.strftime("%d/%m/%Y %H:%M"),
            "tipo": a.tipo,
            "nombre": a.nombre,
            "stock_sistema": a.stock_sistema,
            "stock_real": a.stock_real,
            "diferencia": a.diferencia,
            "motivo": a.motivo,
        }
        for a in ajustes
    ]
