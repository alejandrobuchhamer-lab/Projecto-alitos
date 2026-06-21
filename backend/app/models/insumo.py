from datetime import datetime
from sqlalchemy import String, Float, DateTime, Boolean, Integer, Text, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class UnidadMedida(str, enum.Enum):
    kg = "kg"
    g = "g"
    litro = "litro"
    ml = "ml"
    unidad = "unidad"
    docena = "docena"


class CategoriaInsumo(str, enum.Enum):
    chocolate = "chocolate"
    lacteo = "lacteo"
    cereal = "cereal"
    azucar = "azucar"
    grasa = "grasa"
    fruta = "fruta"
    aditivo = "aditivo"
    envase = "envase"
    otro = "otro"


class Insumo(Base):
    __tablename__ = "insumos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    descripcion: Mapped[str | None] = mapped_column(Text)
    unidad_medida: Mapped[str] = mapped_column(String(20), nullable=False)
    categoria: Mapped[str] = mapped_column(String(50), default="otro")
    stock_minimo: Mapped[float] = mapped_column(Float, default=0.0)
    proveedor_default: Mapped[str | None] = mapped_column(String(200))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lotes: Mapped[list["LoteInsumo"]] = relationship("LoteInsumo", back_populates="insumo")
    ingredientes_receta: Mapped[list["RecetaIngrediente"]] = relationship("RecetaIngrediente", back_populates="insumo")

    @property
    def stock_actual(self) -> float:
        return sum(l.cantidad_actual for l in self.lotes if l.activo and l.cantidad_actual > 0)

    @property
    def bajo_stock(self) -> bool:
        return self.stock_actual < self.stock_minimo

    @property
    def costo_unitario_promedio(self) -> float:
        """Costo promedio ponderado por unidad, considerando solo lotes activos con stock."""
        lotes = [l for l in self.lotes if l.activo and l.cantidad_actual > 0]
        total_qty = sum(l.cantidad_actual for l in lotes)
        if total_qty <= 0:
            # Si no hay stock, usar el último lote registrado
            todos = [l for l in self.lotes if l.activo]
            if todos:
                ultimo = max(todos, key=lambda l: l.fecha_ingreso)
                return ultimo.costo_unitario
            return 0.0
        return sum(l.cantidad_actual * l.costo_unitario for l in lotes) / total_qty

    @property
    def valor_stock(self) -> float:
        """Valor total del stock actual = stock_actual × costo_unitario_promedio."""
        return round(self.stock_actual * self.costo_unitario_promedio, 2)


class OrdenCompra(Base):
    """Agrupa múltiples lotes comprados en una misma operación."""
    __tablename__ = "ordenes_compra"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    proveedor: Mapped[str | None] = mapped_column(String(200))
    notas: Mapped[str | None] = mapped_column(Text)
    costo_extra: Mapped[float] = mapped_column(Float, default=0.0)
    tipo_costo_extra: Mapped[str] = mapped_column(String(50), default="flete")
    total_sin_extra: Mapped[float] = mapped_column(Float, default=0.0)
    total_con_extra: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    lotes: Mapped[list["LoteInsumo"]] = relationship("LoteInsumo", back_populates="orden_compra")


class LoteInsumo(Base):
    __tablename__ = "lotes_insumo"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    insumo_id: Mapped[int] = mapped_column(Integer, ForeignKey("insumos.id"), nullable=False)
    orden_compra_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("ordenes_compra.id"), nullable=True)
    numero_lote: Mapped[str] = mapped_column(String(100), nullable=False)
    cantidad_inicial: Mapped[float] = mapped_column(Float, nullable=False)
    cantidad_actual: Mapped[float] = mapped_column(Float, nullable=False)
    costo_unitario: Mapped[float] = mapped_column(Float, nullable=False)
    moneda: Mapped[str] = mapped_column(String(10), default="ARS")
    proveedor: Mapped[str | None] = mapped_column(String(200))
    fecha_ingreso: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    fecha_vencimiento: Mapped[datetime | None] = mapped_column(DateTime)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    notas: Mapped[str | None] = mapped_column(Text)
    # ── Presentación / bulto ──────────────────────────────────────────────────
    tipo_presentacion: Mapped[str] = mapped_column(String(50), default="unidad")
    cantidad_bultos: Mapped[float | None] = mapped_column(Float)
    unidades_por_bulto: Mapped[float | None] = mapped_column(Float)
    precio_por_bulto: Mapped[float | None] = mapped_column(Float)
    costo_extra_unitario: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    insumo: Mapped["Insumo"] = relationship("Insumo", back_populates="lotes")
    orden_compra: Mapped["OrdenCompra | None"] = relationship("OrdenCompra", back_populates="lotes")
    usos_produccion: Mapped[list["ProduccionInsumo"]] = relationship("ProduccionInsumo", back_populates="lote_insumo")

    @property
    def costo_total(self) -> float:
        return self.cantidad_inicial * self.costo_unitario

    @property
    def es_por_bulto(self) -> bool:
        return bool(self.unidades_por_bulto and self.unidades_por_bulto > 1)

    @property
    def descripcion_presentacion(self) -> str:
        if self.es_por_bulto and self.cantidad_bultos:
            return f"{self.cantidad_bultos:.0f} {self.tipo_presentacion}(s) × {self.unidades_por_bulto} u."
        return self.tipo_presentacion

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
