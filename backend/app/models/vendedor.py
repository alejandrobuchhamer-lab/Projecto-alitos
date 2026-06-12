from datetime import datetime
from sqlalchemy import String, Float, DateTime, Boolean, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class StockVendedor(Base):
    """Stock asignado por el admin a un vendedor."""
    __tablename__ = "stock_vendedores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    vendedor_id: Mapped[int] = mapped_column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    producto_id: Mapped[int] = mapped_column(Integer, ForeignKey("productos_terminados.id"), nullable=False)
    cantidad_asignada: Mapped[float] = mapped_column(Float, nullable=False)
    cantidad_disponible: Mapped[float] = mapped_column(Float, nullable=False)
    precio_unitario: Mapped[float | None] = mapped_column(Float)
    notas: Mapped[str | None] = mapped_column(Text)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    fecha_asignacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    asignado_por_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("usuarios.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class EntregaNegocio(Base):
    """Entrega de mercadería a un negocio por un vendedor."""
    __tablename__ = "entregas_negocio"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    vendedor_id: Mapped[int] = mapped_column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    negocio_id: Mapped[int] = mapped_column(Integer, ForeignKey("negocios.id"), nullable=False, index=True)
    stock_vendedor_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("stock_vendedores.id"))
    producto_id: Mapped[int] = mapped_column(Integer, ForeignKey("productos_terminados.id"), nullable=False)
    cantidad: Mapped[float] = mapped_column(Float, nullable=False)
    precio_unitario: Mapped[float | None] = mapped_column(Float)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    dias_consignacion: Mapped[int] = mapped_column(Integer, default=7)
    fecha_vencimiento_mercaderia: Mapped[datetime | None] = mapped_column(DateTime)
    # Estado de cobro
    cobrado: Mapped[bool] = mapped_column(Boolean, default=False)
    cantidad_cobrada: Mapped[float | None] = mapped_column(Float)
    monto_cobrado: Mapped[float | None] = mapped_column(Float)
    fecha_cobro: Mapped[datetime | None] = mapped_column(DateTime)
    # Estado de retiro/devolución
    retirado: Mapped[bool] = mapped_column(Boolean, default=False)
    cantidad_retirada: Mapped[float | None] = mapped_column(Float)
    notas: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class StockVendedorLote(Base):
    """Desglose por lote de producción del stock asignado a un vendedor (para cálculo de costo FEFO)."""
    __tablename__ = "stock_vendedor_lotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    stock_vendedor_id: Mapped[int] = mapped_column(Integer, ForeignKey("stock_vendedores.id"), nullable=False, index=True)
    lote_id: Mapped[int] = mapped_column(Integer, ForeignKey("lotes_producto_terminado.id"), nullable=False)
    cantidad_asignada: Mapped[float] = mapped_column(Float, nullable=False)
    cantidad_disponible: Mapped[float] = mapped_column(Float, nullable=False)
    costo_unitario: Mapped[float] = mapped_column(Float, default=0.0)
    fecha_asignacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class VentaVendedor(Base):
    """Venta directa de un vendedor (callejera, negocio o cliente)."""
    __tablename__ = "ventas_vendedor"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    vendedor_id: Mapped[int] = mapped_column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    stock_vendedor_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("stock_vendedores.id"))
    producto_id: Mapped[int] = mapped_column(Integer, ForeignKey("productos_terminados.id"), nullable=False)
    cantidad: Mapped[float] = mapped_column(Float, nullable=False)
    precio_unitario: Mapped[float] = mapped_column(Float, nullable=False)
    monto_total: Mapped[float] = mapped_column(Float, nullable=False)
    forma_pago: Mapped[str] = mapped_column(String(30), default="efectivo")
    lugar: Mapped[str | None] = mapped_column(String(200))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    notas: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # Cliente
    tipo_cliente: Mapped[str] = mapped_column(String(30), default="consumidor_final")
    cliente_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cliente_nombre: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Pagos multi-método
    pagos_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    estado_pago: Mapped[str] = mapped_column(String(20), default="completo")  # completo|parcial|pendiente
    monto_pendiente: Mapped[float] = mapped_column(Float, default=0.0)
    # Precio y descuento
    monto_original: Mapped[float] = mapped_column(Float, default=0.0)
    descuento_pct: Mapped[float] = mapped_column(Float, default=0.0)
    descuento_monto: Mapped[float] = mapped_column(Float, default=0.0)
    # Costo y rentabilidad (calculado con FEFO desde lotes)
    costo_unitario_calculado: Mapped[float] = mapped_column(Float, default=0.0)
    ganancia_bruta: Mapped[float] = mapped_column(Float, default=0.0)
    ganancia_neta: Mapped[float] = mapped_column(Float, default=0.0)
