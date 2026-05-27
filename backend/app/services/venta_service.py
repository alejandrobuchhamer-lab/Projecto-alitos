from datetime import datetime
from sqlalchemy.orm import Session
from app.models.venta import Venta, VentaDetalle, Pedido, EstadoVenta
from app.models.producto import LoteProductoTerminado
from app.models.cliente import Cliente


def generar_numero_factura(db: Session) -> str:
    count = db.query(Venta).count() + 1
    fecha = datetime.utcnow().strftime("%Y%m%d")
    return f"FAC-{fecha}-{count:05d}"


def generar_numero_pedido(db: Session) -> str:
    count = db.query(Pedido).count() + 1
    fecha = datetime.utcnow().strftime("%Y%m%d")
    return f"PED-{fecha}-{count:04d}"


def crear_venta(
    db: Session,
    cliente_id: int,
    detalles: list[dict],
    pedido_id: int | None = None,
    descuento: float = 0.0,
    notas: str | None = None,
    forma_pago: str = "efectivo",
    consumidor_final: bool = False,
) -> Venta:
    if consumidor_final:
        cliente = db.query(Cliente).filter(Cliente.nombre == "Consumidor Final").first()
        if not cliente:
            cliente = Cliente(nombre="Consumidor Final", apellido="", tipo_cliente="minorista")
            db.add(cliente)
            db.flush()
        cliente_id = cliente.id
    else:
        cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
        if not cliente:
            raise ValueError(f"Cliente {cliente_id} no encontrado")

    venta = Venta(
        cliente_id=cliente_id,
        pedido_id=pedido_id,
        numero_factura=generar_numero_factura(db),
        descuento=descuento,
        notas=notas,
        forma_pago=forma_pago,
        consumidor_final=consumidor_final,
        estado=EstadoVenta.confirmada,
    )
    db.add(venta)
    db.flush()

    total_bruto = 0.0
    costo_total = 0.0

    for det in detalles:
        lote = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id == det["lote_producto_id"]).first()
        if not lote:
            raise ValueError(f"Lote {det['lote_producto_id']} no encontrado")
        if lote.cantidad_actual < det["cantidad"]:
            raise ValueError(
                f"Stock insuficiente en lote '{lote.numero_lote}': "
                f"disponible {lote.cantidad_actual}, solicitado {det['cantidad']}"
            )

        detalle = VentaDetalle(
            venta_id=venta.id,
            lote_producto_id=lote.id,
            cantidad=det["cantidad"],
            precio_unitario=det["precio_unitario"],
            costo_unitario=lote.costo_unitario_calculado,
        )
        db.add(detalle)

        lote.cantidad_actual -= det["cantidad"]
        if lote.cantidad_actual <= 0:
            lote.activo = False

        total_bruto += detalle.subtotal
        costo_total += detalle.costo_total

    venta.total_bruto = total_bruto
    venta.total_neto = total_bruto - descuento
    venta.costo_total = costo_total
    venta.margen_bruto = venta.total_neto - costo_total

    # Actualizar deuda cliente si no fue cobrada de contado
    # (extendible a crédito)
    db.flush()
    return venta


def cobrar_venta(db: Session, venta_id: int) -> Venta:
    venta = db.query(Venta).filter(Venta.id == venta_id).first()
    if not venta:
        raise ValueError(f"Venta {venta_id} no encontrada")
    venta.estado = EstadoVenta.cobrada
    db.flush()
    return venta
