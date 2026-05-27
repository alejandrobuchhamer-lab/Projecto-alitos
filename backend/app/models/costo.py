from datetime import datetime
from sqlalchemy import String, Float, DateTime, Boolean, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class CostoFijo(Base):
    __tablename__ = "costos_fijos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    monto: Mapped[float] = mapped_column(Float, nullable=False)
    moneda: Mapped[str] = mapped_column(String(10), default="ARS")
    periodo: Mapped[str] = mapped_column(String(20), default="mensual")
    categoria: Mapped[str] = mapped_column(String(100), default="general")
    fecha_desde: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    fecha_hasta: Mapped[datetime | None] = mapped_column(DateTime)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TipoCambio(Base):
    __tablename__ = "tipos_cambio"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    moneda_origen: Mapped[str] = mapped_column(String(10), nullable=False)
    moneda_destino: Mapped[str] = mapped_column(String(10), nullable=False)
    tasa: Mapped[float] = mapped_column(Float, nullable=False)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    fuente: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
