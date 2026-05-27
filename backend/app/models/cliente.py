from datetime import datetime
from sqlalchemy import String, Float, DateTime, Boolean, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Cliente(Base):
    __tablename__ = "clientes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    apellido: Mapped[str | None] = mapped_column(String(200))
    empresa: Mapped[str | None] = mapped_column(String(300))
    email: Mapped[str | None] = mapped_column(String(200))
    telefono: Mapped[str | None] = mapped_column(String(50))
    direccion: Mapped[str | None] = mapped_column(Text)
    tipo_cliente: Mapped[str] = mapped_column(String(50), default="minorista")
    deuda_total: Mapped[float] = mapped_column(Float, default=0.0)
    limite_credito: Mapped[float] = mapped_column(Float, default=0.0)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    notas: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    pedidos: Mapped[list["Pedido"]] = relationship("Pedido", back_populates="cliente")
    ventas: Mapped[list["Venta"]] = relationship("Venta", back_populates="cliente")

    @property
    def nombre_completo(self) -> str:
        if self.apellido:
            return f"{self.nombre} {self.apellido}"
        return self.empresa or self.nombre

    @property
    def credito_disponible(self) -> float:
        return max(0.0, self.limite_credito - self.deuda_total)
