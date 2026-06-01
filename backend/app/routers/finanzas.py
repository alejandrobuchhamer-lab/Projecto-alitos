from datetime import datetime, date, time as dt_time
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.gasto import Gasto
from app.models.venta import Venta
from app.models.cliente import Cliente
from app.models.insumo import LoteInsumo
from app.models.producto import LoteProductoTerminado
from app.models.capital import InyeccionCapital
from app.templates import templates

router = APIRouter(prefix="/finanzas", tags=["finanzas"])


# ── HTML page ────────────────────────────────────────────────────────────────

@router.get("/", response_class=HTMLResponse)
def finanzas_index(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("finanzas/index.html", {"request": request})


# ── Caja hoy ────────────────────────────────────────────────────────────────

@router.get("/api/caja-hoy")
def caja_hoy(db: Session = Depends(get_db)):
    hoy = date.today()
    inicio = datetime.combine(hoy, dt_time.min)
    fin = datetime.combine(hoy, dt_time.max)

    ventas = (
        db.query(Venta)
        .filter(Venta.fecha_venta >= inicio, Venta.fecha_venta <= fin, Venta.estado != "cancelada")
        .order_by(Venta.fecha_venta.desc())
        .all()
    )
    gastos = (
        db.query(Gasto)
        .filter(Gasto.fecha >= inicio, Gasto.fecha <= fin)
        .order_by(Gasto.fecha.desc())
        .all()
    )

    efectivo = sum(v.total_neto for v in ventas if v.forma_pago == "efectivo")
    transferencia = sum(v.total_neto for v in ventas if v.forma_pago in ("transferencia", "mercado_pago"))
    cuenta_corriente = sum(v.total_neto for v in ventas if v.forma_pago == "cuenta_corriente")
    otros_cobros = sum(
        v.total_neto for v in ventas
        if v.forma_pago not in ("efectivo", "transferencia", "mercado_pago", "cuenta_corriente")
    )
    total_cobrado = efectivo + transferencia + otros_cobros
    total_gastos = sum(g.monto for g in gastos)
    saldo_neto = total_cobrado - total_gastos

    return {
        "resumen": {
            "efectivo": round(efectivo, 2),
            "transferencia": round(transferencia, 2),
            "cuenta_corriente": round(cuenta_corriente, 2),
            "otros_cobros": round(otros_cobros, 2),
            "total_cobrado": round(total_cobrado, 2),
            "total_gastos": round(total_gastos, 2),
            "saldo_neto": round(saldo_neto, 2),
        },
        "ventas": [
            {
                "id": v.id,
                "numero_factura": v.numero_factura,
                "cliente": v.cliente.nombre_completo,
                "total_neto": v.total_neto,
                "forma_pago": v.forma_pago,
                "estado": v.estado,
                "hora": v.fecha_venta.strftime("%H:%M"),
            }
            for v in ventas
        ],
        "gastos": [
            {
                "id": g.id,
                "concepto": g.concepto,
                "monto": g.monto,
                "categoria": g.categoria,
                "notas": g.notas,
                "hora": g.fecha.strftime("%H:%M"),
            }
            for g in gastos
        ],
    }


# ── Resumen período ──────────────────────────────────────────────────────────

@router.get("/api/resumen")
def resumen_periodo(desde: str, hasta: str, db: Session = Depends(get_db)):
    try:
        inicio = datetime.combine(date.fromisoformat(desde), dt_time.min)
        fin = datetime.combine(date.fromisoformat(hasta), dt_time.max)
    except ValueError:
        raise HTTPException(status_code=400, detail="Fechas inválidas")

    ventas = (
        db.query(Venta)
        .filter(Venta.fecha_venta >= inicio, Venta.fecha_venta <= fin, Venta.estado != "cancelada")
        .order_by(Venta.fecha_venta.desc())
        .all()
    )
    gastos = (
        db.query(Gasto)
        .filter(Gasto.fecha >= inicio, Gasto.fecha <= fin)
        .order_by(Gasto.fecha.desc())
        .all()
    )

    total_vendido = sum(v.total_neto for v in ventas)
    total_cobrado = sum(
        v.total_neto for v in ventas if v.forma_pago != "cuenta_corriente"
    )
    total_fiado = sum(v.total_neto for v in ventas if v.forma_pago == "cuenta_corriente")
    costo_insumos = sum(v.costo_total for v in ventas)
    gastos_extra = sum(g.monto for g in gastos)
    ganancia_bruta = total_cobrado - costo_insumos
    ganancia_neta = ganancia_bruta - gastos_extra
    margen_pct = round((ganancia_neta / total_cobrado * 100), 1) if total_cobrado > 0 else 0.0

    # Group by forma_pago
    por_fp: dict = {}
    for v in ventas:
        fp = v.forma_pago
        if fp not in por_fp:
            por_fp[fp] = {"monto": 0.0, "cantidad": 0}
        por_fp[fp]["monto"] += v.total_neto
        por_fp[fp]["cantidad"] += 1

    # Group gastos by categoria
    por_cat: dict = {}
    for g in gastos:
        cat = g.categoria
        if cat not in por_cat:
            por_cat[cat] = 0.0
        por_cat[cat] += g.monto

    return {
        "resumen": {
            "total_vendido": round(total_vendido, 2),
            "total_cobrado": round(total_cobrado, 2),
            "total_fiado": round(total_fiado, 2),
            "costo_insumos": round(costo_insumos, 2),
            "gastos_extra": round(gastos_extra, 2),
            "ganancia_bruta": round(ganancia_bruta, 2),
            "ganancia_neta": round(ganancia_neta, 2),
            "margen_pct": margen_pct,
            "cantidad_ventas": len(ventas),
        },
        "por_forma_pago": por_fp,
        "por_categoria_gasto": por_cat,
        "ventas": [
            {
                "id": v.id,
                "numero_factura": v.numero_factura,
                "cliente": v.cliente.nombre_completo,
                "total_neto": v.total_neto,
                "costo_total": v.costo_total,
                "margen_bruto": v.margen_bruto,
                "forma_pago": v.forma_pago,
                "estado": v.estado,
                "fecha": v.fecha_venta.strftime("%d/%m/%Y %H:%M"),
            }
            for v in ventas
        ],
        "gastos": [
            {
                "id": g.id,
                "concepto": g.concepto,
                "monto": g.monto,
                "categoria": g.categoria,
                "notas": g.notas,
                "fecha": g.fecha.strftime("%d/%m/%Y"),
            }
            for g in gastos
        ],
    }


# ── Cuenta corriente ─────────────────────────────────────────────────────────

@router.get("/api/cuenta-corriente")
def cuenta_corriente(db: Session = Depends(get_db)):
    clientes = (
        db.query(Cliente)
        .filter(Cliente.deuda_total > 0, Cliente.activo == True)
        .order_by(Cliente.deuda_total.desc())
        .all()
    )

    result = []
    for c in clientes:
        ventas_pendientes = [
            v for v in c.ventas
            if v.forma_pago == "cuenta_corriente" and v.estado != "cobrada" and v.estado != "cancelada"
        ]
        result.append({
            "id": c.id,
            "nombre": c.nombre_completo,
            "deuda_total": c.deuda_total,
            "limite_credito": c.limite_credito,
            "credito_disponible": c.credito_disponible,
            "ventas_pendientes": [
                {
                    "id": v.id,
                    "numero_factura": v.numero_factura,
                    "total_neto": v.total_neto,
                    "fecha": v.fecha_venta.strftime("%d/%m/%Y"),
                    "estado": v.estado,
                }
                for v in ventas_pendientes
            ],
        })

    total_pendiente = sum(c["deuda_total"] for c in result)
    return {"clientes": result, "total_pendiente": round(total_pendiente, 2)}


# ── CRUD Gastos ──────────────────────────────────────────────────────────────

class GastoCreate(BaseModel):
    concepto: str
    monto: float
    categoria: str = "otros"
    fecha: str | None = None  # ISO date string, defaults to today
    notas: str | None = None


@router.get("/api/gastos")
def listar_gastos(desde: str | None = None, hasta: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Gasto)
    if desde:
        q = q.filter(Gasto.fecha >= datetime.combine(date.fromisoformat(desde), dt_time.min))
    if hasta:
        q = q.filter(Gasto.fecha <= datetime.combine(date.fromisoformat(hasta), dt_time.max))
    gastos = q.order_by(Gasto.fecha.desc()).all()
    return [
        {
            "id": g.id,
            "concepto": g.concepto,
            "monto": g.monto,
            "categoria": g.categoria,
            "notas": g.notas,
            "fecha": g.fecha.strftime("%d/%m/%Y"),
        }
        for g in gastos
    ]


@router.post("/api/gastos", status_code=201)
def crear_gasto(data: GastoCreate, db: Session = Depends(get_db)):
    if data.monto <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser positivo")
    fecha = (
        datetime.combine(date.fromisoformat(data.fecha), dt_time.min)
        if data.fecha
        else datetime.utcnow()
    )
    g = Gasto(
        concepto=data.concepto,
        monto=data.monto,
        categoria=data.categoria,
        fecha=fecha,
        notas=data.notas,
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return {"id": g.id, "concepto": g.concepto, "monto": g.monto, "categoria": g.categoria}


@router.delete("/api/gastos/{gasto_id}")
def eliminar_gasto(gasto_id: int, db: Session = Depends(get_db)):
    g = db.query(Gasto).filter(Gasto.id == gasto_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    db.delete(g)
    db.commit()
    return {"ok": True}


# ── Flujo diario ─────────────────────────────────────────────────────────────

@router.get("/api/flujo-diario")
def flujo_diario(desde: str, hasta: str, db: Session = Depends(get_db)):
    try:
        d_desde = date.fromisoformat(desde)
        d_hasta = date.fromisoformat(hasta)
    except ValueError:
        raise HTTPException(status_code=400, detail="Fechas inválidas")

    inicio = datetime.combine(d_desde, dt_time.min)
    fin    = datetime.combine(d_hasta, dt_time.max)

    ventas = db.query(Venta).filter(
        Venta.fecha_venta >= inicio, Venta.fecha_venta <= fin, Venta.estado != "cancelada"
    ).all()
    gastos = db.query(Gasto).filter(Gasto.fecha >= inicio, Gasto.fecha <= fin).all()

    # Agrupa por día
    dias: dict = {}
    cur = d_desde
    while cur <= d_hasta:
        dias[cur.isoformat()] = {"ingresos": 0.0, "gastos": 0.0}
        cur = date.fromordinal(cur.toordinal() + 1)

    for v in ventas:
        k = v.fecha_venta.date().isoformat()
        if k in dias:
            if v.forma_pago != "cuenta_corriente":
                dias[k]["ingresos"] += v.total_neto

    for g in gastos:
        k = g.fecha.date().isoformat()
        if k in dias:
            dias[k]["gastos"] += g.monto

    # Construir resultado con acumulado
    resultado = []
    acumulado = 0.0
    for iso, data in sorted(dias.items()):
        balance = data["ingresos"] - data["gastos"]
        acumulado += balance
        resultado.append({
            "fecha": date.fromisoformat(iso).strftime("%d/%m"),
            "ingresos":  round(data["ingresos"], 2),
            "gastos":    round(data["gastos"], 2),
            "balance":   round(balance, 2),
            "acumulado": round(acumulado, 2),
        })

    return resultado


# ── Capital invertido en stock ────────────────────────────────────────────────

@router.get("/api/capital-invertido")
def capital_invertido(db: Session = Depends(get_db)):
    # Insumos activos
    lotes_insumo = db.query(LoteInsumo).filter(
        LoteInsumo.activo == True, LoteInsumo.cantidad_actual > 0
    ).all()
    capital_insumos = sum(l.cantidad_actual * l.costo_unitario for l in lotes_insumo)

    detalle_insumos = []
    por_insumo: dict = {}
    for l in lotes_insumo:
        nombre = l.insumo.nombre
        valor = l.cantidad_actual * l.costo_unitario
        if nombre not in por_insumo:
            por_insumo[nombre] = 0.0
        por_insumo[nombre] += valor
    detalle_insumos = [{"nombre": k, "valor": round(v, 2)} for k, v in sorted(por_insumo.items(), key=lambda x: -x[1])]

    # Lotes de producto terminado activos
    lotes_pt = db.query(LoteProductoTerminado).filter(
        LoteProductoTerminado.activo == True,
        LoteProductoTerminado.cantidad_actual > 0,
    ).all()

    capital_masa     = sum(l.cantidad_actual * l.costo_unitario_calculado for l in lotes_pt if l.tipo == "masa")
    capital_tapas    = sum(l.cantidad_actual * l.costo_unitario_calculado for l in lotes_pt if l.tipo == "tapas")
    capital_alfajor  = sum(l.cantidad_actual * l.costo_unitario_calculado for l in lotes_pt if l.tipo == "alfajor")

    detalle_masa    = [{"lote": l.numero_lote, "cantidad": l.cantidad_actual, "costo_u": l.costo_unitario_calculado, "valor": round(l.cantidad_actual * l.costo_unitario_calculado, 2)} for l in lotes_pt if l.tipo == "masa"]
    detalle_tapas   = [{"lote": l.numero_lote, "cantidad": l.cantidad_actual, "costo_u": l.costo_unitario_calculado, "valor": round(l.cantidad_actual * l.costo_unitario_calculado, 2)} for l in lotes_pt if l.tipo == "tapas"]
    detalle_alfajor = [{"lote": l.numero_lote, "cantidad": l.cantidad_actual, "costo_u": l.costo_unitario_calculado, "valor": round(l.cantidad_actual * l.costo_unitario_calculado, 2)} for l in lotes_pt if l.tipo == "alfajor"]

    total = capital_insumos + capital_masa + capital_tapas + capital_alfajor

    return {
        "capital_insumos":  round(capital_insumos, 2),
        "capital_masa":     round(capital_masa, 2),
        "capital_tapas":    round(capital_tapas, 2),
        "capital_alfajor":  round(capital_alfajor, 2),
        "total":            round(total, 2),
        "detalle_insumos":  detalle_insumos,
        "detalle_masa":     detalle_masa,
        "detalle_tapas":    detalle_tapas,
        "detalle_alfajor":  detalle_alfajor,
    }


# ── Capital propio ────────────────────────────────────────────────────────────

class CapitalCreate(BaseModel):
    monto: float
    origen: str = "sueldo"
    fecha: str | None = None
    notas: str | None = None


@router.get("/api/capital")
def listar_capital(db: Session = Depends(get_db)):
    items = db.query(InyeccionCapital).order_by(InyeccionCapital.fecha.desc()).all()
    total = sum(i.monto for i in items)
    return {
        "total_inyectado": round(total, 2),
        "items": [
            {
                "id": i.id,
                "fecha": i.fecha.strftime("%d/%m/%Y"),
                "monto": i.monto,
                "origen": i.origen,
                "notas": i.notas,
            }
            for i in items
        ],
    }


@router.post("/api/capital", status_code=201)
def agregar_capital(data: CapitalCreate, db: Session = Depends(get_db)):
    if data.monto <= 0:
        raise HTTPException(400, "El monto debe ser positivo")
    fecha = (
        datetime.combine(date.fromisoformat(data.fecha), dt_time.min)
        if data.fecha else datetime.utcnow()
    )
    item = InyeccionCapital(monto=data.monto, origen=data.origen, fecha=fecha, notas=data.notas)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "monto": item.monto, "origen": item.origen}


@router.delete("/api/capital/{item_id}")
def eliminar_capital(item_id: int, db: Session = Depends(get_db)):
    item = db.query(InyeccionCapital).filter(InyeccionCapital.id == item_id).first()
    if not item:
        raise HTTPException(404, "Registro no encontrado")
    db.delete(item)
    db.commit()
    return {"ok": True}


# ── Salud del negocio (mes actual) ───────────────────────────────────────────

@router.get("/api/salud")
def salud_negocio(db: Session = Depends(get_db)):
    hoy = date.today()
    inicio_mes = datetime.combine(hoy.replace(day=1), dt_time.min)
    fin_mes = datetime.combine(hoy, dt_time.max)

    ventas = db.query(Venta).filter(
        Venta.fecha_venta >= inicio_mes, Venta.fecha_venta <= fin_mes,
        Venta.estado != "cancelada"
    ).all()
    gastos = db.query(Gasto).filter(
        Gasto.fecha >= inicio_mes, Gasto.fecha <= fin_mes
    ).all()

    ingresos = sum(v.total_neto for v in ventas if v.forma_pago != "cuenta_corriente")
    costo_produccion = sum(v.costo_total for v in ventas)
    total_gastos = sum(g.monto for g in gastos)
    ganancia_bruta = ingresos - costo_produccion
    ganancia_neta = ganancia_bruta - total_gastos
    margen_pct = round(ganancia_neta / ingresos * 100, 1) if ingresos > 0 else 0.0

    # Stock valorizado
    lotes_insumo = db.query(LoteInsumo).filter(LoteInsumo.activo == True, LoteInsumo.cantidad_actual > 0).all()
    lotes_pt = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.activo == True, LoteProductoTerminado.cantidad_actual > 0).all()
    stock_insumos = sum(l.cantidad_actual * l.costo_unitario for l in lotes_insumo)
    stock_productos = sum(l.cantidad_actual * (l.costo_unitario_calculado or 0) for l in lotes_pt)
    stock_total = stock_insumos + stock_productos

    # Capital propio
    inyecciones = db.query(InyeccionCapital).all()
    total_inyectado = sum(i.monto for i in inyecciones)
    capital_recuperado = max(0, ingresos - costo_produccion - total_gastos)  # ganancia acumulada estimada
    roi_pct = round(ganancia_neta / total_inyectado * 100, 1) if total_inyectado > 0 else None

    return {
        "mes": hoy.strftime("%B %Y"),
        "ingresos": round(ingresos, 2),
        "costo_produccion": round(costo_produccion, 2),
        "gastos_fijos": round(total_gastos, 2),
        "ganancia_bruta": round(ganancia_bruta, 2),
        "ganancia_neta": round(ganancia_neta, 2),
        "margen_pct": margen_pct,
        "stock_total": round(stock_total, 2),
        "stock_insumos": round(stock_insumos, 2),
        "stock_productos": round(stock_productos, 2),
        "total_inyectado": round(total_inyectado, 2),
        "roi_pct": roi_pct,
        "cantidad_ventas": len(ventas),
    }
