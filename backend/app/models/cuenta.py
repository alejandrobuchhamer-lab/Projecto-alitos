from datetime import datetime
from sqlalchemy import String, Float, DateTime, Boolean, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Cuenta(Base):
    """Cuenta financiera: efectivo, banco, MercadoPago, etc."""
    __tablename__ = "cuentas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo: Mapped[str] = mapped_column(String(30), default="efectivo")  # efectivo|banco|mercadopago|otro
    saldo_inicial: Mapped[float] = mapped_column(Float, default=0.0)
    color: Mapped[str] = mapped_column(String(20), default="#c47820")
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MovimientoCuenta(Base):
    """Movimiento de dinero en una cuenta."""
    __tablename__ = "movimientos_cuenta"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    cuenta_id: Mapped[int] = mapped_column(Integer, ForeignKey("cuentas.id"), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # entrada|salida|transferencia
    monto: Mapped[float] = mapped_column(Float, nullable=False)
    concepto: Mapped[str] = mapped_column(String(300), nullable=False)
    referencia: Mapped[str | None] = mapped_column(String(100))  # nro factura, nro venta, etc.
    cuenta_destino_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("cuentas.id"))
    creado_por_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("usuarios.id"))
    notas: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
