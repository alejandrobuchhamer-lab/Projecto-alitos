from datetime import datetime
from sqlalchemy import String, Float, DateTime, Boolean, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ProductoTerminado(Base):
    __tablename__ = "productos_terminados"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    descripcion: Mapped[str | None] = mapped_column(Text)
    categoria: Mapped[str] = mapped_column(String(100), default="general")
    unidad_medida: Mapped[str] = mapped_column(String(20), default="unidad")
    precio_venta_base: Mapped[float] = mapped_column(Float, default=0.0)
    stock_minimo: Mapped[float] = mapped_column(Float, default=0.0)
    dias_vida_util: Mapped[int | None] = mapped_column(Integer)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    recetas: Mapped[list["RecetaVersion"]] = relationship("RecetaVersion", back_populates="producto")
    lotes: Mapped[list["LoteProductoTerminado"]] = relationship("LoteProductoTerminado", back_populates="producto")
    detalles_pedido: Mapped[list["PedidoDetalle"]] = relationship("PedidoDetalle", back_populates="producto")

    @property
    def stock_actual(self) -> float:
        return sum(l.cantidad_actual for l in self.lotes if l.activo and l.cantidad_actual > 0 and l.tipo == "alfajor")

    @property
    def receta_activa(self):
        activas = [r for r in self.recetas if r.activo]
        return max(activas, key=lambda r: r.version) if activas else None


class LoteProductoTerminado(Base):
    __tablename__ = "lotes_producto_terminado"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    produccion_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("producciones.id"))
    producto_id: Mapped[int] = mapped_column(Integer, ForeignKey("productos_terminados.id"), nullable=False)
    numero_lote: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    cantidad_inicial: Mapped[float] = mapped_column(Float, nullable=False)
    cantidad_actual: Mapped[float] = mapped_column(Float, nullable=False)
    costo_unitario_calculado: Mapped[float] = mapped_column(Float, default=0.0)
    fecha_produccion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    fecha_vencimiento: Mapped[datetime | None] = mapped_column(DateTime)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    notas: Mapped[str | None] = mapped_column(Text)
    cantidad_reservada: Mapped[float] = mapped_column(Float, default=0.0)
    tipo: Mapped[str] = mapped_column(String(20), default="alfajor")  # masa | tapas | alfajor

    produccion: Mapped["Produccion | None"] = relationship(
        "Produccion", back_populates="lotes_producto",
        foreign_keys="LoteProductoTerminado.produccion_id"
    )
    producto: Mapped["ProductoTerminado"] = relationship("ProductoTerminado", back_populates="lotes")
    detalles_venta: Mapped[list["VentaDetalle"]] = relationship("VentaDetalle", back_populates="lote_producto")
    pruebas_sensoriales: Mapped[list["PruebaSensorial"]] = relationship("PruebaSensorial", back_populates="lote_producto")

    @property
    def cantidad_libre(self) -> float:
        return max(0.0, self.cantidad_actual - self.cantidad_reservada)

    @property
    def dias_para_vencer(self) -> int | None:
        if not self.fecha_vencimiento:
            return None
        delta = self.fecha_vencimiento - datetime.utcnow()
        return delta.days

    @property
    def esta_vencido(self) -> bool:
        if not self.fecha_vencimiento:
            return False
        return datetime.utcnow() > self.fecha_vencimiento
