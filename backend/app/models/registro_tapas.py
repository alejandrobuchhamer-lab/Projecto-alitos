from datetime import datetime
from sqlalchemy import String, Float, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class RegistroTapas(Base):
    __tablename__ = "registros_tapas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    produccion_id: Mapped[int] = mapped_column(Integer, ForeignKey("producciones.id"), nullable=False)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    tapas_ok: Mapped[int] = mapped_column(Integer, nullable=False)
    tapas_rotas: Mapped[int] = mapped_column(Integer, default=0)
    peso_tapa_cocida_g: Mapped[float | None] = mapped_column(Float)   # promedio peso tapa cocida esta sesión
    tiempo_coccion_min: Mapped[int | None] = mapped_column(Integer)    # minutos de cocción esta sesión
    masa_desperdiciada_g: Mapped[float | None] = mapped_column(Float)  # gramos desperdiciados esta sesión
    notas: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
