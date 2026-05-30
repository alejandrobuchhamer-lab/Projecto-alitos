from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.venta import Venta, VentaDetalle, EstadoVenta
from app.models.produccion import Produccion, EstadoProduccion, ProduccionInsumo
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

    # Ventas de hoy
    hoy_inicio = hoy.replace(hour=0, minute=0, second=0, microsecond=0)
    hoy_fin = hoy.replace(hour=23, minute=59, second=59)
    ventas_hoy = db.query(func.sum(Venta.total_neto)).filter(
        Venta.fecha_venta >= hoy_inicio,
        Venta.fecha_venta <= hoy_fin,
        Venta.estado.in_([EstadoVenta.confirmada, EstadoVenta.cobrada]),
    ).scalar() or 0.0
    cant_ventas_hoy = db.query(func.count(Venta.id)).filter(
        Venta.fecha_venta >= hoy_inicio,
        Venta.fecha_venta <= hoy_fin,
        Venta.estado.in_([EstadoVenta.confirmada, EstadoVenta.cobrada]),
    ).scalar() or 0

    # Stock alfajores disponible
    lotes_alfajor = db.query(LoteProductoTerminado).filter(
        LoteProductoTerminado.tipo == "alfajor",
        LoteProductoTerminado.activo == True,
        LoteProductoTerminado.cantidad_actual > 0,
    ).all()
    stock_alfajores = sum(l.cantidad_actual for l in lotes_alfajor)
    valor_stock_alfajores = sum(l.cantidad_actual * (l.costo_unitario_calculado or 0) for l in lotes_alfajor)

    # Últimas 5 ventas
    ventas_recientes = db.query(Venta).filter(
        Venta.estado.in_([EstadoVenta.confirmada, EstadoVenta.cobrada])
    ).order_by(Venta.fecha_venta.desc()).limit(5).all()
    ventas_recientes_out = []
    for v in ventas_recientes:
        cliente_nombre = "Consumidor Final"
        if v.cliente_id:
            c = db.query(Cliente).filter(Cliente.id == v.cliente_id).first()
            if c:
                cliente_nombre = f"{c.nombre} {c.apellido or ''}".strip()
        ventas_recientes_out.append({
            "id": v.id,
            "cliente": cliente_nombre,
            "total": round(v.total_neto, 2),
            "forma_pago": v.forma_pago,
            "fecha": v.fecha_venta.strftime("%d/%m %H:%M"),
        })

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
        "ventas_hoy": round(ventas_hoy, 2),
        "cant_ventas_hoy": cant_ventas_hoy,
        "stock_alfajores": int(stock_alfajores),
        "valor_stock_alfajores": round(valor_stock_alfajores, 2),
        "ventas_recientes": ventas_recientes_out,
    }


# ══════════════════════════════════════════════════════════
#  TAB: VENTAS
# ══════════════════════════════════════════════════════════
def get_tab_ventas(db: Session) -> dict:
    hoy = datetime.utcnow()
    inicio_mes = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    inicio_mes_ant = (inicio_mes - timedelta(days=1)).replace(day=1)
    estados_ok = [EstadoVenta.confirmada, EstadoVenta.cobrada]

    # Ventas últimos 30 días (por día)
    ventas_30d = []
    for i in range(29, -1, -1):
        dia = hoy - timedelta(days=i)
        d0 = dia.replace(hour=0, minute=0, second=0, microsecond=0)
        d1 = dia.replace(hour=23, minute=59, second=59)
        total = db.query(func.sum(Venta.total_neto)).filter(
            Venta.fecha_venta >= d0, Venta.fecha_venta <= d1,
            Venta.estado.in_(estados_ok)
        ).scalar() or 0.0
        margen = db.query(func.sum(Venta.margen_bruto)).filter(
            Venta.fecha_venta >= d0, Venta.fecha_venta <= d1,
            Venta.estado.in_(estados_ok)
        ).scalar() or 0.0
        ventas_30d.append({
            "dia": dia.strftime("%d/%m"),
            "total": round(total, 0),
            "margen": round(margen, 0),
        })

    # Desglose por forma de pago del mes
    formas = db.query(
        Venta.forma_pago,
        func.sum(Venta.total_neto).label("total"),
        func.count(Venta.id).label("cant"),
    ).filter(
        Venta.fecha_venta >= inicio_mes,
        Venta.estado.in_(estados_ok),
    ).group_by(Venta.forma_pago).all()
    total_mes = sum(f.total for f in formas) or 1
    formas_out = [
        {"forma": f.forma_pago, "total": round(f.total, 2), "cant": f.cant,
         "pct": round(f.total / total_mes * 100, 1)}
        for f in sorted(formas, key=lambda x: x.total, reverse=True)
    ]

    # Top clientes del mes
    top_clientes = db.query(
        Venta.cliente_id,
        func.sum(Venta.total_neto).label("total"),
        func.count(Venta.id).label("cant"),
    ).filter(
        Venta.fecha_venta >= inicio_mes,
        Venta.estado.in_(estados_ok),
        Venta.cliente_id.isnot(None),
    ).group_by(Venta.cliente_id).order_by(func.sum(Venta.total_neto).desc()).limit(5).all()
    top_clientes_out = []
    for tc in top_clientes:
        c = db.query(Cliente).filter(Cliente.id == tc.cliente_id).first()
        if c:
            top_clientes_out.append({
                "nombre": f"{c.nombre} {c.apellido or ''}".strip(),
                "total": round(tc.total, 2),
                "cant": tc.cant,
            })

    # Mes anterior para comparar
    ventas_mes_ant = db.query(func.sum(Venta.total_neto)).filter(
        Venta.fecha_venta >= inicio_mes_ant,
        Venta.fecha_venta < inicio_mes,
        Venta.estado.in_(estados_ok),
    ).scalar() or 0.0
    ventas_mes_act = db.query(func.sum(Venta.total_neto)).filter(
        Venta.fecha_venta >= inicio_mes,
        Venta.estado.in_(estados_ok),
    ).scalar() or 0.0
    var_ventas = round((ventas_mes_act - ventas_mes_ant) / ventas_mes_ant * 100, 1) if ventas_mes_ant > 0 else 0.0

    return {
        "ventas_30d": ventas_30d,
        "formas_pago": formas_out,
        "top_clientes": top_clientes_out,
        "ventas_mes_actual": round(ventas_mes_act, 2),
        "ventas_mes_anterior": round(ventas_mes_ant, 2),
        "variacion_vs_mes_ant": var_ventas,
    }


# ══════════════════════════════════════════════════════════
#  TAB: PRODUCCIÓN
# ══════════════════════════════════════════════════════════
def get_tab_produccion(db: Session) -> dict:
    hoy = datetime.utcnow()
    inicio_mes = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Producciones activas (en proceso)
    activas = db.query(Produccion).filter(
        Produccion.estado == EstadoProduccion.en_proceso
    ).order_by(Produccion.fecha_inicio.desc()).all()
    activas_out = []
    for p in activas:
        receta = p.receta_version.producto.nombre if p.receta_version and p.receta_version.producto else "—"
        activas_out.append({
            "id": p.id,
            "tipo": p.tipo_produccion,
            "receta": receta,
            "fecha": p.fecha_inicio.strftime("%d/%m") if p.fecha_inicio else "—",
            "etapa": getattr(p, "etapa_armado", None) or p.tipo_produccion,
        })

    # Producciones del mes finalizadas
    prod_mes = db.query(func.count(Produccion.id)).filter(
        Produccion.fecha_inicio >= inicio_mes,
        Produccion.estado == EstadoProduccion.finalizada,
    ).scalar() or 0

    # Alfajores producidos el mes
    alf_mes = db.query(func.sum(Produccion.cantidad_producida)).filter(
        Produccion.fecha_inicio >= inicio_mes,
        Produccion.estado == EstadoProduccion.finalizada,
        Produccion.tipo_produccion == "armado",
    ).scalar() or 0

    # Stock de tapas disponible
    tapas_stock = db.query(
        func.sum(LoteProductoTerminado.cantidad_actual)
    ).filter(
        LoteProductoTerminado.tipo == "tapas",
        LoteProductoTerminado.activo == True,
        LoteProductoTerminado.cantidad_actual > 0,
    ).scalar() or 0

    # Masa en stock (producciones tipo masa en_proceso con peso registrado)
    masa_en_proceso = db.query(Produccion).filter(
        Produccion.tipo_produccion == "masa",
        Produccion.estado == EstadoProduccion.en_proceso,
        Produccion.peso_masa_total_g.isnot(None),
    ).all()
    masa_stock = sum((p.peso_masa_total_g or 0) / 1000 for p in masa_en_proceso)

    # Rendimiento histórico tapas (% real vs teórico)
    tapas_prods = db.query(Produccion).filter(
        Produccion.tipo_produccion == "tapas",
        Produccion.estado == EstadoProduccion.finalizada,
        Produccion.cantidad_producida.isnot(None),
    ).order_by(Produccion.fecha_inicio.desc()).limit(10).all()
    rend_hist = []
    for p in tapas_prods:
        receta = p.receta_version.producto.nombre if p.receta_version and p.receta_version.producto else "—"
        rend_hist.append({
            "fecha": p.fecha_inicio.strftime("%d/%m") if p.fecha_inicio else "—",
            "receta": receta,
            "producidas": int(p.cantidad_producida or 0),
            "costo_unit": round(p.costo_total_insumos / p.cantidad_producida, 2)
                          if p.cantidad_producida and p.costo_total_insumos else 0,
        })

    return {
        "activas": activas_out,
        "prod_mes": prod_mes,
        "alfajores_mes": int(alf_mes),
        "tapas_stock": int(tapas_stock),
        "masa_stock_kg": round(float(masa_stock), 2),
        "rendimiento_historico": rend_hist,
    }


# ══════════════════════════════════════════════════════════
#  TAB: INSUMOS
# ══════════════════════════════════════════════════════════
def get_tab_insumos(db: Session) -> dict:
    hoy = datetime.utcnow()

    # Top insumos por valor en stock
    insumos = db.query(Insumo).filter(Insumo.activo == True).all()
    top_valor = []
    for ins in insumos:
        lotes = db.query(LoteInsumo).filter(
            LoteInsumo.insumo_id == ins.id,
            LoteInsumo.activo == True,
            LoteInsumo.cantidad_actual > 0,
        ).all()
        valor = sum(l.cantidad_actual * l.costo_unitario for l in lotes)
        stock = sum(l.cantidad_actual for l in lotes)
        if valor > 0:
            top_valor.append({
                "nombre": ins.nombre,
                "stock": round(stock, 2),
                "unidad": ins.unidad_medida,
                "valor": round(valor, 2),
            })
    top_valor.sort(key=lambda x: x["valor"], reverse=True)

    # Lotes próximos a vencer (15 días)
    proximos = db.query(LoteInsumo).filter(
        LoteInsumo.activo == True,
        LoteInsumo.fecha_vencimiento.isnot(None),
        LoteInsumo.fecha_vencimiento <= hoy + timedelta(days=15),
        LoteInsumo.fecha_vencimiento > hoy,
        LoteInsumo.cantidad_actual > 0,
    ).order_by(LoteInsumo.fecha_vencimiento.asc()).all()
    proximos_out = []
    for l in proximos:
        dias = (l.fecha_vencimiento - hoy).days
        proximos_out.append({
            "numero_lote": l.numero_lote,
            "insumo": l.insumo.nombre if l.insumo else "—",
            "dias": dias,
            "cantidad": round(l.cantidad_actual, 2),
            "unidad": l.insumo.unidad_medida if l.insumo else "",
        })

    # Insumos bajo mínimo (detallado)
    bajo_minimo = [i for i in insumos if i.bajo_stock]
    bajo_out = [
        {"nombre": i.nombre, "stock": round(i.stock_actual, 2),
         "minimo": i.stock_minimo, "unidad": i.unidad_medida}
        for i in bajo_minimo
    ]

    # Últimas 5 compras (lotes ingresados)
    ultimas_compras = db.query(LoteInsumo).filter(
        LoteInsumo.activo == True
    ).order_by(LoteInsumo.fecha_ingreso.desc()).limit(5).all()
    compras_out = []
    for l in ultimas_compras:
        compras_out.append({
            "insumo": l.insumo.nombre if l.insumo else "—",
            "proveedor": l.proveedor or "—",
            "fecha": l.fecha_ingreso.strftime("%d/%m/%y") if l.fecha_ingreso else "—",
            "total": round(l.cantidad_inicial * l.costo_unitario, 2),
        })

    return {
        "top_valor": top_valor[:8],
        "proximos_vencer": proximos_out,
        "bajo_minimo": bajo_out,
        "ultimas_compras": compras_out,
        "total_insumos": len(insumos),
        "insumos_criticos": len(bajo_minimo),
    }


# ══════════════════════════════════════════════════════════
#  TAB: PROGRESO
# ══════════════════════════════════════════════════════════
def get_tab_progreso(db: Session) -> dict:
    hoy = datetime.utcnow()
    estados_ok = [EstadoVenta.confirmada, EstadoVenta.cobrada]

    # Últimos 6 meses de ventas y margen
    meses = []
    for i in range(5, -1, -1):
        ref = hoy.replace(day=1) - timedelta(days=i * 30)
        inicio = ref.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i == 0:
            fin = hoy
        else:
            siguiente = (inicio + timedelta(days=32)).replace(day=1)
            fin = siguiente - timedelta(seconds=1)

        ventas = db.query(func.sum(Venta.total_neto)).filter(
            Venta.fecha_venta >= inicio, Venta.fecha_venta <= fin,
            Venta.estado.in_(estados_ok),
        ).scalar() or 0.0
        margen = db.query(func.sum(Venta.margen_bruto)).filter(
            Venta.fecha_venta >= inicio, Venta.fecha_venta <= fin,
            Venta.estado.in_(estados_ok),
        ).scalar() or 0.0
        prods = db.query(func.sum(Produccion.cantidad_producida)).filter(
            Produccion.fecha_inicio >= inicio, Produccion.fecha_inicio <= fin,
            Produccion.estado == EstadoProduccion.finalizada,
            Produccion.tipo_produccion == "armado",
        ).scalar() or 0
        meses.append({
            "mes": inicio.strftime("%b %y"),
            "ventas": round(ventas, 0),
            "margen": round(margen, 0),
            "margen_pct": round(margen / ventas * 100, 1) if ventas > 0 else 0.0,
            "alfajores": int(prods),
        })

    # Costo promedio unitario por mes (últimas producciones armado)
    costo_trend = []
    prods_hist = db.query(Produccion).filter(
        Produccion.tipo_produccion == "armado",
        Produccion.estado == EstadoProduccion.finalizada,
        Produccion.cantidad_producida > 0,
    ).order_by(Produccion.fecha_inicio.desc()).limit(10).all()
    for p in reversed(prods_hist):
        cu = round(p.costo_total_insumos / p.cantidad_producida, 2) if p.cantidad_producida else 0
        costo_trend.append({
            "fecha": p.fecha_inicio.strftime("%d/%m") if p.fecha_inicio else "—",
            "costo_unit": cu,
            "cant": int(p.cantidad_producida),
        })

    return {
        "evolucion_6m": meses,
        "costo_unitario_trend": costo_trend,
    }
