from datetime import date, datetime
from sqlalchemy import Integer, Float, Date, DateTime, Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class AsignacionStock(Base):
    __tablename__ = "asignaciones_stock"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    vendedor_id: Mapped[int] = mapped_column(Integer, ForeignKey("usuarios.id"), nullable=False)
    producto_id: Mapped[int] = mapped_column(Integer, ForeignKey("productos_terminados.id"), nullable=False)
    cantidad: Mapped[float] = mapped_column(Float, nullable=False)
    cantidad_vendida: Mapped[float] = mapped_column(Float, default=0.0)
    fecha: Mapped[date] = mapped_column(Date, default=date.today)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    notas: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    @property
    def disponible(self) -> float:
        return max(0.0, self.cantidad - self.cantidad_vendida)
