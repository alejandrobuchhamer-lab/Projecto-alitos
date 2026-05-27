"""
Analytics de precios y contexto de negocio para el asistente IA.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.insumo import Insumo, LoteInsumo
from app.models.producto import ProductoTerminado, LoteProductoTerminado
from app.models.venta import Venta, VentaDetalle, EstadoVenta
from app.models.produccion import Produccion
from app.models.receta import RecetaVersion, RecetaIngrediente


# ── Analytics de precios de insumos ────────────────────────────────────────

def get_precio_historia_insumo(db: Session, insumo_id: int) -> list[dict]:
    """Retorna el historial de precios de compra de un insumo."""
    lotes = (
        db.query(LoteInsumo)
        .filter(LoteInsumo.insumo_id == insumo_id)
        .order_by(LoteInsumo.fecha_ingreso.asc())
        .all()
    )
    return [
        {
            "id": l.id,
            "fecha": l.fecha_ingreso,
            "numero_lote": l.numero_lote,
            "proveedor": l.proveedor,
            "cantidad": l.cantidad_inicial,
            "costo_unitario": l.costo_unitario,
            "costo_total": l.cantidad_inicial * l.costo_unitario,
        }
        for l in lotes
    ]


def get_analisis_precios_insumos(db: Session) -> list[dict]:
    """
    Por cada insumo, compara el último precio de compra vs el anterior.
    Calcula variación y genera recomendación de ajuste de precio de venta.
    """
    insumos = db.query(Insumo).filter(Insumo.activo == True).order_by(Insumo.nombre).all()
    resultado = []

    for insumo in insumos:
        lotes = (
            db.query(LoteInsumo)
            .filter(LoteInsumo.insumo_id == insumo.id)
            .order_by(LoteInsumo.fecha_ingreso.desc())
            .limit(10)
            .all()
        )
        if not lotes:
            continue

        ultimo = lotes[0]
        penultimo = lotes[1] if len(lotes) > 1 else None
        historico = list(reversed(lotes))

        variacion_pct = 0.0
        tendencia = "sin_datos"
        if penultimo and penultimo.costo_unitario > 0:
            variacion_pct = ((ultimo.costo_unitario - penultimo.costo_unitario) / penultimo.costo_unitario) * 100
            if variacion_pct > 2:
                tendencia = "sube"
            elif variacion_pct < -2:
                tendencia = "baja"
            else:
                tendencia = "estable"

        # Productos que usan este insumo (via receta)
        productos_afectados = (
            db.query(ProductoTerminado.nombre, ProductoTerminado.precio_venta_base)
            .join(RecetaVersion, RecetaVersion.producto_id == ProductoTerminado.id)
            .join(RecetaIngrediente, RecetaIngrediente.receta_version_id == RecetaVersion.id)
            .filter(
                RecetaIngrediente.insumo_id == insumo.id,
                RecetaVersion.activo == True,
                ProductoTerminado.activo == True,
            )
            .all()
        )

        recomendacion = _generar_recomendacion_precio(
            insumo.nombre, variacion_pct, tendencia, [p.nombre for p in productos_afectados]
        )

        resultado.append({
            "insumo_id": insumo.id,
            "insumo_nombre": insumo.nombre,
            "unidad_medida": insumo.unidad_medida,
            "precio_actual": ultimo.costo_unitario,
            "precio_anterior": penultimo.costo_unitario if penultimo else None,
            "variacion_pct": round(variacion_pct, 1),
            "tendencia": tendencia,
            "ultima_compra": ultimo.fecha_ingreso,
            "ultimo_proveedor": ultimo.proveedor,
            "compras_count": len(lotes),
            "historico": [{"fecha": l.fecha_ingreso, "precio": l.costo_unitario} for l in historico],
            "productos_afectados": [p.nombre for p in productos_afectados],
            "recomendacion": recomendacion,
        })

    return resultado


def _generar_recomendacion_precio(nombre: str, variacion_pct: float, tendencia: str, productos: list[str]) -> str:
    if tendencia == "sin_datos":
        return "Sin historial suficiente para comparar."
    if tendencia == "estable":
        return f"{nombre} con precio estable. No se requieren ajustes."
    if tendencia == "baja":
        return f"{nombre} bajó {abs(variacion_pct):.1f}%. Oportunidad de mejorar margen o ser competitivo."
    # Sube
    ps = ", ".join(productos[:3]) if productos else "productos asociados"
    if variacion_pct > 15:
        return f"⚠️ {nombre} subió {variacion_pct:.1f}%. Impacto significativo en {ps}. Revisar precio de venta urgente."
    if variacion_pct > 5:
        return f"{nombre} subió {variacion_pct:.1f}%. Considerar subir precio de {ps} para mantener margen."
    return f"{nombre} subió {variacion_pct:.1f}%. Variación moderada. Monitorear tendencia."


# ── Contexto de negocio para el asistente IA ───────────────────────────────

def get_contexto_negocio(db: Session) -> dict:
    """
    Recopila métricas clave del negocio para inyectar como contexto al asistente IA.
    """
    hoy = datetime.utcnow()
    hace_30 = hoy - timedelta(days=30)

    # Ventas del mes
    ventas_mes = (
        db.query(func.count(Venta.id), func.sum(Venta.total_neto), func.sum(Venta.margen_bruto))
        .filter(Venta.fecha_venta >= hace_30, Venta.estado.in_(["confirmada", "cobrada"]))
        .first()
    )
    cant_ventas, total_ventas, margen_ventas = ventas_mes or (0, 0, 0)

    # Top 3 productos más vendidos
    top_productos = (
        db.query(ProductoTerminado.nombre, func.sum(VentaDetalle.cantidad).label("qty"))
        .join(LoteProductoTerminado, VentaDetalle.lote_producto_id == LoteProductoTerminado.id)
        .join(ProductoTerminado, LoteProductoTerminado.producto_id == ProductoTerminado.id)
        .join(Venta, VentaDetalle.venta_id == Venta.id)
        .filter(Venta.fecha_venta >= hace_30)
        .group_by(ProductoTerminado.id, ProductoTerminado.nombre)
        .order_by(func.sum(VentaDetalle.cantidad).desc())
        .limit(3)
        .all()
    )

    # Insumos bajo stock
    insumos_criticos = [
        {"nombre": i.nombre, "stock": i.stock_actual, "minimo": i.stock_minimo}
        for i in db.query(Insumo).filter(Insumo.activo == True).all()
        if i.stock_actual < i.stock_minimo
    ]

    # Análisis de precios (últimas variaciones)
    analisis = get_analisis_precios_insumos(db)
    precios_subiendo = [a for a in analisis if a["tendencia"] == "sube" and a["variacion_pct"] > 5]

    # Producción del mes
    producciones_mes = db.query(func.count(Produccion.id)).filter(Produccion.fecha_inicio >= hace_30).scalar() or 0

    return {
        "ventas_mes": {
            "cantidad": int(cant_ventas or 0),
            "total_ars": float(total_ventas or 0),
            "margen_ars": float(margen_ventas or 0),
            "margen_pct": round(((margen_ventas or 0) / (total_ventas or 1)) * 100, 1),
        },
        "top_productos": [{"nombre": p.nombre, "unidades": float(p.qty)} for p in top_productos],
        "insumos_criticos": insumos_criticos,
        "precios_subiendo": [
            {"insumo": a["insumo_nombre"], "variacion_pct": a["variacion_pct"]}
            for a in precios_subiendo
        ],
        "producciones_mes": int(producciones_mes),
        "fecha_contexto": hoy.strftime("%d/%m/%Y %H:%M"),
    }


def get_lista_compras(db: Session, dias_proyeccion: int = 30) -> dict:
    """
    Genera una lista de compras inteligente:
    - Insumos bajo stock mínimo (urgente)
    - Proyección de consumo basada en últimas producciones
    - Último precio y proveedor conocido
    - Comparación de precios entre proveedores
    """
    from app.models.produccion import ProduccionInsumo
    from datetime import timedelta

    hoy = datetime.utcnow()
    hace_60 = hoy - timedelta(days=60)

    insumos = db.query(Insumo).filter(Insumo.activo == True).order_by(Insumo.nombre).all()
    urgentes = []
    recomendados = []

    for insumo in insumos:
        stock = insumo.stock_actual

        # Consumo promedio diario (últimos 60 días)
        consumo_total = (
            db.query(func.sum(ProduccionInsumo.cantidad_usada))
            .join(LoteInsumo, ProduccionInsumo.lote_insumo_id == LoteInsumo.id)
            .filter(LoteInsumo.insumo_id == insumo.id)
            .filter(ProduccionInsumo.produccion_id.in_(
                db.query(Produccion.id).filter(Produccion.fecha_inicio >= hace_60)
            ))
            .scalar() or 0
        )
        consumo_diario = consumo_total / 60 if consumo_total > 0 else 0
        dias_restantes = (stock / consumo_diario) if consumo_diario > 0 else 9999

        # Historial de precios y proveedores
        lotes_hist = (
            db.query(LoteInsumo)
            .filter(LoteInsumo.insumo_id == insumo.id)
            .order_by(LoteInsumo.fecha_ingreso.desc())
            .limit(5)
            .all()
        )
        ultimo_precio = lotes_hist[0].costo_unitario if lotes_hist else 0
        ultimo_proveedor = lotes_hist[0].proveedor if lotes_hist else insumo.proveedor_default

        # Comparación de precios por proveedor
        precios_por_proveedor = {}
        for l in lotes_hist:
            if l.proveedor and l.proveedor not in precios_por_proveedor:
                precios_por_proveedor[l.proveedor] = l.costo_unitario

        cantidad_sugerida = max(
            insumo.stock_minimo * 2 - stock,
            consumo_diario * dias_proyeccion,
            0
        )

        item = {
            "insumo_id": insumo.id,
            "nombre": insumo.nombre,
            "unidad": insumo.unidad_medida,
            "stock_actual": round(stock, 2),
            "stock_minimo": insumo.stock_minimo,
            "consumo_diario": round(consumo_diario, 3),
            "dias_restantes": int(dias_restantes) if dias_restantes < 9999 else None,
            "ultimo_precio": ultimo_precio,
            "ultimo_proveedor": ultimo_proveedor,
            "cantidad_sugerida": round(cantidad_sugerida, 2),
            "costo_estimado": round(cantidad_sugerida * ultimo_precio, 0),
            "precios_por_proveedor": precios_por_proveedor,
        }

        if stock < insumo.stock_minimo or (dias_restantes < 14 and consumo_diario > 0):
            urgentes.append({**item, "urgencia": "alta" if stock < insumo.stock_minimo else "media"})
        elif dias_restantes < dias_proyeccion and consumo_diario > 0:
            recomendados.append({**item, "urgencia": "baja"})

    total_estimado = sum(i["costo_estimado"] for i in urgentes + recomendados)
    return {
        "urgentes": urgentes,
        "recomendados": recomendados,
        "total_items": len(urgentes) + len(recomendados),
        "total_estimado": round(total_estimado, 0),
        "dias_proyeccion": dias_proyeccion,
        "fecha": hoy.strftime("%d/%m/%Y"),
    }


def contexto_a_texto(ctx: dict) -> str:
    """Convierte el contexto del negocio a texto para el system prompt."""
    v = ctx["ventas_mes"]
    lines = [
        "=== DATOS ACTUALES DEL NEGOCIO (últimos 30 días) ===",
        f"Ventas: {v['cantidad']} transacciones | ARS {v['total_ars']:,.0f} facturado | Margen: {v['margen_pct']}%",
    ]
    if ctx["top_productos"]:
        top = ", ".join(f"{p['nombre']} ({p['unidades']:.0f} u.)" for p in ctx["top_productos"])
        lines.append(f"Top productos: {top}")
    if ctx["insumos_criticos"]:
        cr = ", ".join(f"{i['nombre']} (stock {i['stock']:.1f} < mín {i['minimo']:.1f})" for i in ctx["insumos_criticos"])
        lines.append(f"⚠️ Insumos bajo stock: {cr}")
    if ctx["precios_subiendo"]:
        ps = ", ".join(f"{p['insumo']} +{p['variacion_pct']:.1f}%" for p in ctx["precios_subiendo"])
        lines.append(f"📈 Costos subiendo: {ps}")
    lines.append(f"Producciones realizadas: {ctx['producciones_mes']}")
    lines.append(f"Contexto al: {ctx['fecha_contexto']}")
    return "\n".join(lines)
