from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.venta import Venta, VentaDetalle, Pedido, PedidoReserva
from app.models.producto import ProductoTerminado, LoteProductoTerminado
from app.models.cliente import Cliente
from app.schemas.venta import VentaCreate, VentaOut, PedidoCreate, PedidoOut
from app.services.venta_service import crear_venta, cobrar_venta, generar_numero_pedido
from app.routers.auth import require_vendedor
from app.models.usuario import Usuario

router = APIRouter(prefix="/ventas", tags=["ventas"])
from app.templates import templates


@router.get("/", response_class=HTMLResponse)
def lista_ventas_html(request: Request, db: Session = Depends(get_db), _u: Usuario = Depends(require_vendedor)):
    ventas = db.query(Venta).order_by(Venta.fecha_venta.desc()).limit(50).all()
    clientes = db.query(Cliente).filter(Cliente.activo == True).all()
    return templates.TemplateResponse("ventas/lista.html", {
        "request": request, "ventas": ventas, "clientes": clientes
    })


@router.get("/api", response_model=list[VentaOut])
def listar_ventas(db: Session = Depends(get_db)):
    return [VentaOut.model_validate(v) for v in db.query(Venta).order_by(Venta.fecha_venta.desc()).limit(100).all()]


@router.post("/api", response_model=VentaOut, status_code=201)
def nueva_venta(data: VentaCreate, db: Session = Depends(get_db)):
    try:
        venta = crear_venta(
            db,
            data.cliente_id,
            [d.model_dump() for d in data.detalles],
            data.pedido_id,
            data.descuento,
            data.notas,
            data.forma_pago,
            data.consumidor_final,
        )
        db.commit()
        db.refresh(venta)
        return VentaOut.model_validate(venta)
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))


@router.post("/api/{venta_id}/cobrar", response_model=VentaOut)
def cobrar(venta_id: int, db: Session = Depends(get_db)):
    try:
        venta = cobrar_venta(db, venta_id)
        db.commit()
        db.refresh(venta)
        return VentaOut.model_validate(venta)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/api/{venta_id}", response_model=VentaOut)
def obtener_venta(venta_id: int, db: Session = Depends(get_db)):
    v = db.query(Venta).filter(Venta.id == venta_id).first()
    if not v:
        raise HTTPException(404, "Venta no encontrada")
    return VentaOut.model_validate(v)


@router.get("/api/analytics/top")
def analytics_top(db: Session = Depends(get_db)):
    rows = (
        db.query(
            ProductoTerminado.nombre,
            func.sum(VentaDetalle.cantidad).label("total_vendido"),
            func.sum(VentaDetalle.cantidad * VentaDetalle.precio_unitario).label("total_facturado"),
        )
        .join(LoteProductoTerminado, VentaDetalle.lote_producto_id == LoteProductoTerminado.id)
        .join(ProductoTerminado, LoteProductoTerminado.producto_id == ProductoTerminado.id)
        .group_by(ProductoTerminado.id, ProductoTerminado.nombre)
        .order_by(func.sum(VentaDetalle.cantidad).desc())
        .limit(10)
        .all()
    )
    return [{"nombre": r.nombre, "total_vendido": r.total_vendido, "total_facturado": r.total_facturado} for r in rows]


@router.get("/api/analytics/formas-pago")
def analytics_formas_pago(db: Session = Depends(get_db)):
    rows = (
        db.query(Venta.forma_pago, func.count(Venta.id).label("cantidad"), func.sum(Venta.total_neto).label("total"))
        .filter(Venta.estado.in_(["confirmada", "cobrada"]))
        .group_by(Venta.forma_pago)
        .all()
    )
    return [{"forma_pago": r.forma_pago, "cantidad": r.cantidad, "total": r.total} for r in rows]


# Pedidos
@router.get("/pedidos", response_class=HTMLResponse)
def lista_pedidos_html(request: Request, db: Session = Depends(get_db), _u: Usuario = Depends(require_vendedor)):
    from datetime import datetime
    pedidos = db.query(Pedido).order_by(Pedido.fecha_pedido.desc()).limit(50).all()
    clientes = db.query(Cliente).filter(Cliente.activo == True).all()
    productos = db.query(ProductoTerminado).filter(ProductoTerminado.activo == True).all()
    return templates.TemplateResponse("ventas/pedidos.html", {
        "request": request, "pedidos": pedidos, "clientes": clientes,
        "productos": productos, "now": datetime.utcnow(),
    })


@router.get("/pedidos/api", response_model=list[PedidoOut])
def listar_pedidos(db: Session = Depends(get_db)):
    return db.query(Pedido).order_by(Pedido.fecha_pedido.desc()).limit(100).all()


@router.post("/pedidos/api", response_model=PedidoOut, status_code=201)
def crear_pedido(data: PedidoCreate, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == data.cliente_id).first()
    if not cliente:
        raise HTTPException(404, "Cliente no encontrado")

    from app.models.venta import PedidoDetalle
    pedido = Pedido(
        cliente_id=data.cliente_id,
        numero_pedido=generar_numero_pedido(db),
        fecha_entrega_requerida=data.fecha_entrega_requerida,
        notas=data.notas,
    )
    db.add(pedido)
    db.flush()

    total = 0.0
    for det in data.detalles:
        pd = PedidoDetalle(
            pedido_id=pedido.id,
            producto_id=det.producto_id,
            cantidad=det.cantidad,
            precio_unitario=det.precio_unitario,
        )
        db.add(pd)
        total += det.cantidad * det.precio_unitario

        # Reservar stock FEFO para este ítem
        lotes = (
            db.query(LoteProductoTerminado)
            .filter(
                LoteProductoTerminado.producto_id == det.producto_id,
                LoteProductoTerminado.activo == True,
                LoteProductoTerminado.cantidad_actual > 0,
            )
            .all()
        )
        lotes_fefo = sorted([l for l in lotes if l.fecha_vencimiento], key=lambda l: l.fecha_vencimiento) + [l for l in lotes if not l.fecha_vencimiento]
        pendiente = det.cantidad
        for lote in lotes_fefo:
            if pendiente <= 0:
                break
            libre = lote.cantidad_actual - lote.cantidad_reservada
            reservar = min(libre, pendiente)
            if reservar <= 0:
                continue
            lote.cantidad_reservada += reservar
            reserva = PedidoReserva(pedido_id=pedido.id, lote_id=lote.id, cantidad=reservar)
            db.add(reserva)
            pendiente -= reservar

    pedido.total_estimado = total
    db.commit()
    db.refresh(pedido)
    return pedido


@router.get("/pedidos/api/{pedido_id}/detalle")
def detalle_pedido(pedido_id: int, db: Session = Depends(get_db)):
    pedido = db.query(Pedido).filter(Pedido.id == pedido_id).first()
    if not pedido:
        raise HTTPException(404, "Pedido no encontrado")
    reservas = db.query(PedidoReserva).filter(PedidoReserva.pedido_id == pedido_id).all()
    return {
        "id": pedido.id,
        "numero_pedido": pedido.numero_pedido,
        "cliente": pedido.cliente.nombre_completo,
        "estado": pedido.estado,
        "total_estimado": pedido.total_estimado,
        "notas": pedido.notas,
        "fecha_entrega_requerida": pedido.fecha_entrega_requerida,
        "detalles": [
            {"producto": d.producto.nombre, "cantidad": d.cantidad, "precio_unitario": d.precio_unitario, "subtotal": d.subtotal}
            for d in pedido.detalles
        ],
        "stock_reservado": len(reservas) > 0,
        "reservas": [{"lote_id": r.lote_id, "cantidad": r.cantidad} for r in reservas],
    }


@router.post("/pedidos/api/{pedido_id}/cancelar")
def cancelar_pedido(pedido_id: int, db: Session = Depends(get_db)):
    pedido = db.query(Pedido).filter(Pedido.id == pedido_id).first()
    if not pedido:
        raise HTTPException(404, "Pedido no encontrado")
    # Liberar reservas
    reservas = db.query(PedidoReserva).filter(PedidoReserva.pedido_id == pedido_id).all()
    for r in reservas:
        lote = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id == r.lote_id).first()
        if lote:
            lote.cantidad_reservada = max(0.0, lote.cantidad_reservada - r.cantidad)
        db.delete(r)
    pedido.estado = "cancelado"
    db.commit()
    return {"ok": True, "reservas_liberadas": len(reservas)}


@router.post("/pedidos/api/{pedido_id}/liberar-reserva")
def liberar_reserva_pedido(pedido_id: int, db: Session = Depends(get_db)):
    """Libera el stock reservado sin cancelar el pedido."""
    reservas = db.query(PedidoReserva).filter(PedidoReserva.pedido_id == pedido_id).all()
    for r in reservas:
        lote = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id == r.lote_id).first()
        if lote:
            lote.cantidad_reservada = max(0.0, lote.cantidad_reservada - r.cantidad)
        db.delete(r)
    db.commit()
    return {"ok": True, "reservas_liberadas": len(reservas)}

