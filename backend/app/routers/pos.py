from datetime import date, datetime
from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.templates import templates
from app.database import get_db
from app.models.producto import ProductoTerminado, LoteProductoTerminado
from app.models.venta import Venta, Pedido, PedidoDetalle, PedidoReserva, EstadoPedido
from app.models.cliente import Cliente
from app.models.usuario import Usuario
from app.models.insumo import Insumo
from app.models.gasto import Gasto
from app.models.asignacion_stock import AsignacionStock
from app.routers.mobile_auth import get_mobile_user
from app.services.venta_service import crear_venta, generar_numero_pedido

router = APIRouter(prefix="/pos", tags=["pos"])


@router.get("/", response_class=HTMLResponse)
def pos_login(request: Request):
    return templates.TemplateResponse("pos/login.html", {"request": request})


@router.get("/app", response_class=HTMLResponse)
def pos_app(request: Request):
    return templates.TemplateResponse("pos/app.html", {"request": request})


_SW = """
const CACHE = 'alitos-pos-v1';
const PRECACHE = ['/pos/', '/pos/app', '/static/pos-manifest.json', '/static/img/logo1.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/pos/api/') || url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{}', {headers:{'Content-Type':'application/json'}})));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }))
  );
});
"""


@router.get("/sw.js")
def pos_sw():
    return Response(content=_SW, media_type="application/javascript")


# ── STOCK ─────────────────────────────────────────────────────────────────────

@router.get("/api/stock")
def pos_stock(db: Session = Depends(get_db), user: dict = Depends(get_mobile_user)):
    """Productos disponibles. Vendedor con asignación ve solo su cupo; admin ve todo."""
    rol = user.get("rol", "")
    vendedor_id = user.get("id")
    hoy = date.today()

    # Asignaciones activas del vendedor hoy
    asignaciones = {}
    if rol not in ("admin",):
        asigs = (
            db.query(AsignacionStock)
            .filter(AsignacionStock.vendedor_id == vendedor_id, AsignacionStock.fecha == hoy, AsignacionStock.activo == True)
            .all()
        )
        asignaciones = {a.producto_id: a for a in asigs}

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
        stock_libre_real = sum(max(0, l.cantidad_actual - l.cantidad_reservada) for l in lotes)
        if stock_libre_real <= 0:
            continue
        if not lotes:
            continue
        fefo = lotes[0]

        # Si vendedor con asignación → limitar al cupo disponible
        if rol not in ("admin",) and asignaciones:
            asig = asignaciones.get(p.id)
            if not asig:
                continue  # no tiene cupo para este producto
            stock_mostrar = min(int(asig.disponible), int(stock_libre_real))
        else:
            stock_mostrar = int(stock_libre_real)

        if stock_mostrar <= 0:
            continue

        row = {
            "producto_id": p.id,
            "nombre": p.nombre,
            "precio": p.precio_venta_base,
            "stock": stock_mostrar,
            "stock_real": int(stock_libre_real),
            "lote_id": fefo.id,
            "numero_lote": fefo.numero_lote,
            "fecha_vencimiento": fefo.fecha_vencimiento.isoformat() if fefo.fecha_vencimiento else None,
        }
        if rol not in ("admin",) and asignaciones and p.id in asignaciones:
            a = asignaciones[p.id]
            row["asignado"] = int(a.cantidad)
            row["vendido"] = int(a.cantidad_vendida)
        result.append(row)
    return result


# ── ASIGNACIONES DE STOCK ─────────────────────────────────────────────────

@router.get("/api/asignaciones")
def pos_asignaciones(
    fecha: str | None = None,
    db: Session = Depends(get_db), user: dict = Depends(get_mobile_user),
):
    if user.get("rol") != "admin":
        raise HTTPException(403, "Solo el admin puede ver asignaciones")
    hoy = date.today()
    fecha_filtro = date.fromisoformat(fecha) if fecha else hoy
    asigs = (
        db.query(AsignacionStock)
        .filter(AsignacionStock.fecha == fecha_filtro, AsignacionStock.activo == True)
        .all()
    )
    result = []
    for a in asigs:
        vendedor = db.query(Usuario).filter(Usuario.id == a.vendedor_id).first()
        producto = db.query(ProductoTerminado).filter(ProductoTerminado.id == a.producto_id).first()
        result.append({
            "id": a.id,
            "vendedor_id": a.vendedor_id,
            "vendedor": vendedor.nombre if vendedor else "—",
            "producto_id": a.producto_id,
            "producto": producto.nombre if producto else "—",
            "cantidad": a.cantidad,
            "cantidad_vendida": a.cantidad_vendida,
            "disponible": a.disponible,
            "fecha": a.fecha.isoformat(),
            "notas": a.notas or "",
        })
    return result


class POSAsignacionCreate(BaseModel):
    vendedor_id: int = Field(..., gt=0)
    producto_id: int = Field(..., gt=0)
    cantidad: float = Field(..., gt=0)
    fecha: str | None = None
    notas: str | None = None


@router.post("/api/asignacion", status_code=201)
def pos_crear_asignacion(
    data: POSAsignacionCreate,
    db: Session = Depends(get_db), user: dict = Depends(get_mobile_user),
):
    if user.get("rol") != "admin":
        raise HTTPException(403, "Solo el admin puede crear asignaciones")
    fecha = date.fromisoformat(data.fecha) if data.fecha else date.today()
    # Desactivar asignación previa del mismo vendedor+producto+fecha
    db.query(AsignacionStock).filter(
        AsignacionStock.vendedor_id == data.vendedor_id,
        AsignacionStock.producto_id == data.producto_id,
        AsignacionStock.fecha == fecha,
    ).update({"activo": False})
    asig = AsignacionStock(
        vendedor_id=data.vendedor_id,
        producto_id=data.producto_id,
        cantidad=data.cantidad,
        fecha=fecha,
        notas=data.notas,
    )
    db.add(asig)
    db.commit()
    db.refresh(asig)
    return {"id": asig.id, "cantidad": asig.cantidad, "disponible": asig.disponible}


@router.delete("/api/asignacion/{asig_id}", status_code=204)
def pos_borrar_asignacion(
    asig_id: int,
    db: Session = Depends(get_db), user: dict = Depends(get_mobile_user),
):
    if user.get("rol") != "admin":
        raise HTTPException(403, "Solo el admin puede eliminar asignaciones")
    asig = db.query(AsignacionStock).filter(AsignacionStock.id == asig_id).first()
    if not asig:
        raise HTTPException(404, "Asignación no encontrada")
    asig.activo = False
    db.commit()


# ── DASHBOARD ─────────────────────────────────────────────────────────────────

@router.get("/api/dashboard")
def pos_dashboard(db: Session = Depends(get_db), user: dict = Depends(get_mobile_user)):
    """Resumen del día para el admin."""
    hoy = date.today()
    ventas_hoy = (
        db.query(Venta)
        .filter(func.date(Venta.fecha_venta) == hoy, Venta.estado.in_(["confirmada", "cobrada"]))
        .all()
    )
    total_hoy = sum(v.total_neto for v in ventas_hoy)
    stock_total = (
        db.query(func.sum(LoteProductoTerminado.cantidad_actual))
        .filter(LoteProductoTerminado.activo == True, LoteProductoTerminado.tipo == "alfajor")
        .scalar() or 0
    )
    pedidos_pendientes = (
        db.query(func.count(Pedido.id))
        .filter(Pedido.estado.in_(["pendiente", "confirmado", "en_preparacion", "listo"]))
        .scalar() or 0
    )
    return {
        "ventas_hoy": len(ventas_hoy),
        "total_hoy": round(total_hoy, 2),
        "stock_alfajores": int(stock_total),
        "pedidos_pendientes": pedidos_pendientes,
    }


# ── HISTORIAL ─────────────────────────────────────────────────────────────────

@router.get("/api/historial")
def pos_historial(db: Session = Depends(get_db), user: dict = Depends(get_mobile_user)):
    """Ventas del día para el historial del POS."""
    hoy = date.today()
    ventas = (
        db.query(Venta)
        .filter(func.date(Venta.fecha_venta) == hoy, Venta.estado.in_(["confirmada", "cobrada"]))
        .order_by(Venta.fecha_venta.desc())
        .limit(50)
        .all()
    )
    result = []
    for v in ventas:
        detalles = []
        for d in v.detalles:
            nombre = "—"
            if d.lote_producto and d.lote_producto.producto:
                nombre = d.lote_producto.producto.nombre
            detalles.append({
                "nombre": nombre,
                "cantidad": int(d.cantidad),
                "precio_unitario": d.precio_unitario,
                "subtotal": round(d.cantidad * d.precio_unitario, 2),
            })
        result.append({
            "id": v.id,
            "numero_factura": v.numero_factura,
            "hora": v.fecha_venta.strftime("%H:%M"),
            "total": round(v.total_neto, 2),
            "descuento": round(v.descuento, 2),
            "forma_pago": v.forma_pago,
            "items": len(detalles),
            "detalles": detalles,
        })
    return result


# ── VENTA ─────────────────────────────────────────────────────────────────────

class POSItem(BaseModel):
    lote_id: int
    cantidad: int = Field(..., gt=0)
    precio_unitario: float = Field(..., ge=0)


class POSVentaCreate(BaseModel):
    items: list[POSItem]
    forma_pago: str = "efectivo"
    notas: str | None = None
    descuento: float = Field(0.0, ge=0.0, le=10_000_000)


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
        venta = crear_venta(db, None, detalles, None, data.descuento, notas, data.forma_pago, True)
        db.commit()
        db.refresh(venta)
        return {"id": venta.id, "numero_factura": venta.numero_factura, "total": round(venta.total_neto, 2)}
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))


# ── CLIENTES ──────────────────────────────────────────────────────────────────

@router.get("/api/clientes")
def pos_clientes(db: Session = Depends(get_db), user: dict = Depends(get_mobile_user)):
    """Lista de clientes activos para tomador de pedidos."""
    clientes = (
        db.query(Cliente)
        .filter(Cliente.activo == True, Cliente.nombre != "Consumidor Final")
        .order_by(Cliente.nombre)
        .all()
    )
    return [
        {"id": c.id, "nombre": c.nombre_completo, "telefono": c.telefono or "", "tipo": c.tipo_cliente}
        for c in clientes
    ]


# ── PRODUCTOS (para pedidos) ───────────────────────────────────────────────────

@router.get("/api/productos")
def pos_productos(db: Session = Depends(get_db), user: dict = Depends(get_mobile_user)):
    """Lista de productos activos con precio base para crear pedidos."""
    productos = (
        db.query(ProductoTerminado)
        .filter(ProductoTerminado.activo == True)
        .order_by(ProductoTerminado.nombre)
        .all()
    )
    return [
        {"id": p.id, "nombre": p.nombre, "precio": p.precio_venta_base}
        for p in productos
    ]


# ── PEDIDOS ───────────────────────────────────────────────────────────────────

@router.get("/api/pedidos")
def pos_pedidos(
    estado: str | None = None,
    db: Session = Depends(get_db),
    user: dict = Depends(get_mobile_user),
):
    """Lista de pedidos. Repartidor ve solo los pendientes de entrega."""
    q = db.query(Pedido)
    if estado:
        q = q.filter(Pedido.estado == estado)
    elif user.get("rol") == "repartidor":
        q = q.filter(Pedido.estado.in_(["pendiente", "confirmado", "en_preparacion", "listo"]))
    pedidos = q.order_by(Pedido.fecha_entrega_requerida.asc().nullslast(), Pedido.fecha_pedido.desc()).limit(100).all()
    result = []
    for p in pedidos:
        detalles = [
            {"nombre": d.producto.nombre, "cantidad": int(d.cantidad), "precio": d.precio_unitario}
            for d in p.detalles
        ]
        result.append({
            "id": p.id,
            "numero_pedido": p.numero_pedido,
            "cliente": p.cliente.nombre_completo,
            "cliente_tel": p.cliente.telefono or "",
            "estado": p.estado,
            "total_estimado": round(p.total_estimado, 2),
            "notas": p.notas or "",
            "fecha_entrega": p.fecha_entrega_requerida.strftime("%d/%m/%y %H:%M") if p.fecha_entrega_requerida else None,
            "detalles": detalles,
        })
    return result


class POSPedidoItem(BaseModel):
    producto_id: int = Field(..., gt=0)
    cantidad: float = Field(..., gt=0)
    precio_unitario: float = Field(..., ge=0)


class POSPedidoCreate(BaseModel):
    cliente_id: int = Field(..., gt=0)
    fecha_entrega: str | None = None
    notas: str | None = Field(None, max_length=500)
    items: list[POSPedidoItem]


@router.post("/api/pedido", status_code=201)
def pos_crear_pedido(
    data: POSPedidoCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_mobile_user),
):
    cliente = db.query(Cliente).filter(Cliente.id == data.cliente_id, Cliente.activo == True).first()
    if not cliente:
        raise HTTPException(404, "Cliente no encontrado")
    if not data.items:
        raise HTTPException(400, "El pedido debe tener al menos un producto")

    fecha_entrega = None
    if data.fecha_entrega:
        try:
            fecha_entrega = datetime.fromisoformat(data.fecha_entrega)
        except ValueError:
            pass

    pedido = Pedido(
        cliente_id=data.cliente_id,
        numero_pedido=generar_numero_pedido(db),
        fecha_entrega_requerida=fecha_entrega,
        notas=data.notas or f"Pedido via POS — {user.get('username', '')}",
        estado=EstadoPedido.pendiente,
    )
    db.add(pedido)
    db.flush()

    total = 0.0
    for item in data.items:
        producto = db.query(ProductoTerminado).filter(ProductoTerminado.id == item.producto_id).first()
        if not producto:
            db.rollback()
            raise HTTPException(404, f"Producto {item.producto_id} no encontrado")
        det = PedidoDetalle(
            pedido_id=pedido.id,
            producto_id=item.producto_id,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,
        )
        db.add(det)
        total += item.cantidad * item.precio_unitario

        # Reservar stock FEFO
        lotes = (
            db.query(LoteProductoTerminado)
            .filter(
                LoteProductoTerminado.producto_id == item.producto_id,
                LoteProductoTerminado.activo == True,
                LoteProductoTerminado.cantidad_actual > 0,
            )
            .all()
        )
        lotes_fefo = sorted([l for l in lotes if l.fecha_vencimiento], key=lambda l: l.fecha_vencimiento) + [l for l in lotes if not l.fecha_vencimiento]
        pendiente = item.cantidad
        for lote in lotes_fefo:
            if pendiente <= 0:
                break
            libre = lote.cantidad_actual - lote.cantidad_reservada
            reservar = min(libre, pendiente)
            if reservar <= 0:
                continue
            lote.cantidad_reservada += reservar
            db.add(PedidoReserva(pedido_id=pedido.id, lote_id=lote.id, cantidad=reservar))
            pendiente -= reservar

    pedido.total_estimado = total
    db.commit()
    db.refresh(pedido)
    return {
        "id": pedido.id,
        "numero_pedido": pedido.numero_pedido,
        "total_estimado": round(pedido.total_estimado, 2),
    }


class POSVentaEdit(BaseModel):
    forma_pago: str | None = None
    descuento: float | None = Field(None, ge=0)


@router.patch("/api/venta/{venta_id}")
def pos_editar_venta(
    venta_id: int, data: POSVentaEdit,
    db: Session = Depends(get_db), user: dict = Depends(get_mobile_user),
):
    venta = db.query(Venta).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(404, "Venta no encontrada")
    if venta.estado == "cancelada":
        raise HTTPException(400, "No se puede editar una venta anulada")
    if data.forma_pago:
        venta.forma_pago = data.forma_pago
    if data.descuento is not None:
        bruto = venta.total_bruto if hasattr(venta, 'total_bruto') else (venta.total_neto + venta.descuento)
        venta.descuento = data.descuento
        venta.total_neto = max(0, bruto - data.descuento)
    db.commit()
    return {"id": venta.id, "forma_pago": venta.forma_pago, "total": round(venta.total_neto, 2)}


@router.patch("/api/venta/{venta_id}/anular")
def pos_anular_venta(
    venta_id: int,
    db: Session = Depends(get_db), user: dict = Depends(get_mobile_user),
):
    venta = db.query(Venta).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(404, "Venta no encontrada")
    if venta.estado == "cancelada":
        raise HTTPException(400, "Ya está anulada")
    venta.estado = "cancelada"
    db.commit()
    return {"id": venta.id, "estado": "cancelada"}


class POSEstadoUpdate(BaseModel):
    estado: str


@router.patch("/api/pedido/{pedido_id}/estado")
def pos_actualizar_estado(
    pedido_id: int,
    data: POSEstadoUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_mobile_user),
):
    """Repartidor marca entregado, admin puede cambiar cualquier estado."""
    pedido = db.query(Pedido).filter(Pedido.id == pedido_id).first()
    if not pedido:
        raise HTTPException(404, "Pedido no encontrado")

    estados_validos = {e.value for e in EstadoPedido}
    if data.estado not in estados_validos:
        raise HTTPException(400, f"Estado inválido. Opciones: {', '.join(estados_validos)}")

    rol = user.get("rol", "")
    if rol == "repartidor" and data.estado not in ("entregado", "listo"):
        raise HTTPException(403, "El repartidor solo puede marcar como entregado o listo")

    pedido.estado = data.estado
    db.commit()
    return {"id": pedido.id, "estado": pedido.estado}


# ── USUARIOS (CONFIG) ─────────────────────────────────────────────────────

@router.get("/api/usuarios")
def pos_usuarios(db: Session = Depends(get_db), user: dict = Depends(get_mobile_user)):
    if user.get("rol") != "admin":
        raise HTTPException(403, "Solo el admin puede ver empleados")
    usuarios = db.query(Usuario).order_by(Usuario.nombre).all()
    return [{"id": u.id, "username": u.username, "nombre": u.nombre, "rol": u.rol, "activo": u.activo} for u in usuarios]


class POSActivoUpdate(BaseModel):
    activo: bool


@router.patch("/api/usuario/{usuario_id}/activo")
def pos_toggle_usuario(
    usuario_id: int, data: POSActivoUpdate,
    db: Session = Depends(get_db), user: dict = Depends(get_mobile_user),
):
    if user.get("rol") != "admin":
        raise HTTPException(403, "Solo el admin puede modificar empleados")
    u = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    u.activo = data.activo
    db.commit()
    return {"id": u.id, "activo": u.activo}


# ── PRECIO PRODUCTO (CONFIG) ──────────────────────────────────────────────

class POSPrecioUpdate(BaseModel):
    precio: float = Field(..., ge=0)


@router.patch("/api/producto/{producto_id}/precio")
def pos_actualizar_precio(
    producto_id: int, data: POSPrecioUpdate,
    db: Session = Depends(get_db), user: dict = Depends(get_mobile_user),
):
    if user.get("rol") != "admin":
        raise HTTPException(403, "Solo el admin puede modificar precios")
    p = db.query(ProductoTerminado).filter(ProductoTerminado.id == producto_id).first()
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    p.precio_venta_base = data.precio
    db.commit()
    return {"id": p.id, "precio": p.precio_venta_base}


# ── INSUMOS (para dropdown compras) ──────────────────────────────────────

@router.get("/api/insumos")
def pos_insumos(db: Session = Depends(get_db), user: dict = Depends(get_mobile_user)):
    if user.get("rol") != "admin":
        raise HTTPException(403, "Solo el admin puede ver insumos")
    insumos = db.query(Insumo).filter(Insumo.activo == True).order_by(Insumo.nombre).all()
    return [{"id": i.id, "nombre": i.nombre, "unidad": i.unidad_medida} for i in insumos]


# ── COMPRAS DE INSUMOS ────────────────────────────────────────────────────

@router.get("/api/compras")
def pos_compras(
    limit: int = 30,
    db: Session = Depends(get_db), user: dict = Depends(get_mobile_user),
):
    if user.get("rol") != "admin":
        raise HTTPException(403, "Solo el admin puede ver compras")
    from app.models.insumo import LoteInsumo
    lotes = (
        db.query(LoteInsumo)
        .filter(LoteInsumo.activo == True)
        .order_by(LoteInsumo.fecha_ingreso.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": l.id,
            "insumo_nombre": l.insumo.nombre if l.insumo else "—",
            "cantidad": l.cantidad_inicial,
            "unidad": l.insumo.unidad_medida if l.insumo else "",
            "total": round(l.cantidad_inicial * l.costo_unitario, 2),
            "proveedor": l.proveedor or "",
            "fecha": l.fecha_ingreso.strftime("%d/%m/%y"),
            "notas": l.notas or "",
        }
        for l in lotes
    ]


class POSCompraCreate(BaseModel):
    insumo_id: int = Field(..., gt=0)
    cantidad: float = Field(..., gt=0)
    precio_total: float = Field(..., ge=0)
    proveedor: str | None = Field(None, max_length=200)
    notas: str | None = Field(None, max_length=500)


@router.post("/api/compra", status_code=201)
def pos_crear_compra(
    data: POSCompraCreate,
    db: Session = Depends(get_db), user: dict = Depends(get_mobile_user),
):
    if user.get("rol") != "admin":
        raise HTTPException(403, "Solo el admin puede registrar compras")
    from app.models.insumo import LoteInsumo, OrdenCompra
    insumo = db.query(Insumo).filter(Insumo.id == data.insumo_id, Insumo.activo == True).first()
    if not insumo:
        raise HTTPException(404, "Insumo no encontrado")
    costo_unitario = round(data.precio_total / data.cantidad, 6) if data.cantidad > 0 else 0
    orden = OrdenCompra(
        proveedor=data.proveedor or "",
        total_sin_extra=data.precio_total,
        total_con_extra=data.precio_total,
    )
    db.add(orden)
    db.flush()
    numero_lote = f"MOB-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    lote = LoteInsumo(
        insumo_id=data.insumo_id,
        orden_compra_id=orden.id,
        numero_lote=numero_lote,
        cantidad_inicial=data.cantidad,
        cantidad_actual=data.cantidad,
        costo_unitario=costo_unitario,
        proveedor=data.proveedor,
        notas=data.notas or f"Carga vía app móvil — {user.get('username', '')}",
    )
    db.add(lote)
    db.commit()
    db.refresh(lote)
    return {"id": lote.id, "numero_lote": lote.numero_lote, "cantidad": lote.cantidad_inicial}


# ── FINANZAS HOY ─────────────────────────────────────────────────────────

@router.get("/api/finanzas/hoy")
def pos_finanzas_hoy(db: Session = Depends(get_db), user: dict = Depends(get_mobile_user)):
    if user.get("rol") != "admin":
        raise HTTPException(403, "Solo el admin puede ver finanzas")
    hoy = date.today()
    ventas = (
        db.query(Venta)
        .filter(func.date(Venta.fecha_venta) == hoy, Venta.estado.in_(["confirmada", "cobrada"]))
        .order_by(Venta.fecha_venta.desc())
        .all()
    )
    efectivo      = sum(v.total_neto for v in ventas if v.forma_pago == "efectivo")
    transferencia = sum(v.total_neto for v in ventas if v.forma_pago in ("transferencia", "debito", "credito"))
    fiado         = sum(v.total_neto for v in ventas if v.forma_pago in ("cuenta_corriente", "fiado"))
    cobrado_total = efectivo + transferencia

    gastos_hoy = sum(g.monto for g in db.query(Gasto).filter(func.date(Gasto.fecha) == hoy).all())

    ventas_list = []
    for v in ventas:
        ventas_list.append({
            "id": v.id,
            "numero_factura": v.numero_factura,
            "hora": v.fecha_venta.strftime("%H:%M"),
            "total": round(v.total_neto, 2),
            "forma_pago": v.forma_pago,
        })

    return {
        "cobrado_total": round(cobrado_total, 2),
        "efectivo": round(efectivo, 2),
        "transferencia": round(transferencia, 2),
        "fiado": round(fiado, 2),
        "gastos_hoy": round(gastos_hoy, 2),
        "saldo_neto": round(cobrado_total - gastos_hoy, 2),
        "cant_ventas": len(ventas),
        "ventas": ventas_list,
    }


# ── CUENTAS CORRIENTES ────────────────────────────────────────────────────

@router.get("/api/cuentas")
def pos_cuentas(db: Session = Depends(get_db), user: dict = Depends(get_mobile_user)):
    if user.get("rol") not in ("admin",):
        raise HTTPException(403, "Solo el admin puede ver cuentas corrientes")
    ventas_cc = (
        db.query(Venta)
        .filter(Venta.forma_pago.in_(["cuenta_corriente", "fiado"]), Venta.estado.in_(["confirmada", "cobrada"]))
        .filter(Venta.cliente_id.isnot(None))
        .order_by(Venta.fecha_venta.desc())
        .all()
    )
    from collections import defaultdict
    clientes = defaultdict(lambda: {"saldo": 0.0, "ventas": [], "ultima_venta": ""})
    for v in ventas_cc:
        cid = v.cliente_id
        clientes[cid]["saldo"] += v.total_neto
        clientes[cid]["ultima_venta"] = v.fecha_venta.strftime("%d/%m/%y")
        clientes[cid]["ventas"].append({
            "id": v.id,
            "numero_factura": v.numero_factura,
            "hora": v.fecha_venta.strftime("%d/%m/%y %H:%M"),
            "total": round(v.total_neto, 2),
        })
    result = []
    for cid, data in clientes.items():
        cliente = db.query(Cliente).filter(Cliente.id == cid).first()
        if not cliente:
            continue
        result.append({
            "cliente_id": cid,
            "cliente": cliente.nombre_completo if hasattr(cliente, 'nombre_completo') else cliente.nombre,
            "saldo": round(data["saldo"], 2),
            "cant_ventas": len(data["ventas"]),
            "ultima_venta": data["ultima_venta"],
            "ventas": data["ventas"][:10],
        })
    result.sort(key=lambda x: x["saldo"], reverse=True)
    return result


# ── FINANZAS RESUMEN ──────────────────────────────────────────────────────

@router.get("/api/finanzas/resumen")
def pos_finanzas_resumen(db: Session = Depends(get_db), user: dict = Depends(get_mobile_user)):
    if user.get("rol") != "admin":
        raise HTTPException(403, "Solo el admin puede ver finanzas")
    from app.models.insumo import LoteInsumo
    hoy = date.today()
    inicio_mes = hoy.replace(day=1)

    ventas_mes = (
        db.query(Venta)
        .filter(func.date(Venta.fecha_venta) >= inicio_mes, Venta.estado.in_(["confirmada", "cobrada"]))
        .all()
    )
    ingresos = sum(v.total_neto for v in ventas_mes)

    lotes_mes = (
        db.query(LoteInsumo)
        .filter(func.date(LoteInsumo.fecha_ingreso) >= inicio_mes, LoteInsumo.activo == True)
        .all()
    )
    costos = sum(l.cantidad_inicial * l.costo_unitario for l in lotes_mes)
    cant_compras = len(lotes_mes)

    gastos_mes = (
        db.query(Gasto)
        .filter(func.date(Gasto.fecha) >= inicio_mes)
        .all()
    )
    gastos = sum(g.monto for g in gastos_mes)

    return {
        "ingresos": round(ingresos, 2),
        "costos": round(costos, 2),
        "gastos": round(gastos, 2),
        "ganancia": round(ingresos - costos - gastos, 2),
        "cant_ventas": len(ventas_mes),
        "cant_compras": cant_compras,
        "mes": inicio_mes.strftime("%B %Y"),
    }
