from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.usuario import Usuario
from app.models.vendedor import StockVendedor, EntregaNegocio
from app.models.negocio import Negocio
from app.routers.auth import permiso, require_user, require_admin
from app.templates import templates

router = APIRouter(prefix="/vendedores", tags=["vendedores"])


# ── Páginas ───────────────────────────────────────────────────────────────────

@router.get("/", response_class=HTMLResponse)
def vendedores_index(request: Request, db: Session = Depends(get_db), _u: Usuario = Depends(permiso("vendedores"))):
    return templates.TemplateResponse("vendedores/index.html", {"request": request})


# ── API: Negocios ─────────────────────────────────────────────────────────────

@router.get("/api/negocios")
def listar_negocios(db: Session = Depends(get_db)):
    return [{
        "id": n.id, "nombre": n.nombre, "direccion": n.direccion,
        "contacto": n.contacto, "telefono": n.telefono,
        "lat": n.lat, "lng": n.lng, "notas": n.notas,
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
    for field in ("nombre", "direccion", "contacto", "telefono", "lat", "lng", "notas"):
        if field in data:
            setattr(n, field, data[field])
    db.commit()
    return {"ok": True}


# ── API: Stock vendedor ───────────────────────────────────────────────────────

@router.get("/api/stock")
def listar_stock_vendedores(vendedor_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(StockVendedor).filter(StockVendedor.activo == True)
    if vendedor_id:
        q = q.filter(StockVendedor.vendedor_id == vendedor_id)
    stocks = q.all()
    vendedores_map = {u.id: u for u in db.query(Usuario).filter(Usuario.activo == True).all()}
    from app.models.producto import ProductoTerminado
    productos_map = {p.id: p for p in db.query(ProductoTerminado).all()}
    return [{
        "id":                 s.id,
        "vendedor_id":        s.vendedor_id,
        "vendedor":           vendedores_map.get(s.vendedor_id, {}).nombre if s.vendedor_id in vendedores_map else "?",
        "producto_id":        s.producto_id,
        "producto":           productos_map.get(s.producto_id, {}).nombre if s.producto_id in productos_map else "?",
        "cantidad_asignada":  s.cantidad_asignada,
        "cantidad_disponible": s.cantidad_disponible,
        "precio_unitario":    s.precio_unitario,
        "fecha_asignacion":   s.fecha_asignacion.strftime("%d/%m/%Y %H:%M"),
        "notas":              s.notas,
    } for s in stocks]


@router.post("/api/stock", status_code=201)
def asignar_stock(data: dict, db: Session = Depends(get_db), user: Usuario = Depends(require_admin)):
    """Solo admin puede asignar stock a vendedores."""
    vendedor = db.query(Usuario).filter(Usuario.id == data["vendedor_id"], Usuario.activo == True).first()
    if not vendedor:
        raise HTTPException(404, "Vendedor no encontrado")
    s = StockVendedor(
        vendedor_id=data["vendedor_id"],
        producto_id=data["producto_id"],
        cantidad_asignada=float(data["cantidad"]),
        cantidad_disponible=float(data["cantidad"]),
        precio_unitario=data.get("precio_unitario"),
        notas=data.get("notas"),
        asignado_por_id=user.id,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    # Enviar push al vendedor
    try:
        from app.routers.push import enviar_push
        from app.models.producto import ProductoTerminado
        prod = db.query(ProductoTerminado).filter(ProductoTerminado.id == data["producto_id"]).first()
        enviar_push(db, vendedor.id, {
            "title": "Nuevo stock asignado",
            "body":  f"Se te asignó {int(data['cantidad'])} unidades de {prod.nombre if prod else 'producto'}",
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


# ── API: Vendedores (lista de usuarios con rol vendedor) ──────────────────────

@router.get("/api/vendedores")
def listar_vendedores(db: Session = Depends(get_db), _u: Usuario = Depends(require_admin)):
    users = db.query(Usuario).filter(
        Usuario.activo == True,
        Usuario.rol.in_(["vendedor", "admin"])
    ).order_by(Usuario.nombre).all()
    return [{"id": u.id, "nombre": u.nombre, "username": u.username, "rol": u.rol} for u in users]
