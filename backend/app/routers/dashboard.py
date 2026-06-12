from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.services.dashboard_service import (
    get_kpis_dashboard,
    get_tab_ventas,
    get_tab_produccion,
    get_tab_insumos,
    get_tab_progreso,
)

router = APIRouter(tags=["dashboard"])
from app.templates import templates


@router.get("/", response_class=HTMLResponse)
def dashboard_html(request: Request, acceso: str = "", db: Session = Depends(get_db)):
    kpis = get_kpis_dashboard(db)
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "kpis": kpis,
        "acceso_denegado": acceso == "denegado",
    })


@router.get("/dashboard/")
def dashboard_redirect():
    return RedirectResponse("/", status_code=301)


@router.get("/api/dashboard/kpis")
def dashboard_kpis(db: Session = Depends(get_db)):
    return get_kpis_dashboard(db)


@router.get("/api/dashboard/tab/ventas")
def dashboard_tab_ventas(db: Session = Depends(get_db)):
    return get_tab_ventas(db)


@router.get("/api/dashboard/tab/produccion")
def dashboard_tab_produccion(db: Session = Depends(get_db)):
    return get_tab_produccion(db)


@router.get("/api/dashboard/tab/insumos")
def dashboard_tab_insumos(db: Session = Depends(get_db)):
    return get_tab_insumos(db)


@router.get("/api/dashboard/tab/progreso")
def dashboard_tab_progreso(db: Session = Depends(get_db)):
    return get_tab_progreso(db)


@router.get("/api/dashboard/analytics-mobile")
def analytics_mobile(dias: int = 14, db: Session = Depends(get_db)):
    """Analytics consolidado para la app móvil: KPIs, ventas por día, ranking productos y vendedores."""
    from app.models.vendedor import VentaVendedor, EntregaNegocio
    from app.models.usuario import Usuario
    from app.models.producto import ProductoTerminado

    hoy = datetime.utcnow()
    hoy_inicio = hoy.replace(hour=0, minute=0, second=0, microsecond=0)
    semana_inicio = hoy - timedelta(days=7)
    mes_inicio = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # ── KPIs globales ──────────────────────────────────────────────
    def suma_ventas(desde, hasta=None):
        q = db.query(func.coalesce(func.sum(VentaVendedor.monto_total), 0)).filter(
            VentaVendedor.fecha >= desde)
        if hasta:
            q = q.filter(VentaVendedor.fecha <= hasta)
        return float(q.scalar() or 0)

    def unidades_ventas(desde, hasta=None):
        q = db.query(func.coalesce(func.sum(VentaVendedor.cantidad), 0)).filter(
            VentaVendedor.fecha >= desde)
        if hasta:
            q = q.filter(VentaVendedor.fecha <= hasta)
        return int(q.scalar() or 0)

    monto_hoy     = suma_ventas(hoy_inicio)
    unidades_hoy  = unidades_ventas(hoy_inicio)
    monto_semana  = suma_ventas(semana_inicio)
    monto_mes     = suma_ventas(mes_inicio)
    total_ventas  = db.query(func.count(VentaVendedor.id)).scalar() or 0
    ticket_prom   = round(monto_mes / max(
        db.query(func.count(VentaVendedor.id)).filter(VentaVendedor.fecha >= mes_inicio).scalar() or 1, 1
    ), 2)

    cobros_pendientes = float(
        db.query(func.coalesce(
            func.sum(EntregaNegocio.cantidad * EntregaNegocio.precio_unitario), 0
        )).filter(
            EntregaNegocio.cobrado == False,
            EntregaNegocio.retirado == False,
        ).scalar() or 0
    )

    # ── Ventas por día (últimos N días) ───────────────────────────
    ventas_por_dia = []
    for i in range(dias - 1, -1, -1):
        dia = hoy - timedelta(days=i)
        d0 = dia.replace(hour=0, minute=0, second=0, microsecond=0)
        d1 = dia.replace(hour=23, minute=59, second=59)
        monto = float(db.query(func.coalesce(func.sum(VentaVendedor.monto_total), 0)).filter(
            VentaVendedor.fecha >= d0, VentaVendedor.fecha <= d1
        ).scalar() or 0)
        unids = int(db.query(func.coalesce(func.sum(VentaVendedor.cantidad), 0)).filter(
            VentaVendedor.fecha >= d0, VentaVendedor.fecha <= d1
        ).scalar() or 0)
        ventas_por_dia.append({
            "fecha": dia.strftime("%d/%m"),
            "dia":   dia.strftime("%a"),
            "monto": round(monto, 2),
            "unidades": unids,
        })

    # ── Top productos (mes actual) ────────────────────────────────
    top_rows = (
        db.query(
            VentaVendedor.producto_id,
            func.sum(VentaVendedor.cantidad).label("unidades"),
            func.sum(VentaVendedor.monto_total).label("ingresos"),
        )
        .filter(VentaVendedor.fecha >= mes_inicio)
        .group_by(VentaVendedor.producto_id)
        .order_by(func.sum(VentaVendedor.cantidad).desc())
        .limit(5)
        .all()
    )
    prods_map = {p.id: p for p in db.query(ProductoTerminado).all()}
    top_productos = [
        {
            "producto_id": r.producto_id,
            "nombre":      prods_map[r.producto_id].nombre if r.producto_id in prods_map else "?",
            "unidades":    int(r.unidades or 0),
            "ingresos":    round(float(r.ingresos or 0), 2),
        }
        for r in top_rows
    ]

    # ── Ranking vendedores (mes actual) ───────────────────────────
    vend_rows = (
        db.query(
            VentaVendedor.vendedor_id,
            func.sum(VentaVendedor.monto_total).label("monto"),
            func.sum(VentaVendedor.cantidad).label("unidades"),
            func.count(VentaVendedor.id).label("operaciones"),
        )
        .filter(VentaVendedor.fecha >= mes_inicio)
        .group_by(VentaVendedor.vendedor_id)
        .order_by(func.sum(VentaVendedor.monto_total).desc())
        .limit(10)
        .all()
    )
    vendedores_map = {u.id: u for u in db.query(Usuario).filter(Usuario.activo == True).all()}
    ranking_vendedores = [
        {
            "vendedor_id": r.vendedor_id,
            "nombre":      vendedores_map[r.vendedor_id].nombre if r.vendedor_id in vendedores_map else "?",
            "monto":       round(float(r.monto or 0), 2),
            "unidades":    int(r.unidades or 0),
            "operaciones": int(r.operaciones or 0),
        }
        for r in vend_rows
    ]

    # ── Formas de pago (mes) ──────────────────────────────────────
    pago_rows = (
        db.query(
            VentaVendedor.forma_pago,
            func.count(VentaVendedor.id).label("cantidad"),
            func.sum(VentaVendedor.monto_total).label("total"),
        )
        .filter(VentaVendedor.fecha >= mes_inicio)
        .group_by(VentaVendedor.forma_pago)
        .all()
    )
    formas_pago = [
        {"forma": r.forma_pago, "cantidad": int(r.cantidad or 0), "total": round(float(r.total or 0), 2)}
        for r in pago_rows
    ]

    return {
        "kpis": {
            "monto_hoy":          round(monto_hoy, 2),
            "unidades_hoy":       unidades_hoy,
            "monto_semana":       round(monto_semana, 2),
            "monto_mes":          round(monto_mes, 2),
            "ticket_promedio":    ticket_prom,
            "cobros_pendientes":  round(cobros_pendientes, 2),
            "total_operaciones":  total_ventas,
        },
        "ventas_por_dia":    ventas_por_dia,
        "top_productos":     top_productos,
        "ranking_vendedores": ranking_vendedores,
        "formas_pago":       formas_pago,
    }

