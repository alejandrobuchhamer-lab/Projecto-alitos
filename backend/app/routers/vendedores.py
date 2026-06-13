import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from app.events import broadcast_event
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.usuario import Usuario
from app.models.vendedor import StockVendedor, EntregaNegocio, VentaVendedor, StockVendedorLote
from app.models.negocio import Negocio
from app.routers.auth import permiso, require_user, require_admin
from app.templates import templates

router = APIRouter(prefix="/vendedores", tags=["vendedores"])


# ── Páginas ───────────────────────────────────────────────────────────────────

@router.get("/", response_class=HTMLResponse)
def vendedores_index(request: Request, db: Session = Depends(get_db), _u: Usuario = Depends(permiso("vendedores"))):
    return templates.TemplateResponse("vendedores/index.html", {"request": request})


@router.get("/ventas", response_class=HTMLResponse)
def ventas_vendedor_web(
    request: Request,
    db: Session = Depends(get_db),
    _u: Usuario = Depends(permiso("ventas")),
    vendedor_id: int | None = None,
    estado_pago: str | None = None,
    dias: int = 30,
):
    from sqlalchemy import func
    from app.models.producto import ProductoTerminado
    desde = datetime.utcnow().replace(hour=0, minute=0, second=0) - __import__("datetime").timedelta(days=dias - 1)
    q = db.query(VentaVendedor).filter(VentaVendedor.fecha >= desde)
    if vendedor_id:
        q = q.filter(VentaVendedor.vendedor_id == vendedor_id)
    if estado_pago:
        q = q.filter(VentaVendedor.estado_pago == estado_pago)
    ventas = q.order_by(VentaVendedor.fecha.desc()).limit(500).all()
    productos_map = {p.id: p for p in db.query(ProductoTerminado).all()}
    vendedores = db.query(Usuario).filter(
        Usuario.activo == True, Usuario.rol.in_(["vendedor", "admin"])
    ).order_by(Usuario.nombre).all()
    ventas_json = json.dumps([_fmt_venta(v, productos_map) for v in ventas], ensure_ascii=False)
    return templates.TemplateResponse("vendedores/ventas.html", {
        "request":    request,
        "ventas":     ventas,
        "ventas_json": ventas_json,
        "vendedores": vendedores,
        "dias":       dias,
        "productos_map": productos_map,
    })


# ── API: Negocios ─────────────────────────────────────────────────────────────

@router.get("/api/negocios")
def listar_negocios(db: Session = Depends(get_db)):
    return [{
        "id": n.id, "nombre": n.nombre, "direccion": n.direccion,
        "contacto": n.contacto, "telefono": n.telefono,
        "lat": n.lat, "lng": n.lng, "notas": n.notas,
        "foto": n.foto,
    } for n in db.query(Negocio).filter(Negocio.activo == True).order_by(Negocio.nombre).all()]


@router.post("/api/negocios", status_code=201)
def crear_negocio(data: dict, db: Session = Depends(get_db), _u: Usuario = Depends(permiso("vendedores"))):
    n = Negocio(
        nombre=data["nombre"],
        direccion=data.get("direccion"),
        contacto=data.get("contacto"),
        telefono=data.get("telefono"),
        lat=data.get("lat"),
        lng=data.get("lng"),
        notas=data.get("notas"),
        foto=data.get("foto"),
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return {"id": n.id, "nombre": n.nombre}


@router.put("/api/negocios/{nid}")
def actualizar_negocio(nid: int, data: dict, db: Session = Depends(get_db), _u: Usuario = Depends(permiso("vendedores"))):
    n = db.query(Negocio).filter(Negocio.id == nid).first()
    if not n:
        raise HTTPException(404, "Negocio no encontrado")
    for field in ("nombre", "direccion", "contacto", "telefono", "lat", "lng", "notas", "foto"):
        if field in data:
            setattr(n, field, data[field])
    db.commit()
    return {"ok": True}


# ── API: Stock vendedor ───────────────────────────────────────────────────────

@router.get("/api/stock")
def listar_stock_vendedores(
    vendedor_id: int | None = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_user),
):
    q = db.query(StockVendedor).filter(StockVendedor.activo == True)
    # Vendedores no-admin solo ven su propio stock
    if user.rol != "admin":
        q = q.filter(StockVendedor.vendedor_id == user.id)
    elif vendedor_id:
        q = q.filter(StockVendedor.vendedor_id == vendedor_id)
    stocks = q.all()
    vendedores_map = {u.id: u for u in db.query(Usuario).filter(Usuario.activo == True).all()}
    from app.models.producto import ProductoTerminado
    productos_map = {p.id: p for p in db.query(ProductoTerminado).all()}
    return [{
        "id":                  s.id,
        "vendedor_id":         s.vendedor_id,
        "vendedor":            vendedores_map[s.vendedor_id].nombre if s.vendedor_id in vendedores_map else "?",
        "producto_id":         s.producto_id,
        "producto":            productos_map[s.producto_id].nombre if s.producto_id in productos_map else "?",
        "cantidad_asignada":   s.cantidad_asignada,
        "cantidad_disponible": s.cantidad_disponible,
        "precio_unitario":     s.precio_unitario,
        "fecha_asignacion":    s.fecha_asignacion.strftime("%d/%m/%Y %H:%M"),
        "notas":               s.notas,
    } for s in stocks]


@router.post("/api/stock", status_code=201)
def asignar_stock(data: dict, db: Session = Depends(get_db), user: Usuario = Depends(require_admin)):
    """Solo admin puede asignar stock a vendedores. Consume lotes FEFO y registra costo por lote."""
    from app.models.producto import LoteProductoTerminado, ProductoTerminado

    vendedor = db.query(Usuario).filter(Usuario.id == data["vendedor_id"], Usuario.activo == True).first()
    if not vendedor:
        raise HTTPException(404, "Vendedor no encontrado")

    cantidad_total = float(data["cantidad"])
    s = StockVendedor(
        vendedor_id=data["vendedor_id"],
        producto_id=data["producto_id"],
        cantidad_asignada=cantidad_total,
        cantidad_disponible=cantidad_total,
        precio_unitario=data.get("precio_unitario"),
        notas=data.get("notas"),
        asignado_por_id=user.id,
    )
    db.add(s)
    db.flush()  # obtener s.id antes del commit

    # FEFO: consumir lotes de más antiguo a más nuevo y registrar costo por lote
    lotes = db.query(LoteProductoTerminado).filter(
        LoteProductoTerminado.producto_id == data["producto_id"],
        LoteProductoTerminado.tipo == "alfajor",
        LoteProductoTerminado.activo == True,
        LoteProductoTerminado.cantidad_actual > 0,
    ).order_by(LoteProductoTerminado.fecha_produccion.asc()).all()

    restante = cantidad_total
    for lote in lotes:
        if restante <= 0:
            break
        tomar = min(restante, lote.cantidad_actual)
        lote.cantidad_actual -= tomar
        db.add(StockVendedorLote(
            stock_vendedor_id=s.id,
            lote_id=lote.id,
            cantidad_asignada=tomar,
            cantidad_disponible=tomar,
            costo_unitario=lote.costo_unitario_calculado or 0.0,
        ))
        restante -= tomar

    db.commit()
    db.refresh(s)
    broadcast_event("stock", {"vendedor_id": data["vendedor_id"]})

    try:
        from app.routers.push import enviar_push
        prod = db.query(ProductoTerminado).filter(ProductoTerminado.id == data["producto_id"]).first()
        enviar_push(db, vendedor.id, {
            "title": "Nuevo stock asignado",
            "body":  f"Se te asignó {int(cantidad_total)} unidades de {prod.nombre if prod else 'producto'}",
            "url":   "/vendedores/",
        })
    except Exception:
        pass
    return {"id": s.id, "ok": True}


# ── API: Entregas ─────────────────────────────────────────────────────────────

@router.get("/api/entregas")
def listar_entregas(
    activas: bool = False,
    vendedor_id: int | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(EntregaNegocio)
    if activas:
        q = q.filter(EntregaNegocio.cobrado == False, EntregaNegocio.retirado == False)
    if vendedor_id:
        q = q.filter(EntregaNegocio.vendedor_id == vendedor_id)
    entregas = q.order_by(EntregaNegocio.fecha.desc()).limit(200).all()

    negocios_map = {n.id: n for n in db.query(Negocio).all()}
    vendedores_map = {u.id: u for u in db.query(Usuario).all()}
    from app.models.producto import ProductoTerminado
    productos_map = {p.id: p for p in db.query(ProductoTerminado).all()}

    hoy = datetime.utcnow()
    result = []
    for e in entregas:
        negocio = negocios_map.get(e.negocio_id)
        vencimiento = e.fecha_vencimiento_mercaderia
        dias_restantes = (vencimiento - hoy).days if vencimiento else None
        result.append({
            "id":               e.id,
            "vendedor":         vendedores_map.get(e.vendedor_id, {}).nombre if e.vendedor_id in vendedores_map else "?",
            "vendedor_id":      e.vendedor_id,
            "negocio":          negocio.nombre if negocio else "?",
            "negocio_id":       e.negocio_id,
            "direccion":        negocio.direccion if negocio else None,
            "lat":              e.lat or (negocio.lat if negocio else None),
            "lng":              e.lng or (negocio.lng if negocio else None),
            "producto":         productos_map.get(e.producto_id, {}).nombre if e.producto_id in productos_map else "?",
            "cantidad":         e.cantidad,
            "precio_unitario":  e.precio_unitario,
            "fecha":            e.fecha.strftime("%d/%m/%Y %H:%M"),
            "vencimiento":      vencimiento.strftime("%d/%m/%Y") if vencimiento else None,
            "dias_restantes":   dias_restantes,
            "cobrado":          e.cobrado,
            "monto_cobrado":    e.monto_cobrado,
            "cantidad_cobrada": e.cantidad_cobrada,
            "retirado":         e.retirado,
            "cantidad_retirada": e.cantidad_retirada,
            "notas":            e.notas,
            "alerta_vencimiento": dias_restantes is not None and dias_restantes <= 7 and not e.cobrado and not e.retirado,
        })
    return result


@router.post("/api/entregas", status_code=201)
def registrar_entrega(data: dict, db: Session = Depends(get_db), user: Usuario = Depends(require_user)):
    negocio = db.query(Negocio).filter(Negocio.id == data["negocio_id"]).first()
    if not negocio:
        raise HTTPException(404, "Negocio no encontrado")
    dias = int(data.get("dias_consignacion", 7))
    fecha_vcto = datetime.utcnow() + timedelta(days=dias)

    # Descontar del stock del vendedor si se especificó
    stock_vend_id = data.get("stock_vendedor_id")
    if stock_vend_id:
        sv = db.query(StockVendedor).filter(StockVendedor.id == stock_vend_id).first()
        if sv:
            sv.cantidad_disponible = max(0, sv.cantidad_disponible - float(data["cantidad"]))

    e = EntregaNegocio(
        vendedor_id=user.id,
        negocio_id=data["negocio_id"],
        stock_vendedor_id=stock_vend_id,
        producto_id=data["producto_id"],
        cantidad=float(data["cantidad"]),
        precio_unitario=data.get("precio_unitario"),
        lat=data.get("lat") or negocio.lat,
        lng=data.get("lng") or negocio.lng,
        dias_consignacion=dias,
        fecha_vencimiento_mercaderia=fecha_vcto,
        notas=data.get("notas"),
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return {"id": e.id, "ok": True}


@router.put("/api/entregas/{eid}/cobrar")
def cobrar_entrega(eid: int, data: dict, db: Session = Depends(get_db), user: Usuario = Depends(require_user)):
    e = db.query(EntregaNegocio).filter(EntregaNegocio.id == eid).first()
    if not e:
        raise HTTPException(404)
    e.cobrado = True
    e.cantidad_cobrada = float(data.get("cantidad", e.cantidad))
    e.monto_cobrado = float(data.get("monto", 0))
    e.fecha_cobro = datetime.utcnow()
    db.commit()
    # Notificar al admin
    try:
        from app.routers.push import enviar_push
        enviar_push(db, None, {
            "title": "Venta registrada",
            "body":  f"{user.nombre} cobró ${e.monto_cobrado:.0f} ({int(e.cantidad_cobrada)} unidades)",
            "url":   "/vendedores/",
        }, a_todos_admins=True)
    except Exception:
        pass
    return {"ok": True}


@router.put("/api/entregas/{eid}/retirar")
def retirar_entrega(eid: int, data: dict, db: Session = Depends(get_db), user: Usuario = Depends(require_user)):
    e = db.query(EntregaNegocio).filter(EntregaNegocio.id == eid).first()
    if not e:
        raise HTTPException(404)
    e.retirado = True
    e.cantidad_retirada = float(data.get("cantidad", 0))
    # Devolver stock al vendedor
    if e.stock_vendedor_id and e.cantidad_retirada:
        sv = db.query(StockVendedor).filter(StockVendedor.id == e.stock_vendedor_id).first()
        if sv:
            sv.cantidad_disponible += e.cantidad_retirada
    db.commit()
    return {"ok": True}


# ── API: Venta directa ────────────────────────────────────────────────────────

_PAGO_A_CUENTA = {
    "efectivo":      "efectivo",
    "transferencia": "banco",
    "qr":            "mercadopago",
}


def _registrar_en_cuentas(db: Session, pagos: list, concepto: str, referencia: str, user_id: int) -> None:
    """Crea un MovimientoCuenta de entrada por cada pago cobrado (excluye consignacion)."""
    from app.models.cuenta import Cuenta, MovimientoCuenta
    for pago in pagos:
        metodo = pago.get("metodo", "efectivo")
        monto  = float(pago.get("monto", 0))
        if monto <= 0 or metodo == "consignacion":
            continue
        tipo_cuenta = _PAGO_A_CUENTA.get(metodo, "efectivo")
        cuenta = db.query(Cuenta).filter(
            Cuenta.tipo == tipo_cuenta, Cuenta.activo == True
        ).first()
        if not cuenta:
            cuenta = db.query(Cuenta).filter(Cuenta.activo == True).first()
        if not cuenta:
            continue
        db.add(MovimientoCuenta(
            cuenta_id=cuenta.id,
            tipo="entrada",
            monto=monto,
            concepto=concepto,
            referencia=referencia,
            creado_por_id=user_id,
        ))


def _calcular_costo_fefo(db: Session, sv_id: int, vendedor_id: int, cantidad: float) -> tuple[float, float]:
    """Consume StockVendedorLote FEFO y retorna (costo_total, costo_unitario)."""
    if not sv_id:
        return 0.0, 0.0
    lotes = db.query(StockVendedorLote).filter(
        StockVendedorLote.stock_vendedor_id == sv_id,
        StockVendedorLote.cantidad_disponible > 0,
    ).order_by(StockVendedorLote.fecha_asignacion.asc()).all()

    costo_total = 0.0
    restante = cantidad
    for svl in lotes:
        if restante <= 0:
            break
        tomar = min(restante, svl.cantidad_disponible)
        costo_total += tomar * svl.costo_unitario
        svl.cantidad_disponible -= tomar
        restante -= tomar

    costo_unit = round(costo_total / cantidad, 4) if cantidad > 0 else 0.0
    return round(costo_total, 4), costo_unit


def _fmt_venta(v: VentaVendedor, productos_map: dict) -> dict:
    pagos = []
    try:
        pagos = json.loads(v.pagos_json) if v.pagos_json else []
    except Exception:
        pass
    return {
        "id":               v.id,
        "hora":             v.fecha.strftime("%H:%M"),
        "fecha":            v.fecha.strftime("%d/%m %H:%M"),
        "producto":         productos_map[v.producto_id].nombre if v.producto_id in productos_map else "?",
        "producto_id":      v.producto_id,
        "cantidad":         v.cantidad,
        "precio_unitario":  v.precio_unitario,
        "monto_original":   v.monto_original or v.monto_total,
        "descuento_pct":    v.descuento_pct or 0,
        "descuento_monto":  v.descuento_monto or 0,
        "monto_total":      v.monto_total,
        "forma_pago":       v.forma_pago,
        "pagos":            pagos,
        "estado_pago":      v.estado_pago or "completo",
        "monto_pendiente":  v.monto_pendiente or 0,
        "lugar":            v.lugar,
        "tipo_cliente":     v.tipo_cliente or "consumidor_final",
        "cliente_id":       v.cliente_id,
        "cliente_nombre":   v.cliente_nombre or "",
        "costo_unitario":   v.costo_unitario_calculado or 0,
        "costo_total":      round((v.costo_unitario_calculado or 0) * v.cantidad, 2),
        "ganancia_bruta":   v.ganancia_bruta or 0,
        "ganancia_neta":    v.ganancia_neta or 0,
    }


@router.post("/api/venta-directa", status_code=201)
def registrar_venta_directa(data: dict, db: Session = Depends(get_db), user: Usuario = Depends(require_user)):
    """Venta del vendedor: descuenta stock FEFO, calcula costo y rentabilidad real."""
    cantidad = float(data["cantidad"])
    precio_unitario = float(data["precio_unitario"])
    sv_id = data.get("stock_vendedor_id")
    monto_original = round(cantidad * precio_unitario, 2)

    # Descuento
    descuento_pct = float(data.get("descuento_pct", 0))
    descuento_monto = float(data.get("descuento_monto", 0))
    if descuento_pct > 0 and descuento_monto == 0:
        descuento_monto = round(monto_original * descuento_pct / 100, 2)
    elif descuento_monto > 0 and descuento_pct == 0 and monto_original > 0:
        descuento_pct = round(descuento_monto / monto_original * 100, 2)
    monto_total = round(monto_original - descuento_monto, 2)

    # Pagos
    pagos_raw = data.get("pagos", [])
    if pagos_raw:
        pagos_json_str = json.dumps(pagos_raw)
        forma_pago = max(pagos_raw, key=lambda p: p.get("monto", 0)).get("metodo", "efectivo")
    else:
        forma_pago = data.get("forma_pago", "efectivo")
        pagos_json_str = json.dumps([{"metodo": forma_pago, "monto": monto_total}])

    estado_pago = data.get("estado_pago", "completo")
    monto_pendiente = float(data.get("monto_pendiente", 0))

    # Costo FEFO y descuento del stock
    costo_total, costo_unit = _calcular_costo_fefo(db, sv_id, user.id, cantidad)
    if sv_id:
        sv = db.query(StockVendedor).filter(
            StockVendedor.id == sv_id, StockVendedor.vendedor_id == user.id
        ).first()
        if sv:
            sv.cantidad_disponible = max(0, sv.cantidad_disponible - cantidad)

    ganancia_bruta = round(monto_total - costo_total, 2)

    v = VentaVendedor(
        vendedor_id=user.id,
        stock_vendedor_id=sv_id,
        producto_id=data.get("producto_id"),
        cantidad=cantidad,
        precio_unitario=precio_unitario,
        monto_original=monto_original,
        descuento_pct=descuento_pct,
        descuento_monto=descuento_monto,
        monto_total=monto_total,
        forma_pago=forma_pago,
        pagos_json=pagos_json_str,
        estado_pago=estado_pago,
        monto_pendiente=monto_pendiente,
        lugar=data.get("lugar"),
        lat=data.get("lat"),
        lng=data.get("lng"),
        notas=data.get("notas"),
        tipo_cliente=data.get("tipo_cliente", "consumidor_final"),
        cliente_id=data.get("cliente_id"),
        cliente_nombre=data.get("cliente_nombre"),
        costo_unitario_calculado=costo_unit,
        ganancia_bruta=ganancia_bruta,
        ganancia_neta=ganancia_bruta,
    )
    db.add(v)
    db.commit()
    db.refresh(v)

    # Registrar pagos cobrados en cuentas (excluye consignacion y monto pendiente)
    pagos_cobrados = [p for p in pagos_raw if p.get("metodo") != "consignacion" and float(p.get("monto", 0)) > 0]
    if not pagos_cobrados and estado_pago == "completo":
        pagos_cobrados = [{"metodo": forma_pago, "monto": monto_total}]
    cliente_str = data.get("cliente_nombre") or data.get("lugar") or "Consumidor Final"
    _registrar_en_cuentas(
        db, pagos_cobrados,
        concepto=f"Venta {int(cantidad)} u. — {cliente_str} ({user.nombre})",
        referencia=f"venta-{v.id}",
        user_id=user.id,
    )
    db.commit()
    broadcast_event("venta", {"vendedor_id": user.id})

    try:
        from app.routers.push import enviar_push
        enviar_push(db, None, {
            "title": "Venta directa",
            "body":  f"{user.nombre} vendió {int(cantidad)} uds · ${monto_total:.0f} ({forma_pago})",
            "url":   "/vendedores/",
        }, a_todos_admins=True)
    except Exception:
        pass

    return {
        "id":          v.id,
        "monto_total": v.monto_total,
        "costo":       costo_total,
        "ganancia":    ganancia_bruta,
        "ok":          True,
    }


@router.get("/api/mis-ventas")
def mis_ventas(db: Session = Depends(get_db), user: Usuario = Depends(require_user)):
    """Ventas directas del día del vendedor actual."""
    from sqlalchemy import func
    hoy = datetime.utcnow().date()
    ventas = db.query(VentaVendedor).filter(
        VentaVendedor.vendedor_id == user.id,
        func.date(VentaVendedor.fecha) == hoy,
    ).order_by(VentaVendedor.fecha.desc()).all()
    from app.models.producto import ProductoTerminado
    productos_map = {p.id: p for p in db.query(ProductoTerminado).all()}
    return [_fmt_venta(v, productos_map) for v in ventas]


@router.get("/api/ventas-pendientes")
def ventas_pendientes(db: Session = Depends(get_db), user: Usuario = Depends(require_user)):
    """Ventas con cobro incompleto (parcial o pendiente)."""
    q = db.query(VentaVendedor).filter(
        VentaVendedor.estado_pago.in_(["parcial", "pendiente"])
    )
    if user.rol != "admin":
        q = q.filter(VentaVendedor.vendedor_id == user.id)
    ventas = q.order_by(VentaVendedor.fecha.desc()).limit(100).all()
    from app.models.producto import ProductoTerminado
    productos_map = {p.id: p for p in db.query(ProductoTerminado).all()}
    return [_fmt_venta(v, productos_map) for v in ventas]


@router.put("/api/ventas/{vid}/completar-pago")
def completar_pago(vid: int, data: dict, db: Session = Depends(get_db), user: Usuario = Depends(require_user)):
    """Registra el pago faltante y cierra la venta."""
    v = db.query(VentaVendedor).filter(VentaVendedor.id == vid).first()
    if not v:
        raise HTTPException(404, "Venta no encontrada")
    if user.rol != "admin" and v.vendedor_id != user.id:
        raise HTTPException(403, "Sin permiso")

    forma_pago = data.get("forma_pago", "efectivo")
    monto_pagado = float(data.get("monto", v.monto_pendiente or 0))

    pagos = []
    try:
        pagos = json.loads(v.pagos_json) if v.pagos_json else []
    except Exception:
        pass
    pagos.append({"metodo": forma_pago, "monto": monto_pagado, "complemento": True})
    v.pagos_json = json.dumps(pagos)
    v.estado_pago = "completo"
    v.monto_pendiente = 0
    db.commit()

    _registrar_en_cuentas(
        db, [{"metodo": forma_pago, "monto": monto_pagado}],
        concepto=f"Cobro pendiente venta #{vid} ({v.cliente_nombre or v.lugar or 'CF'})",
        referencia=f"venta-{vid}",
        user_id=user.id,
    )
    db.commit()
    broadcast_event("pago", {"venta_id": vid})
    return {"ok": True}


@router.get("/api/resumen-vendedor")
def resumen_vendedor(db: Session = Depends(get_db), user: Usuario = Depends(require_user)):
    """Resumen del día: ventas, cobros, stock disponible."""
    from sqlalchemy import func
    hoy = datetime.utcnow().date()

    ventas_hoy = db.query(VentaVendedor).filter(
        VentaVendedor.vendedor_id == user.id,
        func.date(VentaVendedor.fecha) == hoy,
    ).all()

    cobros_hoy = db.query(EntregaNegocio).filter(
        EntregaNegocio.vendedor_id == user.id,
        EntregaNegocio.cobrado == True,
        func.date(EntregaNegocio.fecha_cobro) == hoy,
    ).all()

    stock = db.query(StockVendedor).filter(
        StockVendedor.vendedor_id == user.id,
        StockVendedor.activo == True,
    ).all()

    return {
        "unidades_vendidas": sum(v.cantidad for v in ventas_hoy),
        "monto_ventas":      sum(v.monto_total for v in ventas_hoy),
        "monto_cobros":      sum(e.monto_cobrado or 0 for e in cobros_hoy),
        "stock_disponible":  sum(s.cantidad_disponible for s in stock),
        "stock_asignado":    sum(s.cantidad_asignada for s in stock),
    }


# ── API: Ping (estado online) ─────────────────────────────────────────────────

@router.post("/api/ping")
def ping_vendedor(db: Session = Depends(get_db), user: Usuario = Depends(require_user)):
    """La app llama esto periódicamente para marcar al vendedor como online."""
    user.online = True
    user.ultima_actividad = datetime.utcnow()
    db.commit()
    return {"ok": True, "nombre": user.nombre}


# ── API: Vendedores (lista de usuarios con rol vendedor) ──────────────────────

@router.get("/api/vendedores")
def listar_vendedores(db: Session = Depends(get_db), user: Usuario = Depends(require_user)):
    if user.rol != "admin":
        return [{
            "id": user.id, "nombre": user.nombre,
            "username": user.username, "rol": user.rol,
            "online": user.online,
            "ultima_actividad": user.ultima_actividad.strftime("%H:%M") if user.ultima_actividad else None,
        }]
    # Marcar como offline los que no hacen ping hace más de 10 minutos
    cutoff = datetime.utcnow() - timedelta(minutes=10)
    users = db.query(Usuario).filter(
        Usuario.activo == True,
        Usuario.rol.in_(["vendedor", "admin"])
    ).order_by(Usuario.nombre).all()
    result = []
    for u in users:
        online = bool(u.online and u.ultima_actividad and u.ultima_actividad > cutoff)
        result.append({
            "id": u.id, "nombre": u.nombre, "username": u.username, "rol": u.rol,
            "online": online,
            "ultima_actividad": u.ultima_actividad.strftime("%d/%m %H:%M") if u.ultima_actividad else None,
        })
    return result


@router.get("/pins", response_class=HTMLResponse)
def pins_page(request: Request, _u: Usuario = Depends(require_admin)):
    users = []
    return templates.TemplateResponse("vendedores/pins.html", {"request": request})
