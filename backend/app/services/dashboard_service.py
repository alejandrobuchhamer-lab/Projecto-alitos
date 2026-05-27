from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.venta import Venta, VentaDetalle, EstadoVenta
from app.models.produccion import Produccion, EstadoProduccion
from app.models.insumo import Insumo, LoteInsumo
from app.models.producto import ProductoTerminado, LoteProductoTerminado
from app.models.cliente import Cliente
from app.models.alerta import Alerta


def get_kpis_dashboard(db: Session) -> dict:
    hoy = datetime.utcnow()
    inicio_mes = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    inicio_semana = hoy - timedelta(days=hoy.weekday())

    # Ventas del mes
    ventas_mes = db.query(func.sum(Venta.total_neto)).filter(
        Venta.fecha_venta >= inicio_mes,
        Venta.estado.in_([EstadoVenta.confirmada, EstadoVenta.cobrada]),
    ).scalar() or 0.0

    margen_mes = db.query(func.sum(Venta.margen_bruto)).filter(
        Venta.fecha_venta >= inicio_mes,
        Venta.estado.in_([EstadoVenta.confirmada, EstadoVenta.cobrada]),
    ).scalar() or 0.0

    costo_mes = db.query(func.sum(Venta.costo_total)).filter(
        Venta.fecha_venta >= inicio_mes,
        Venta.estado.in_([EstadoVenta.confirmada, EstadoVenta.cobrada]),
    ).scalar() or 0.0

    # Producciones del mes
    producciones_mes = db.query(func.count(Produccion.id)).filter(
        Produccion.fecha_inicio >= inicio_mes,
        Produccion.estado == EstadoProduccion.finalizada,
    ).scalar() or 0

    # Alertas activas
    alertas_activas = db.query(func.count(Alerta.id)).filter(Alerta.resuelta == False).scalar() or 0

    # Insumos bajo stock
    insumos_bajo_stock = [i for i in db.query(Insumo).filter(Insumo.activo == True).all() if i.bajo_stock]

    # Lotes próximos a vencer (7 días)
    lotes_proximos_vencer = db.query(LoteInsumo).filter(
        LoteInsumo.activo == True,
        LoteInsumo.fecha_vencimiento.isnot(None),
        LoteInsumo.fecha_vencimiento <= hoy + timedelta(days=7),
        LoteInsumo.fecha_vencimiento > hoy,
    ).count()

    lotes_pt_proximos = db.query(LoteProductoTerminado).filter(
        LoteProductoTerminado.activo == True,
        LoteProductoTerminado.fecha_vencimiento.isnot(None),
        LoteProductoTerminado.fecha_vencimiento <= hoy + timedelta(days=7),
        LoteProductoTerminado.fecha_vencimiento > hoy,
    ).count()

    # Ventas últimos 7 días para sparkline
    ventas_7dias = []
    for i in range(6, -1, -1):
        dia = hoy - timedelta(days=i)
        dia_inicio = dia.replace(hour=0, minute=0, second=0, microsecond=0)
        dia_fin = dia.replace(hour=23, minute=59, second=59)
        total = db.query(func.sum(Venta.total_neto)).filter(
            Venta.fecha_venta >= dia_inicio,
            Venta.fecha_venta <= dia_fin,
            Venta.estado.in_([EstadoVenta.confirmada, EstadoVenta.cobrada]),
        ).scalar() or 0.0
        ventas_7dias.append({"dia": dia.strftime("%a"), "total": round(total, 2)})

    # Top productos por ventas del mes
    top_productos = db.query(
        LoteProductoTerminado.producto_id,
        func.sum(VentaDetalle.cantidad).label("unidades_vendidas"),
        func.sum(VentaDetalle.cantidad * VentaDetalle.precio_unitario).label("ingresos"),
    ).join(VentaDetalle, VentaDetalle.lote_producto_id == LoteProductoTerminado.id).join(
        Venta, Venta.id == VentaDetalle.venta_id
    ).filter(
        Venta.fecha_venta >= inicio_mes,
        Venta.estado.in_([EstadoVenta.confirmada, EstadoVenta.cobrada]),
    ).group_by(LoteProductoTerminado.producto_id).order_by(func.sum(VentaDetalle.cantidad * VentaDetalle.precio_unitario).desc()).limit(5).all()

    top_productos_out = []
    for tp in top_productos:
        producto = db.query(ProductoTerminado).filter(ProductoTerminado.id == tp.producto_id).first()
        if producto:
            top_productos_out.append({
                "nombre": producto.nombre,
                "unidades": round(tp.unidades_vendidas, 1),
                "ingresos": round(tp.ingresos, 2),
            })

    margen_pct = (margen_mes / ventas_mes * 100) if ventas_mes > 0 else 0.0

    return {
        "ventas_mes": round(ventas_mes, 2),
        "margen_mes": round(margen_mes, 2),
        "margen_porcentaje": round(margen_pct, 1),
        "costo_mes": round(costo_mes, 2),
        "producciones_mes": producciones_mes,
        "alertas_activas": alertas_activas,
        "insumos_bajo_stock": len(insumos_bajo_stock),
        "lotes_proximos_vencer": lotes_proximos_vencer + lotes_pt_proximos,
        "total_clientes": db.query(func.count(Cliente.id)).filter(Cliente.activo == True).scalar() or 0,
        "total_insumos": db.query(func.count(Insumo.id)).filter(Insumo.activo == True).scalar() or 0,
        "total_productos": db.query(func.count(ProductoTerminado.id)).filter(ProductoTerminado.activo == True).scalar() or 0,
        "ventas_7dias": ventas_7dias,
        "top_productos": top_productos_out,
        "insumos_criticos": [{"nombre": i.nombre, "stock": i.stock_actual, "minimo": i.stock_minimo} for i in insumos_bajo_stock[:5]],
    }
