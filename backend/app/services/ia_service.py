"""Motor IA desacoplado — preparado para agentes futuros."""
from sqlalchemy.orm import Session
from app.models.sensorial import PruebaSensorial
from app.models.venta import Venta, VentaDetalle, EstadoVenta
from app.models.producto import LoteProductoTerminado, ProductoTerminado
from app.models.produccion import Produccion, EstadoProduccion
from sqlalchemy import func
from datetime import datetime, timedelta


def generar_recomendacion_sensorial(prueba: PruebaSensorial) -> str:
    """Genera recomendación textual basada en atributos sensoriales."""
    problemas = []
    recomendaciones = []

    if prueba.dulzura is not None:
        if prueba.dulzura < 4:
            problemas.append("muy poco dulce")
            recomendaciones.append("aumentar azúcar/dulce de leche en 5-8%")
        elif prueba.dulzura > 8:
            problemas.append("exceso de dulzura")
            recomendaciones.append("reducir azúcar en 5-10%")

    if prueba.acidez is not None:
        if prueba.acidez > 7:
            problemas.append("demasiado ácido")
            recomendaciones.append("revisar frescura de ingredientes lácteos")

    if prueba.textura is not None:
        if prueba.textura < 4:
            problemas.append("textura deficiente")
            recomendaciones.append("ajustar tiempo de cocción o temperatura")
        elif prueba.textura > 8:
            recomendaciones.append("textura excelente — mantener parámetros actuales")

    if prueba.aroma is not None and prueba.aroma < 4:
        problemas.append("aroma débil")
        recomendaciones.append("verificar calidad del cacao/ingredientes aromáticos")

    if prueba.sabor_general is not None and prueba.sabor_general < 5:
        problemas.append("sabor general por debajo del estándar")
        recomendaciones.append("realizar prueba de reformulación con receta alternativa")

    if not problemas:
        return "Producto dentro de parámetros óptimos. Sin ajustes recomendados."

    texto = f"Problemas detectados: {', '.join(problemas)}. "
    texto += f"Recomendaciones: {'; '.join(recomendaciones)}."
    return texto


def proyectar_demanda(db: Session, producto_id: int, dias: int = 30) -> dict:
    """Proyección simple de demanda basada en tendencia histórica."""
    hoy = datetime.utcnow()
    hace_60 = hoy - timedelta(days=60)
    hace_30 = hoy - timedelta(days=30)

    def ventas_periodo(desde, hasta):
        return db.query(func.sum(VentaDetalle.cantidad)).join(
            LoteProductoTerminado, LoteProductoTerminado.id == VentaDetalle.lote_producto_id
        ).join(
            Venta, Venta.id == VentaDetalle.venta_id
        ).filter(
            LoteProductoTerminado.producto_id == producto_id,
            Venta.fecha_venta >= desde,
            Venta.fecha_venta < hasta,
            Venta.estado.in_([EstadoVenta.confirmada, EstadoVenta.cobrada]),
        ).scalar() or 0.0

    v_mes_anterior = ventas_periodo(hace_60, hace_30)
    v_mes_actual = ventas_periodo(hace_30, hoy)

    tendencia = 0.0
    if v_mes_anterior > 0:
        tendencia = (v_mes_actual - v_mes_anterior) / v_mes_anterior

    proyeccion = v_mes_actual * (1 + tendencia) * (dias / 30)

    producto = db.query(ProductoTerminado).filter(ProductoTerminado.id == producto_id).first()
    nombre = producto.nombre if producto else f"Producto {producto_id}"
    stock = producto.stock_actual if producto else 0

    return {
        "producto": nombre,
        "ventas_mes_anterior": round(v_mes_anterior, 1),
        "ventas_mes_actual": round(v_mes_actual, 1),
        "tendencia_porcentaje": round(tendencia * 100, 1),
        "proyeccion_proximos_dias": round(proyeccion, 1),
        "dias_proyectados": dias,
        "stock_actual": round(stock, 1),
        "recomendacion": (
            f"Producir al menos {max(0, round(proyeccion - stock, 0)):.0f} unidades adicionales"
            if proyeccion > stock
            else "Stock suficiente para cubrir la demanda proyectada"
        ),
    }


def recomendar_produccion(db: Session) -> list[dict]:
    """Recomienda qué productos producir basado en stock bajo y demanda."""
    recomendaciones = []
    productos = db.query(ProductoTerminado).filter(ProductoTerminado.activo == True).all()

    for producto in productos:
        if producto.stock_actual <= producto.stock_minimo:
            proyeccion = proyectar_demanda(db, producto.id, 14)
            if producto.receta_activa:
                recomendaciones.append({
                    "producto": producto.nombre,
                    "stock_actual": producto.stock_actual,
                    "stock_minimo": producto.stock_minimo,
                    "proyeccion_14_dias": proyeccion["proyeccion_proximos_dias"],
                    "prioridad": "alta" if producto.stock_actual == 0 else "media",
                    "receta": producto.receta_activa.nombre,
                })

    recomendaciones.sort(key=lambda x: (x["prioridad"] == "alta", x["stock_actual"]), reverse=True)
    return recomendaciones
