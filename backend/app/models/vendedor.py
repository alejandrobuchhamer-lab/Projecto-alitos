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
