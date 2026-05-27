from datetime import datetime
from sqlalchemy import String, Float, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class AjusteStock(Base):
    __tablename__ = "ajustes_stock"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    tipo: Mapped[str] = mapped_column(String(20))  # "insumo" | "alfajor"
    insumo_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("insumos.id"), nullable=True)
    producto_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("productos_terminados.id"), nullable=True)
    nombre: Mapped[str] = mapped_column(String(200))  # denormalizado para historial
    stock_sistema: Mapped[float] = mapped_column(Float)
    stock_real: Mapped[float] = mapped_column(Float)
    diferencia: Mapped[float] = mapped_column(Float)  # real - sistema
    motivo: Mapped[str] = mapped_column(String(200), default="conteo físico")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
