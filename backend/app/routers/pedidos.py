from datetime import datetime
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.events import broadcast_event
from app.models.pedido import PedidoVendedor
from app.models.usuario import Usuario
from app.routers.auth import require_user, permiso
from app.templates import templates

router = APIRouter(prefix="/pedidos", tags=["pedidos"])

ESTADOS_VALIDOS = {"pendiente", "preparando", "entregado", "cancelado"}


def _parse_dt(val):
    if not val:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
        try:
            return datetime.strptime(val[:16], fmt[:len(val[:16])])
        except Exception:
            pass
    return None


def _fmt(p: PedidoVendedor) -> dict:
    elapsed = datetime.utcnow() - p.created_at
    if elapsed.days == 0:
        mins = elapsed.seconds // 60
        if mins < 60:
            time_str = f"Hace {mins} min" if mins > 1 else "Ahora"
        else:
            time_str = f"Hoy {p.created_at.strftime('%H:%M')}"
    elif elapsed.days == 1:
        time_str = f"Ayer {p.created_at.strftime('%H:%M')}"
    else:
        time_str = p.created_at.strftime("%d/%m %H:%M")

    return {
        "id":               p.id,
        "place":            p.lugar,
        "negocioId":        p.negocio_id,
        "units":            p.unidades,
        "amount":           p.monto,
        "status":           p.estado,
        "time":             time_str,
        "by":               p.vendedor_nombre or "—",
        "vendedorId":       p.vendedor_id,
        "notas":            p.notas or "",
        "productos":        json.loads(p.productos_json) if p.productos_json else [],
        "created_at":       p.created_at.isoformat(),
        "tipo_cliente":     p.tipo_cliente or "consumidor_final",
        "cliente_id":       p.cliente_id,
        "cliente_nombre":   p.cliente_nombre or "",
        "cliente_localidad": p.cliente_localidad or "",
        "fecha_entrega":    p.fecha_entrega.isoformat() if p.fecha_entrega else None,
        "forma_pago":       p.forma_pago or "",
        "descuento_pct":    p.descuento_pct or 0,
        "monto_lista":      p.monto_lista or p.monto,
    }


def _fmt_web(p: PedidoVendedor) -> dict:
    """Versión simplificada para el template HTML (JSON-safe)."""
    prods = []
    try:
        prods = json.loads(p.productos_json) if p.productos_json else []
    except Exception:
        pass
    return {
        "id":               p.id,
        "vendedor":         p.vendedor_nombre or "",
        "cliente":          p.cliente_nombre or p.lugar or "",
        "localidad":        p.cliente_localidad or "",
        "tipo":             p.tipo_cliente or "consumidor_final",
        "lugar":            p.lugar or "",
        "unidades":         p.unidades,
        "monto":            p.monto,
        "monto_lista":      p.monto_lista or p.monto,
        "desc_pct":         p.descuento_pct or 0,
        "estado":           p.estado,
        "forma_pago":       p.forma_pago or "",
        "fecha_entrega":    p.fecha_entrega.strftime("%d/%m/%Y") if p.fecha_entrega else "",
        "fecha":            p.created_at.strftime("%d/%m %H:%M"),
        "notas":            p.notas or "",
        "productos":        prods,
    }


@router.get("/", response_class=HTMLResponse)
def pedidos_web(
    request: Request,
    db: Session = Depends(get_db),
    _u: Usuario = Depends(permiso("ventas")),
):
    pedidos = (
        db.query(PedidoVendedor)
        .filter(PedidoVendedor.activo == True)
        .order_by(PedidoVendedor.created_at.desc())
        .limit(500)
        .all()
    )
    for p in pedidos:
        try:
            p.productos_list = json.loads(p.productos_json) if p.productos_json else []
        except Exception:
            p.productos_list = []
    pedidos_json = json.dumps([_fmt_web(p) for p in pedidos], ensure_ascii=False)
    return templates.TemplateResponse(
        "pedidos/lista.html",
        {"request": request, "pedidos": pedidos, "pedidos_json": pedidos_json},
    )


@router.get("/api")
def listar_pedidos(
    estado: str | None = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_user),
):
    q = db.query(PedidoVendedor).filter(PedidoVendedor.activo == True)
    if user.rol != "admin":
        q = q.filter(PedidoVendedor.vendedor_id == user.id)
    if estado:
        q = q.filter(PedidoVendedor.estado == estado)
    pedidos = q.order_by(PedidoVendedor.created_at.desc()).limit(200).all()
    return [_fmt(p) for p in pedidos]


@router.get("/api/{pedido_id}")
def obtener_pedido(
    pedido_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_user),
):
    p = db.query(PedidoVendedor).filter(
        PedidoVendedor.id == pedido_id, PedidoVendedor.activo == True
    ).first()
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if user.rol != "admin" and p.vendedor_id != user.id:
        raise HTTPException(403, "Sin permiso")
    return _fmt(p)


@router.post("/api", status_code=201)
def crear_pedido(
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_user),
):
    if not data.get("place"):
        raise HTTPException(400, "El campo 'place' es requerido")
    productos = data.get("productos", [])
    unidades = int(data.get("units", sum(i.get("qty", 0) for i in productos)))
    monto = float(data.get("amount", sum(i.get("qty", 0) * i.get("price", 0) for i in productos)))
    monto_lista = float(data.get("monto_lista", monto))
    p = PedidoVendedor(
        vendedor_id=user.id,
        vendedor_nombre=user.nombre,
        lugar=data["place"],
        negocio_id=data.get("negocioId"),
        unidades=unidades,
        monto=monto,
        estado="pendiente",
        productos_json=json.dumps(productos) if productos else None,
        notas=data.get("notas") or None,
        tipo_cliente=data.get("tipo_cliente", "consumidor_final"),
        cliente_id=data.get("cliente_id"),
        cliente_nombre=data.get("cliente_nombre") or None,
        cliente_localidad=data.get("cliente_localidad") or None,
        fecha_entrega=_parse_dt(data.get("fecha_entrega")),
        forma_pago=data.get("forma_pago") or None,
        descuento_pct=float(data.get("descuento_pct", 0)),
        monto_lista=monto_lista,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    broadcast_event("pedido", {
        "vendedor_nombre": user.nombre,
        "vendedor_id": user.id,
        "lugar": data["place"],
        "unidades": unidades,
        "monto": float(monto),
        "cliente": data.get("cliente_nombre") or data["place"],
    })
    return _fmt(p)


@router.put("/api/{pedido_id}/estado")
def actualizar_estado(
    pedido_id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_user),
):
    p = db.query(PedidoVendedor).filter(
        PedidoVendedor.id == pedido_id, PedidoVendedor.activo == True
    ).first()
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if user.rol != "admin" and p.vendedor_id != user.id:
        raise HTTPException(403, "Sin permiso")
    nuevo_estado = data.get("estado", "")
    if nuevo_estado not in ESTADOS_VALIDOS:
        raise HTTPException(400, f"Estado inválido: {nuevo_estado}")
    p.estado = nuevo_estado
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return _fmt(p)


@router.delete("/api/{pedido_id}")
def cancelar_pedido(
    pedido_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_user),
):
    p = db.query(PedidoVendedor).filter(
        PedidoVendedor.id == pedido_id, PedidoVendedor.activo == True
    ).first()
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if user.rol != "admin" and p.vendedor_id != user.id:
        raise HTTPException(403, "Sin permiso")
    p.activo = False
    db.commit()
    return {"ok": True}
