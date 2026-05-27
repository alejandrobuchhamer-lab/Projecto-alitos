from datetime import datetime
from sqlalchemy import String, Float, DateTime, Boolean, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Alerta(Base):
    __tablename__ = "alertas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    mensaje: Mapped[str] = mapped_column(Text, nullable=False)
    prioridad: Mapped[str] = mapped_column(String(20), default="media")
    modulo: Mapped[str] = mapped_column(String(50), nullable=False)
    entidad_id: Mapped[int | None] = mapped_column(Integer)
    resuelta: Mapped[bool] = mapped_column(Boolean, default=False)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    fecha_resolucion: Mapped[datetime | None] = mapped_column(DateTime)
    resuelta_por: Mapped[str | None] = mapped_column(String(100))
