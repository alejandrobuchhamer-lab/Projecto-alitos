from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class ConfiguracionUsuario(Base):
    __tablename__ = "configuracion_usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    usuario_nombre: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    color_primario: Mapped[str] = mapped_column(String(20), default="#5D3A1A")
    color_secundario: Mapped[str] = mapped_column(String(20), default="#D4A017")
    color_fondo: Mapped[str] = mapped_column(String(20), default="#1A0F0A")
    sidebar_colapsado: Mapped[bool] = mapped_column(Boolean, default=False)
    tema_oscuro: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
