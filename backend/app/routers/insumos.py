from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.insumo import Insumo, LoteInsumo, OrdenCompra
from app.schemas.insumo import (
    InsumoCreate, InsumoUpdate, InsumoOut,
    LoteInsumoCreate, LoteInsumoUpdate, LoteInsumoOut,
    IngresoMasivoCreate, IngresoMasivoResult,
)
from app.templates import templates
from app.routers.auth import permiso
from app.models.usuario import Usuario

router = APIRouter(prefix="/insumos", tags=["insumos"])


def _auto_numero_lote(db: Session, insumo_id: int) -> str:
    count = db.query(LoteInsumo).filter(LoteInsumo.insumo_id == insumo_id).count() + 1
    return f"L{insumo_id:03d}-{datetime.utcnow().strftime('%Y%m%d')}-{count:03d}"


# ─── Páginas HTML ─────────────────────────────────────────────────────────────

@router.get("/", response_class=HTMLResponse)
def lista_insumos_html(request: Request, db: Session = Depends(get_db), _u: Usuario = Depends(permiso("insumos"))):
    insumos = db.query(Insumo).filter(Insumo.activo == True).order_by(Insumo.nombre).all()
    lotes = db.query(LoteInsumo).order_by(LoteInsumo.fecha_ingreso.desc()).limit(200).all()
    ordenes = db.query(OrdenCompra).order_by(OrdenCompra.fecha.desc()).limit(50).all()
    return templates.TemplateResponse("insumos/lista.html", {
        "request": request, "insumos": insumos, "lotes": lotes, "ordenes": ordenes
    })


@router.get("/ingresos", response_class=HTMLResponse)
def ingresos_html(request: Request, db: Session = Depends(get_db)):
    # Redirect legacy URL to unified page
    from fastapi.responses import RedirectResponse
    return RedirectResponse("/insumos/?tab=ingresos")


@router.get("/ingreso-nuevo", response_class=HTMLResponse)
def ingreso_nuevo_html(request: Request, db: Session = Depends(get_db)):
    insumos = db.query(Insumo).filter(Insumo.activo == True).order_by(Insumo.nombre).all()
    return templates.TemplateResponse("insumos/ingreso_nuevo.html", {
        "request": request, "insumos": insumos
    })


# ─── API Insumos ──────────────────────────────────────────────────────────────

@router.get("/api", response_model=list[InsumoOut])
def listar_insumos(db: Session = Depends(get_db)):
    insumos = db.query(Insumo).filter(Insumo.activo == True).order_by(Insumo.nombre).all()
    return [InsumoOut.model_validate(i) for i in insumos]


@router.post("/api", response_model=InsumoOut, status_code=201)
def crear_insumo(data: InsumoCreate, db: Session = Depends(get_db)):
    existing = db.query(Insumo).filter(Insumo.nombre == data.nombre).first()
    if existing:
        raise HTTPException(400, f"Ya existe un insumo con el nombre '{data.nombre}'")
    insumo = Insumo(**data.model_dump())
    db.add(insumo)
    db.commit()
    db.refresh(insumo)
    return InsumoOut.model_validate(insumo)


@router.get("/api/{insumo_id}", response_model=InsumoOut)
def obtener_insumo(insumo_id: int, db: Session = Depends(get_db)):
    insumo = db.query(Insumo).filter(Insumo.id == insumo_id).first()
    if not insumo:
        raise HTTPException(404, "Insumo no encontrado")
    return InsumoOut.model_validate(insumo)


@router.put("/api/{insumo_id}", response_model=InsumoOut)
def actualizar_insumo(insumo_id: int, data: InsumoUpdate, db: Session = Depends(get_db)):
    insumo = db.query(Insumo).filter(Insumo.id == insumo_id).first()
    if not insumo:
        raise HTTPException(404, "Insumo no encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(insumo, k, v)
    db.commit()
    db.refresh(insumo)
    return InsumoOut.model_validate(insumo)


@router.delete("/api/{insumo_id}")
def eliminar_insumo(insumo_id: int, db: Session = Depends(get_db)):
    insumo = db.query(Insumo).filter(Insumo.id == insumo_id).first()
    if not insumo:
        raise HTTPException(404, "Insumo no encontrado")
    insumo.activo = False
    db.commit()
    return {"ok": True}


# ─── API Lotes ────────────────────────────────────────────────────────────────

@router.get("/{insumo_id}/lotes", response_model=list[LoteInsumoOut])
def listar_lotes(insumo_id: int, db: Session = Depends(get_db)):
    lotes = db.query(LoteInsumo).filter(
        LoteInsumo.insumo_id == insumo_id,
        LoteInsumo.activo == True,
    ).order_by(LoteInsumo.fecha_vencimiento.asc().nullslast()).all()
    return [LoteInsumoOut.model_validate(l) for l in lotes]


@router.get("/{insumo_id}/lotes/todos", response_model=list[LoteInsumoOut])
def listar_lotes_todos(insumo_id: int, db: Session = Depends(get_db)):
    lotes = db.query(LoteInsumo).filter(
        LoteInsumo.insumo_id == insumo_id,
    ).order_by(LoteInsumo.fecha_ingreso.desc()).limit(20).all()
    return [LoteInsumoOut.model_validate(l) for l in lotes]


@router.post("/{insumo_id}/lotes", response_model=LoteInsumoOut, status_code=201)
def crear_lote(insumo_id: int, data: LoteInsumoCreate, db: Session = Depends(get_db)):
    insumo = db.query(Insumo).filter(Insumo.id == insumo_id).first()
    if not insumo:
        raise HTTPException(404, "Insumo no encontrado")

    lote_data = data.model_dump()
    lote_data["insumo_id"] = insumo_id

    # Auto-calcular desde presentación en bulto
    if data.unidades_por_bulto and data.unidades_por_bulto > 1 and data.cantidad_bultos:
        lote_data["cantidad_inicial"] = data.cantidad_bultos * data.unidades_por_bulto
        if data.precio_por_bulto:
            lote_data["costo_unitario"] = data.precio_por_bulto / data.unidades_por_bulto

    if not lote_data.get("numero_lote"):
        lote_data["numero_lote"] = _auto_numero_lote(db, insumo_id)

    lote_data["cantidad_actual"] = lote_data["cantidad_inicial"]
    lote = LoteInsumo(**lote_data)
    db.add(lote)
    db.commit()
    db.refresh(lote)
    return LoteInsumoOut.model_validate(lote)


@router.put("/api/lotes/{lote_id}", response_model=LoteInsumoOut)
def actualizar_lote(lote_id: int, data: LoteInsumoUpdate, db: Session = Depends(get_db)):
    lote = db.query(LoteInsumo).filter(LoteInsumo.id == lote_id).first()
    if not lote:
        raise HTTPException(404, "Lote no encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(lote, k, v)
    db.commit()
    db.refresh(lote)
    return LoteInsumoOut.model_validate(lote)


# ─── Resumen de Insumos ──────────────────────────────────────────────────────

@router.get("/api/resumen")
def resumen_insumos(db: Session = Depends(get_db)):
    from datetime import timedelta
    from sqlalchemy import func
    from app.models.produccion import ProduccionInsumo

    # Valor total del stock: suma cantidad_actual × costo_unitario de lotes activos
    valor_total = db.query(
        func.sum(LoteInsumo.cantidad_actual * LoteInsumo.costo_unitario)
    ).filter(LoteInsumo.activo == True).scalar() or 0.0

    # Top consumidos últimos 30 días
    hace_30 = datetime.utcnow() - timedelta(days=30)
    top_rows = (
        db.query(
            LoteInsumo.insumo_id,
            func.sum(ProduccionInsumo.cantidad_usada).label("total")
        )
        .join(ProduccionInsumo, ProduccionInsumo.lote_insumo_id == LoteInsumo.id)
        .filter(ProduccionInsumo.cantidad_usada > 0)
        .group_by(LoteInsumo.insumo_id)
        .order_by(func.sum(ProduccionInsumo.cantidad_usada).desc())
        .limit(5)
        .all()
    )
    top_consumidos = []
    for row in top_rows:
        ins = db.query(Insumo).filter(Insumo.id == row.insumo_id).first()
        if ins:
            top_consumidos.append({
                "nombre": ins.nombre,
                "unidad": ins.unidad_medida,
                "total": round(row.total, 3),
                "stock_actual": ins.stock_actual,
            })

    # Alertas bajo mínimo
    todos = db.query(Insumo).filter(Insumo.activo == True).all()
    alertas = [
        {"nombre": i.nombre, "stock_actual": i.stock_actual,
         "stock_minimo": i.stock_minimo, "unidad": i.unidad_medida}
        for i in todos if i.bajo_stock
    ]

    return {
        "valor_total_stock": round(valor_total, 2),
        "top_consumidos": top_consumidos,
        "alertas": alertas,
        "total_insumos": len(todos),
        "insumos_ok": sum(1 for i in todos if not i.bajo_stock),
    }


# ─── Ingreso Masivo ──────────────────────────────────────────────────────────

@router.post("/api/ingreso-masivo", response_model=IngresoMasivoResult, status_code=201)
def ingreso_masivo(data: IngresoMasivoCreate, db: Session = Depends(get_db)):
    """Carga múltiples insumos en una sola operación distribuyendo el costo de flete."""
    if not data.items:
        raise HTTPException(400, "Debe incluir al menos un ítem")

    # Calcular totales base por ítem
    items_calc = []
    for item in data.items:
        insumo = db.query(Insumo).filter(Insumo.id == item.insumo_id).first()
        if not insumo:
            raise HTTPException(404, f"Insumo ID {item.insumo_id} no encontrado")

        upb = item.unidades_por_bulto or 1.0
        cb  = item.cantidad_bultos or 1.0
        cantidad_total = cb * upb
        costo_base = item.precio_por_bulto / upb if upb > 0 else item.precio_por_bulto
        total_item = cb * item.precio_por_bulto

        items_calc.append({
            "item": item,
            "insumo": insumo,
            "cantidad_total": cantidad_total,
            "costo_base": costo_base,
            "total_item": total_item,
        })

    total_sin_extra = sum(ic["total_item"] for ic in items_calc)

    # Crear orden de compra
    orden = OrdenCompra(
        fecha=data.fecha or datetime.utcnow(),
        proveedor=data.proveedor_global,
        notas=data.notas,
        costo_extra=data.costo_extra,
        tipo_costo_extra=data.tipo_costo_extra,
        total_sin_extra=total_sin_extra,
        total_con_extra=total_sin_extra + data.costo_extra,
    )
    db.add(orden)
    db.flush()

    lotes_creados = []
    for ic in items_calc:
        item = ic["item"]
        insumo = ic["insumo"]

        # Distribuir costo extra proporcionalmente
        proporcion = ic["total_item"] / total_sin_extra if total_sin_extra > 0 else 0
        extra_total_item = data.costo_extra * proporcion
        costo_extra_unitario = extra_total_item / ic["cantidad_total"] if ic["cantidad_total"] > 0 else 0
        costo_final = ic["costo_base"] + costo_extra_unitario

        numero = item.numero_lote or _auto_numero_lote(db, insumo.id)
        proveedor = item.proveedor or data.proveedor_global

        lote = LoteInsumo(
            insumo_id=insumo.id,
            orden_compra_id=orden.id,
            numero_lote=numero,
            cantidad_inicial=ic["cantidad_total"],
            cantidad_actual=ic["cantidad_total"],
            costo_unitario=costo_final,
            tipo_presentacion=item.tipo_presentacion,
            cantidad_bultos=item.cantidad_bultos,
            unidades_por_bulto=item.unidades_por_bulto,
            precio_por_bulto=item.precio_por_bulto,
            costo_extra_unitario=costo_extra_unitario,
            proveedor=proveedor,
            fecha_vencimiento=item.fecha_vencimiento,
            notas=item.notas,
        )
        db.add(lote)
        db.flush()
        lotes_creados.append(lote)

    db.commit()
    for l in lotes_creados:
        db.refresh(l)

    return IngresoMasivoResult(
        orden_compra_id=orden.id,
        lotes_creados=len(lotes_creados),
        total_sin_extra=round(total_sin_extra, 2),
        total_con_extra=round(total_sin_extra + data.costo_extra, 2),
        costo_extra=data.costo_extra,
        items=[LoteInsumoOut.model_validate(l) for l in lotes_creados],
    )
