import json
from datetime import datetime
import hashlib
import secrets
from sqlalchemy import String, DateTime, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

# ── Acciones por módulo ────────────────────────────────────────────────────────
# Cada tupla: (key_modulo, label_modulo, [(key_accion, label_accion), ...])
# La PRIMERA acción de cada módulo es siempre "ver" — controla acceso a la página.
MODULOS_ACCIONES = [
    ("produccion", "Producción", [
        ("ver",       "Ver lista y detalles de producción"),
        ("iniciar",   "Iniciar nueva producción"),
        ("finalizar", "Finalizar / cerrar producción"),
    ]),
    ("insumos", "Insumos & Stock", [
        ("ver",          "Ver stock, lotes e historial"),
        ("agregar_lote", "Registrar ingreso de lotes"),
        ("crear_insumo", "Crear y editar insumos"),
        ("orden_compra", "Registrar órdenes de compra"),
    ]),
    ("recetas", "Recetas", [
        ("ver",    "Ver recetas y versiones"),
        ("crear",  "Crear nueva receta"),
        ("editar", "Editar receta existente"),
    ]),
    ("stock", "Conteo Stock", [
        ("ver",     "Ver conteo físico"),
        ("ajustar", "Realizar ajuste de stock"),
    ]),
    ("ventas", "Ventas", [
        ("ver",        "Ver lista de ventas"),
        ("crear",      "Registrar nueva venta"),
        ("cobrar",     "Cobrar / cerrar venta"),
        ("ver_margen", "Ver margen y costos"),
    ]),
    ("pedidos", "Pedidos", [
        ("ver",       "Ver lista de pedidos"),
        ("crear",     "Crear nuevo pedido"),
        ("gestionar", "Confirmar / cancelar pedidos"),
    ]),
    ("clientes", "Clientes", [
        ("ver",    "Ver clientes"),
        ("crear",  "Crear nuevo cliente"),
        ("editar", "Editar datos de cliente"),
    ]),
    ("finanzas", "Finanzas", [
        ("ver",             "Ver dashboard financiero"),
        ("registrar_gasto", "Registrar gastos"),
        ("capital",         "Gestionar inyecciones de capital"),
    ]),
    ("vendedores", "Vendedores & Repartos", [
        ("ver",       "Ver entregas y mapa"),
        ("registrar", "Registrar entregas y cobros"),
    ]),
    ("alertas", "Alertas", [
        ("ver",        "Ver alertas activas"),
        ("configurar", "Configurar umbrales de alerta"),
    ]),
    ("sensorial", "Lab Sensorial", [
        ("ver",       "Ver análisis sensoriales"),
        ("registrar", "Registrar nuevo análisis"),
    ]),
    ("ia", "Asistente IA", [
        ("asistente",        "Usar asistente ALITO"),
        ("analisis_precios", "Ver análisis de precios"),
    ]),
]

# ── Acceso rápido ──────────────────────────────────────────────────────────────
MODULOS = [(k, lbl) for k, lbl, _ in MODULOS_ACCIONES]


def _build_defaults(mapping: dict[str, list[str]]) -> dict:
    """Construye dict de permisos a partir de qué acciones están habilitadas por módulo."""
    result = {}
    for mod_key, _, acciones in MODULOS_ACCIONES:
        enabled = mapping.get(mod_key, [])
        result[mod_key] = {ak: (ak in enabled) for ak, _ in acciones}
    return result


PERMISOS_POR_ROL = {
    "admin": _build_defaults({mod: [ak for ak, _ in acc] for mod, _, acc in MODULOS_ACCIONES}),
    "produccion": _build_defaults({
        "produccion": ["ver", "iniciar", "finalizar"],
        "insumos":    ["ver", "agregar_lote", "crear_insumo", "orden_compra"],
        "recetas":    ["ver", "crear", "editar"],
        "stock":      ["ver", "ajustar"],
        "alertas":    ["ver"],
        "sensorial":  ["ver", "registrar"],
        "ia":         ["asistente", "analisis_precios"],
    }),
    "vendedor": _build_defaults({
        "ventas":      ["ver", "crear", "cobrar", "ver_margen"],
        "pedidos":     ["ver", "crear", "gestionar"],
        "clientes":    ["ver", "crear", "editar"],
        "vendedores":  ["ver", "registrar"],
    }),
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
    permisos: Mapped[str | None] = mapped_column(String(4000), nullable=True)

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
        if self.permisos:
            try:
                return json.loads(self.permisos)
            except Exception:
                pass
        return PERMISOS_POR_ROL.get(self.rol, PERMISOS_POR_ROL["vendedor"])

    def puede(self, modulo: str, accion: str = "ver") -> bool:
        if self.rol == "admin":
            return True
        mod = self._permisos_dict().get(modulo, {})
        if accion in mod:
            return bool(mod[accion])
        # Si la acción específica no existe, verificar si tiene 'ver' como fallback mínimo
        return False

    def permisos_completos(self) -> dict:
        """Dict completo con todas las acciones de todos los módulos."""
        effective = self._permisos_dict()
        result = {}
        for mod_key, _, acciones in MODULOS_ACCIONES:
            mod_p = effective.get(mod_key, {})
            result[mod_key] = {ak: bool(mod_p.get(ak, False)) for ak, _ in acciones}
        return result

    # ── Helpers ────────────────────────────────────────────────────────────────

    @property
    def rol_label(self) -> str:
        return {"admin": "Administrador", "vendedor": "Vendedor", "produccion": "Produccion"}.get(self.rol, self.rol)

    @property
    def es_admin(self) -> bool:
        return self.rol == "admin"
