from datetime import datetime
from sqlalchemy import String, Float, DateTime, Boolean, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class EstadoPedido(str, enum.Enum):
    pendiente = "pendiente"
    confirmado = "confirmado"
    en_preparacion = "en_preparacion"
    listo = "listo"
    entregado = "entregado"
    cancelado = "cancelado"


class EstadoVenta(str, enum.Enum):
    borrador = "borrador"
    confirmada = "confirmada"
    cobrada = "cobrada"
    cancelada = "cancelada"


class Pedido(Base):
    __tablename__ = "pedidos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    cliente_id: Mapped[int] = mapped_column(Integer, ForeignKey("clientes.id"), nullable=False)
    numero_pedido: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    fecha_pedido: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    fecha_entrega_requerida: Mapped[datetime | None] = mapped_column(DateTime)
    estado: Mapped[str] = mapped_column(String(30), default=EstadoPedido.pendiente)
    notas: Mapped[str | None] = mapped_column(Text)
    total_estimado: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    cliente: Mapped["Cliente"] = relationship("Cliente", back_populates="pedidos")
    detalles: Mapped[list["PedidoDetalle"]] = relationship(
        "PedidoDetalle", back_populates="pedido", cascade="all, delete-orphan"
    )
    ventas: Mapped[list["Venta"]] = relationship("Venta", back_populates="pedido")


class PedidoDetalle(Base):
    __tablename__ = "pedido_detalles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pedido_id: Mapped[int] = mapped_column(Integer, ForeignKey("pedidos.id"), nullable=False)
    producto_id: Mapped[int] = mapped_column(Integer, ForeignKey("productos_terminados.id"), nullable=False)
    cantidad: Mapped[float] = mapped_column(Float, nullable=False)
    precio_unitario: Mapped[float] = mapped_column(Float, nullable=False)

    pedido: Mapped["Pedido"] = relationship("Pedido", back_populates="detalles")
    producto: Mapped["ProductoTerminado"] = relationship("ProductoTerminado", back_populates="detalles_pedido")

    @property
    def subtotal(self) -> float:
        return self.cantidad * self.precio_unitario


class Venta(Base):
    __tablename__ = "ventas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pedido_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("pedidos.id"))
    cliente_id: Mapped[int] = mapped_column(Integer, ForeignKey("clientes.id"), nullable=False)
    numero_factura: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    fecha_venta: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    estado: Mapped[str] = mapped_column(String(30), default=EstadoVenta.borrador)
    forma_pago: Mapped[str] = mapped_column(String(30), default="efectivo")  # efectivo|transferencia|debito|credito|cuenta_corriente
    consumidor_final: Mapped[bool] = mapped_column(Boolean, default=False)
    notas: Mapped[str | None] = mapped_column(Text)
    total_bruto: Mapped[float] = mapped_column(Float, default=0.0)
    descuento: Mapped[float] = mapped_column(Float, default=0.0)
    total_neto: Mapped[float] = mapped_column(Float, default=0.0)
    costo_total: Mapped[float] = mapped_column(Float, default=0.0)
    margen_bruto: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    pedido: Mapped["Pedido | None"] = relationship("Pedido", back_populates="ventas")
    cliente: Mapped["Cliente"] = relationship("Cliente", back_populates="ventas")
    detalles: Mapped[list["VentaDetalle"]] = relationship(
        "VentaDetalle", back_populates="venta", cascade="all, delete-orphan"
    )

    @property
    def margen_porcentaje(self) -> float:
        if self.total_neto and self.total_neto > 0:
            return (self.margen_bruto / self.total_neto) * 100
        return 0.0


class VentaDetalle(Base):
    __tablename__ = "venta_detalles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    venta_id: Mapped[int] = mapped_column(Integer, ForeignKey("ventas.id"), nullable=False)
    lote_producto_id: Mapped[int] = mapped_column(Integer, ForeignKey("lotes_producto_terminado.id"), nullable=False)
    cantidad: Mapped[float] = mapped_column(Float, nullable=False)
    precio_unitario: Mapped[float] = mapped_column(Float, nullable=False)
    costo_unitario: Mapped[float] = mapped_column(Float, nullable=False)

    venta: Mapped["Venta"] = relationship("Venta", back_populates="detalles")
    lote_producto: Mapped["LoteProductoTerminado"] = relationship("LoteProductoTerminado", back_populates="detalles_venta")

    @property
    def subtotal(self) -> float:
        return self.cantidad * self.precio_unitario

    @property
    def costo_total(self) -> float:
        return self.cantidad * self.costo_unitario

    @property
    def margen(self) -> float:
        return self.subtotal - self.costo_total


class PedidoReserva(Base):
    """Reserva de stock de un lote para un pedido (inmovilización)."""
    __tablename__ = "pedido_reservas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pedido_id: Mapped[int] = mapped_column(Integer, ForeignKey("pedidos.id"), nullable=False)
    lote_id: Mapped[int] = mapped_column(Integer, ForeignKey("lotes_producto_terminado.id"), nullable=False)
    cantidad: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
