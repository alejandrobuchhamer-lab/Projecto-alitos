from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.producto import ProductoTerminado, LoteProductoTerminado
from app.templates import templates

router = APIRouter(prefix="/productos", tags=["productos"])


class ProductoCreate(BaseModel):
    nombre: str
    descripcion: str | None = None
    categoria: str = "general"
    unidad_medida: str = "unidad"
    precio_venta_base: float = 0.0
    stock_minimo: float = 0.0
    dias_vida_util: int | None = None


class ProductoOut(BaseModel):
    id: int
    nombre: str
    descripcion: str | None = None
    categoria: str
    unidad_medida: str
    precio_venta_base: float
    stock_minimo: float
    dias_vida_util: int | None = None
    activo: bool
    stock_actual: float = 0.0

    model_config = {"from_attributes": True}


class ProductoUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    categoria: str | None = None
    precio_venta_base: float | None = None
    stock_minimo: float | None = None
    dias_vida_util: int | None = None
    activo: bool | None = None


@router.get("/", response_class=HTMLResponse)
def lista_productos_html(request: Request, db: Session = Depends(get_db)):
    from datetime import datetime
    productos = db.query(ProductoTerminado).filter(ProductoTerminado.activo == True).order_by(ProductoTerminado.nombre).all()
    # Lotes alfajor activos con stock para la vista Stock Comercial
    lotes_alfajor = (
        db.query(LoteProductoTerminado)
        .filter(
            LoteProductoTerminado.tipo == "alfajor",
            LoteProductoTerminado.activo == True,
            LoteProductoTerminado.cantidad_actual > 0,
        )
        .order_by(LoteProductoTerminado.fecha_vencimiento.asc().nullslast())
        .all()
    )
    # Mapa producto_id → producto para el template
    prod_map = {p.id: p for p in productos}
    # Totales para KPIs
    total_unidades = sum(l.cantidad_actual for l in lotes_alfajor)
    total_costo = sum(l.cantidad_actual * (l.costo_unitario_calculado or 0) for l in lotes_alfajor)
    total_venta = sum(
        l.cantidad_actual * (prod_map.get(l.producto_id, {}) and prod_map[l.producto_id].precio_venta_base or 0)
        for l in lotes_alfajor if l.producto_id in prod_map
    )
    margen_total = total_venta - total_costo
    return templates.TemplateResponse("productos/lista.html", {
        "request": request,
        "productos": productos,
        "lotes_alfajor": lotes_alfajor,
        "prod_map": prod_map,
        "kpi_unidades": int(total_unidades),
        "kpi_costo": round(total_costo, 0),
        "kpi_venta": round(total_venta, 0),
        "kpi_margen": round(margen_total, 0),
    })


@router.get("/api", response_model=list[ProductoOut])
def listar_productos(db: Session = Depends(get_db)):
    return [ProductoOut.model_validate(p) for p in db.query(ProductoTerminado).filter(ProductoTerminado.activo == True).all()]


@router.post("/api", response_model=ProductoOut, status_code=201)
def crear_producto(data: ProductoCreate, db: Session = Depends(get_db)):
    existing = db.query(ProductoTerminado).filter(ProductoTerminado.nombre == data.nombre).first()
    if existing:
        raise HTTPException(400, f"Ya existe un producto con el nombre '{data.nombre}'")
    producto = ProductoTerminado(**data.model_dump())
    db.add(producto)
    db.commit()
    db.refresh(producto)
    return ProductoOut.model_validate(producto)


@router.get("/api/{producto_id}", response_model=ProductoOut)
def obtener_producto(producto_id: int, db: Session = Depends(get_db)):
    p = db.query(ProductoTerminado).filter(ProductoTerminado.id == producto_id).first()
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    return ProductoOut.model_validate(p)


@router.put("/api/{producto_id}", response_model=ProductoOut)
def actualizar_producto(producto_id: int, data: ProductoUpdate, db: Session = Depends(get_db)):
    p = db.query(ProductoTerminado).filter(ProductoTerminado.id == producto_id).first()
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return ProductoOut.model_validate(p)


@router.delete("/api/{producto_id}")
def eliminar_producto(producto_id: int, db: Session = Depends(get_db)):
    p = db.query(ProductoTerminado).filter(ProductoTerminado.id == producto_id).first()
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    p.activo = False
    db.commit()
    return {"ok": True}


class LoteManualCreate(BaseModel):
    cantidad: float
    costo_unitario: float = 0.0
    notas: str | None = None
    fecha_vencimiento: datetime | None = None


@router.post("/api/{producto_id}/lote-manual", status_code=201)
def agregar_lote_manual(producto_id: int, data: LoteManualCreate, db: Session = Depends(get_db)):
    """Ingresa stock manualmente (sin producción, para pruebas o ajuste de inventario)."""
    p = db.query(ProductoTerminado).filter(ProductoTerminado.id == producto_id).first()
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    count = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.producto_id == producto_id).count() + 1
    numero = f"MANUAL-{producto_id:03d}-{datetime.utcnow().strftime('%Y%m%d')}-{count:04d}"
    lote = LoteProductoTerminado(
        producto_id=producto_id,
        numero_lote=numero,
        cantidad_inicial=data.cantidad,
        cantidad_actual=data.cantidad,
        costo_unitario_calculado=data.costo_unitario,
        fecha_produccion=datetime.utcnow(),
        fecha_vencimiento=data.fecha_vencimiento,
        notas=data.notas or "Ingreso manual",
    )
    db.add(lote)
    db.commit()
    db.refresh(lote)
    return {"id": lote.id, "numero_lote": lote.numero_lote, "cantidad": data.cantidad}


@router.get("/api/{producto_id}/lotes")
def lotes_producto(producto_id: int, db: Session = Depends(get_db)):
    lotes = db.query(LoteProductoTerminado).filter(
        LoteProductoTerminado.producto_id == producto_id,
        LoteProductoTerminado.activo == True,
        LoteProductoTerminado.cantidad_actual > 0,
        LoteProductoTerminado.tipo == "alfajor",
    ).order_by(LoteProductoTerminado.fecha_vencimiento.asc().nullslast()).all()
    return [{
        "id": l.id,
        "numero_lote": l.numero_lote,
        "cantidad_actual": l.cantidad_actual,
        "cantidad_reservada": l.cantidad_reservada,
        "cantidad_libre": l.cantidad_libre,
        "costo_unitario_calculado": l.costo_unitario_calculado,
        "fecha_produccion": l.fecha_produccion,
        "fecha_vencimiento": l.fecha_vencimiento,
        "dias_para_vencer": l.dias_para_vencer,
    } for l in lotes]
