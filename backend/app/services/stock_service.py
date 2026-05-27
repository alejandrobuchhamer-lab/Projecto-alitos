from datetime import datetime
from sqlalchemy.orm import Session
from app.models.insumo import Insumo, LoteInsumo
from app.models.producto import LoteProductoTerminado
from app.models.alerta import Alerta


def get_lotes_fefo(db: Session, insumo_id: int) -> list[LoteInsumo]:
    """Retorna lotes activos no vencidos ordenados por FEFO (primero vence, primero sale)."""
    lotes = (
        db.query(LoteInsumo)
        .filter(
            LoteInsumo.insumo_id == insumo_id,
            LoteInsumo.activo == True,
            LoteInsumo.cantidad_actual > 0,
        )
        .all()
    )
    # esta_vencido es @property — se evalúa en Python, no en SQL
    lotes = [l for l in lotes if not l.esta_vencido]
    con_vencimiento = sorted([l for l in lotes if l.fecha_vencimiento], key=lambda l: l.fecha_vencimiento)
    sin_vencimiento = [l for l in lotes if not l.fecha_vencimiento]
    return con_vencimiento + sin_vencimiento


def consumir_stock_fefo(db: Session, insumo_id: int, cantidad_requerida: float) -> list[dict]:
    """Consume stock usando FEFO. Retorna lista de {lote, cantidad_consumida, costo_unitario}."""
    lotes = get_lotes_fefo(db, insumo_id)
    stock_total = sum(l.cantidad_actual for l in lotes)

    if stock_total < cantidad_requerida:
        insumo = db.query(Insumo).filter(Insumo.id == insumo_id).first()
        nombre = insumo.nombre if insumo else f"ID {insumo_id}"
        raise ValueError(f"Stock insuficiente para '{nombre}': necesario {cantidad_requerida}, disponible {stock_total:.2f}")

    consumos = []
    pendiente = cantidad_requerida

    for lote in lotes:
        if pendiente <= 0:
            break
        consumir = min(lote.cantidad_actual, pendiente)
        consumos.append({
            "lote": lote,
            "cantidad_consumida": consumir,
            "costo_unitario": lote.costo_unitario,
        })
        lote.cantidad_actual -= consumir
        if lote.cantidad_actual <= 0:
            lote.activo = False
        pendiente -= consumir

    db.flush()
    return consumos


def consumir_stock_producto_fefo(db: Session, producto_id: int, cantidad_requerida: float) -> list[dict]:
    """Consume lotes de producto terminado con FEFO (para usar tapas en armado de alfajores)."""
    lotes = (
        db.query(LoteProductoTerminado)
        .filter(
            LoteProductoTerminado.producto_id == producto_id,
            LoteProductoTerminado.activo == True,
            LoteProductoTerminado.cantidad_actual > 0,
        )
        .all()
    )
    con_vencimiento = sorted([l for l in lotes if l.fecha_vencimiento], key=lambda l: l.fecha_vencimiento)
    sin_vencimiento = [l for l in lotes if not l.fecha_vencimiento]
    lotes_fefo = con_vencimiento + sin_vencimiento

    stock_total = sum(l.cantidad_actual for l in lotes_fefo)
    if stock_total < cantidad_requerida:
        from app.models.producto import ProductoTerminado
        producto = db.query(ProductoTerminado).filter(ProductoTerminado.id == producto_id).first()
        nombre = producto.nombre if producto else f"ID {producto_id}"
        raise ValueError(f"Stock insuficiente de '{nombre}': necesario {cantidad_requerida}, disponible {stock_total:.2f}")

    consumos = []
    pendiente = cantidad_requerida
    for lote in lotes_fefo:
        if pendiente <= 0:
            break
        consumir = min(lote.cantidad_actual, pendiente)
        consumos.append({
            "lote": lote,
            "cantidad_consumida": consumir,
            "costo_unitario": lote.costo_unitario_calculado,
        })
        lote.cantidad_actual -= consumir
        if lote.cantidad_actual <= 0:
            lote.activo = False
        pendiente -= consumir

    db.flush()
    return consumos


def verificar_alertas_stock(db: Session) -> list[Alerta]:
    """Genera alertas para insumos bajo stock mínimo y próximos a vencer."""
    alertas_creadas = []
    insumos = db.query(Insumo).filter(Insumo.activo == True).all()

    for insumo in insumos:
        if insumo.bajo_stock:
            alerta_existente = db.query(Alerta).filter(
                Alerta.modulo == "stock",
                Alerta.entidad_id == insumo.id,
                Alerta.tipo == "bajo_stock",
                Alerta.resuelta == False,
            ).first()
            if not alerta_existente:
                alerta = Alerta(
                    tipo="bajo_stock",
                    mensaje=f"'{insumo.nombre}' tiene stock bajo el mínimo ({insumo.stock_actual:.2f}/{insumo.stock_minimo} {insumo.unidad_medida})",
                    prioridad="alta",
                    modulo="stock",
                    entidad_id=insumo.id,
                )
                db.add(alerta)
                alertas_creadas.append(alerta)

        for lote in insumo.lotes:
            if lote.activo and lote.dias_para_vencer is not None and 0 < lote.dias_para_vencer <= 7:
                alerta = Alerta(
                    tipo="proximo_vencer",
                    mensaje=f"Lote '{lote.numero_lote}' de '{insumo.nombre}' vence en {lote.dias_para_vencer} días",
                    prioridad="media" if lote.dias_para_vencer > 3 else "alta",
                    modulo="stock",
                    entidad_id=lote.id,
                )
                db.add(alerta)
                alertas_creadas.append(alerta)

    db.flush()
    return alertas_creadas
