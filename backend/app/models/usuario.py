from datetime import datetime
import hashlib
import secrets
from sqlalchemy import String, DateTime, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(300), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    rol: Mapped[str] = mapped_column(String(30), default="vendedor")  # admin | vendedor | produccion
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def set_password(self, password: str) -> None:
        salt = secrets.token_hex(16)
        hashed = hashlib.sha256((salt + password).encode()).hexdigest()
        self.password_hash = f"{salt}:{hashed}"

    def check_password(self, password: str) -> bool:
        try:
            salt, hashed = self.password_hash.split(":", 1)
            return hashlib.sha256((salt + password).encode()).hexdigest() == hashed
        except Exception:
            return False

    @property
    def rol_label(self) -> str:
        return {"admin": "Administrador", "vendedor": "Vendedor", "produccion": "Produccion"}.get(self.rol, self.rol)

    @property
    def es_admin(self) -> bool:
        return self.rol == "admin"
