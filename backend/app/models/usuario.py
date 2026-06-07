import json
from datetime import datetime
import hashlib
import secrets
from sqlalchemy import String, DateTime, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

# ── Módulos del sistema ────────────────────────────────────────────────────────
MODULOS = [
    ("produccion", "Producción"),
    ("insumos",    "Insumos & Stock"),
    ("recetas",    "Recetas"),
    ("stock",      "Conteo Stock"),
    ("ventas",     "Ventas"),
    ("pedidos",    "Pedidos"),
    ("clientes",   "Clientes"),
    ("finanzas",   "Finanzas"),
    ("alertas",    "Alertas"),
    ("sensorial",  "Lab Sensorial"),
    ("ia",         "Asistente IA"),
]

_TODOS = {k: {"ver": True, "editar": True} for k, _ in MODULOS}
_NINGUNO = {k: {"ver": False, "editar": False} for k, _ in MODULOS}

PERMISOS_POR_ROL = {
    "admin": _TODOS,
    "produccion": {
        "produccion": {"ver": True,  "editar": True},
        "insumos":    {"ver": True,  "editar": True},
        "recetas":    {"ver": True,  "editar": True},
        "stock":      {"ver": True,  "editar": True},
        "ventas":     {"ver": False, "editar": False},
        "pedidos":    {"ver": False, "editar": False},
        "clientes":   {"ver": False, "editar": False},
        "finanzas":   {"ver": False, "editar": False},
        "alertas":    {"ver": True,  "editar": False},
        "sensorial":  {"ver": True,  "editar": True},
        "ia":         {"ver": True,  "editar": False},
    },
    "vendedor": {
        "produccion": {"ver": False, "editar": False},
        "insumos":    {"ver": False, "editar": False},
        "recetas":    {"ver": False, "editar": False},
        "stock":      {"ver": False, "editar": False},
        "ventas":     {"ver": True,  "editar": True},
        "pedidos":    {"ver": True,  "editar": True},
        "clientes":   {"ver": True,  "editar": True},
        "finanzas":   {"ver": False, "editar": False},
        "alertas":    {"ver": False, "editar": False},
        "sensorial":  {"ver": False, "editar": False},
        "ia":         {"ver": False, "editar": False},
    },
}


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(300), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    rol: Mapped[str] = mapped_column(String(30), default="vendedor")
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    permisos: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    # ── Contraseña ─────────────────────────────────────────────────────────────

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

    # ── Permisos ───────────────────────────────────────────────────────────────

    def _permisos_dict(self) -> dict:
        """Devuelve el dict de permisos efectivos (custom o defaults del rol)."""
        if self.permisos:
            try:
                return json.loads(self.permisos)
            except Exception:
                pass
        return PERMISOS_POR_ROL.get(self.rol, PERMISOS_POR_ROL["vendedor"])

    def puede(self, modulo: str, accion: str = "ver") -> bool:
        """Verifica si el usuario tiene permiso para modulo/accion."""
        if self.rol == "admin":
            return True
        return self._permisos_dict().get(modulo, {}).get(accion, False)

    def permisos_completos(self) -> dict:
        """Devuelve dict completo de permisos para serializar al frontend."""
        p = self._permisos_dict()
        # Asegurar que todos los módulos estén presentes
        return {k: p.get(k, {"ver": False, "editar": False}) for k, _ in MODULOS}

    # ── Helpers ────────────────────────────────────────────────────────────────

    @property
    def rol_label(self) -> str:
        return {"admin": "Administrador", "vendedor": "Vendedor", "produccion": "Produccion"}.get(self.rol, self.rol)

    @property
    def es_admin(self) -> bool:
        return self.rol == "admin"
