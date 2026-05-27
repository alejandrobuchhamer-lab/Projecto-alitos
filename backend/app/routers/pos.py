from datetime import date
from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.templates import templates
from app.database import get_db
from app.models.producto import ProductoTerminado, LoteProductoTerminado
from app.models.venta import Venta
from app.routers.mobile_auth import get_mobile_user
from app.services.venta_service import crear_venta

router = APIRouter(prefix="/pos", tags=["pos"])


@router.get("/", response_class=HTMLResponse)
def pos_login(request: Request):
    return templates.TemplateResponse("pos/login.html", {"request": request})


@router.get("/app", response_class=HTMLResponse)
def pos_app(request: Request):
    return templates.TemplateResponse("pos/app.html", {"request": request})


@router.get("/api/stock")
def pos_stock(db: Session = Depends(get_db), user: dict = Depends(get_mobile_user)):
    """Productos con stock disponible para venta (FEFO)."""
    productos = db.query(ProductoTerminado).filter(ProductoTerminado.activo == True).order_by(ProductoTerminado.nombre).all()
    result = []
    for p in productos:
        lotes = (
            db.query(LoteProductoTerminado)
            .filter(
                LoteProductoTerminado.producto_id == p.id,
                LoteProductoTerminado.activo == True,
                LoteProductoTerminado.cantidad_actual > 0,
                LoteProductoTerminado.tipo == "alfajor",
            )
            .order_by(LoteProductoTerminado.fecha_vencimiento.asc().nullslast())
            .all()
        )
        stock_libre = sum(max(0, l.cantidad_actual - l.cantidad_reservada) for l in lotes)
        if stock_libre <= 0:
            continue
        fefo = lotes[0]
        result.append({
            "producto_id": p.id,
            "nombre": p.nombre,
            "precio": p.precio_venta_base,
            "stock": int(stock_libre),
            "lote_id": fefo.id,
            "numero_lote": fefo.numero_lote,
            "fecha_vencimiento": fefo.fecha_vencimiento.isoformat() if fefo.fecha_vencimiento else None,
        })
    return result


@router.get("/api/dashboard")
def pos_dashboard(db: Session = Depends(get_db), user: dict = Depends(get_mobile_user)):
    """Resumen del día."""
    hoy = date.today()
    ventas_hoy = (
        db.query(Venta)
        .filter(
            func.date(Venta.fecha_venta) == hoy,
            Venta.estado.in_(["confirmada", "cobrada"]),
        )
        .all()
    )
    total_hoy = sum(v.total_neto for v in ventas_hoy)
    stock_total = (
        db.query(func.sum(LoteProductoTerminado.cantidad_actual))
        .filter(
            LoteProductoTerminado.activo == True,
            LoteProductoTerminado.tipo == "alfajor",
        )
        .scalar()
        or 0
    )
    productos_unicos = (
        db.query(func.count(ProductoTerminado.id))
        .filter(ProductoTerminado.activo == True)
        .scalar()
        or 0
    )
    return {
        "ventas_hoy": len(ventas_hoy),
        "total_hoy": round(total_hoy, 2),
        "stock_alfajores": int(stock_total),
        "productos": productos_unicos,
    }


class POSItem(BaseModel):
    lote_id: int
    cantidad: int
    precio_unitario: float


class POSVentaCreate(BaseModel):
    items: list[POSItem]
    forma_pago: str = "efectivo"
    notas: str | None = None


@router.post("/api/venta", status_code=201)
def pos_crear_venta(
    data: POSVentaCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_mobile_user),
):
    if not data.items:
        raise HTTPException(400, "El carrito está vacío")
    try:
        detalles = [
            {"lote_producto_id": i.lote_id, "cantidad": float(i.cantidad), "precio_unitario": i.precio_unitario}
            for i in data.items
        ]
        notas = data.notas or f"POS — {user.get('username', '')}"
        venta = crear_venta(db, None, detalles, None, 0.0, notas, data.forma_pago, True)
        db.commit()
        db.refresh(venta)
        return {"id": venta.id, "numero_factura": venta.numero_factura, "total": round(venta.total_neto, 2)}
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))
