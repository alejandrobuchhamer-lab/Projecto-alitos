from datetime import datetime
from sqlalchemy import String, Float, DateTime, Boolean, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class EstadoProduccion(str, enum.Enum):
    planificada = "planificada"
    en_proceso = "en_proceso"
    finalizada = "finalizada"
    cancelada = "cancelada"


class Produccion(Base):
    __tablename__ = "producciones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    receta_version_id: Mapped[int] = mapped_column(Integer, ForeignKey("receta_versiones.id"), nullable=False)
    numero_lote_produccion: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    fecha_inicio: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    fecha_fin: Mapped[datetime | None] = mapped_column(DateTime)
    cantidad_producida: Mapped[float] = mapped_column(Float, default=0.0)
    costo_total_insumos: Mapped[float] = mapped_column(Float, default=0.0)
    estado: Mapped[str] = mapped_column(String(30), default=EstadoProduccion.planificada)
    operario: Mapped[str | None] = mapped_column(String(100))
    notas: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # ── Campos de etapa de tapas ─────────────────────────────────────────────
    tipo_produccion: Mapped[str] = mapped_column(String(20), default="general")  # general|tapas|armado
    # Masa amasada
    peso_masa_total_g: Mapped[float | None] = mapped_column(Float)   # gramos de masa total amasada
    peso_tapa_objetivo_g: Mapped[float | None] = mapped_column(Float)  # gramos objetivo por tapa
    # Rendimiento de tapas
    tapas_teoricas: Mapped[float | None] = mapped_column(Float)      # calculado desde masa o receta
    tapas_reales: Mapped[int | None] = mapped_column(Integer)        # tapas que salieron ok
    tapas_rotas: Mapped[int | None] = mapped_column(Integer)         # tapas descartadas
    # Pesos (en gramos)
    peso_tapa_cruda_promedio_g: Mapped[float | None] = mapped_column(Float)
    peso_tapa_cocida_promedio_g: Mapped[float | None] = mapped_column(Float)
    masa_desperdiciada_g: Mapped[float | None] = mapped_column(Float)
    # Horno
    tapas_por_hornada: Mapped[int | None] = mapped_column(Integer, default=80)
    minutos_por_hornada: Mapped[int | None] = mapped_column(Integer, default=6)
    horas_horno_total: Mapped[float | None] = mapped_column(Float)
    lote_origen_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("lotes_producto_terminado.id"), nullable=True)
    horno_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    masa_real_g: Mapped[float | None] = mapped_column(Float)
    pesos_muestra_json: Mapped[str | None] = mapped_column(Text)
    cantidad_recetas: Mapped[float] = mapped_column(Float, default=1.0)
    peso_tapa_min_g: Mapped[float | None] = mapped_column(Float)
    peso_tapa_max_g: Mapped[float | None] = mapped_column(Float)
    etapa_tapas: Mapped[str | None] = mapped_column(String(30))  # pesaje_cruda | conteo_crudo
    tapas_crudas_contadas: Mapped[int | None] = mapped_column(Integer)
    # Armado: etapas de pesaje
    etapa_armado: Mapped[str | None] = mapped_column(String(30))  # pesaje_sin_bano | pesaje_con_bano | envasado
    peso_alfajor_sin_bano_g: Mapped[float | None] = mapped_column(Float)
    peso_alfajor_con_bano_g: Mapped[float | None] = mapped_column(Float)
    pesos_sin_bano_json: Mapped[str | None] = mapped_column(Text)
    pesos_con_bano_json: Mapped[str | None] = mapped_column(Text)
    unidades_envasadas: Mapped[int | None] = mapped_column(Integer)

    receta_version: Mapped["RecetaVersion"] = relationship("RecetaVersion", back_populates="producciones")
    insumos_usados: Mapped[list["ProduccionInsumo"]] = relationship(
        "ProduccionInsumo", back_populates="produccion", cascade="all, delete-orphan"
    )
    lotes_producto: Mapped[list["LoteProductoTerminado"]] = relationship(
        "LoteProductoTerminado", back_populates="produccion",
        foreign_keys="LoteProductoTerminado.produccion_id"
    )

    @property
    def tapas_desde_masa(self) -> float | None:
        if self.peso_masa_total_g and self.peso_tapa_objetivo_g and self.peso_tapa_objetivo_g > 0:
            return round(self.peso_masa_total_g / self.peso_tapa_objetivo_g, 1)
        return None

    @property
    def merma_tapas(self) -> int | None:
        teoricas = self.tapas_desde_masa or self.tapas_teoricas
        if teoricas and self.tapas_reales:
            return max(0, int(teoricas) - self.tapas_reales)
        return None

    @property
    def costo_unitario(self) -> float:
        if self.cantidad_producida and self.cantidad_producida > 0:
            return self.costo_total_insumos / self.cantidad_producida
        return 0.0

    @property
    def rendimiento_real_pct(self) -> float | None:
        if self.tapas_teoricas and self.tapas_reales and self.tapas_teoricas > 0:
            return round((self.tapas_reales / self.tapas_teoricas) * 100, 1)
        return None

    @property
    def desperdicio_pct(self) -> float | None:
        if self.tapas_teoricas and self.tapas_reales and self.tapas_teoricas > 0:
            total_perdidas = (self.tapas_teoricas - self.tapas_reales)
            return round((total_perdidas / self.tapas_teoricas) * 100, 1)
        return None

    @property
    def hornadas_calculadas(self) -> int | None:
        if self.tapas_reales and self.tapas_por_hornada and self.tapas_por_hornada > 0:
            import math
            return math.ceil(self.tapas_reales / self.tapas_por_hornada)
        return None

    @property
    def tiempo_coccion_minutos(self) -> float | None:
        hornadas = self.hornadas_calculadas
        if hornadas and self.minutos_por_hornada:
            return hornadas * self.minutos_por_hornada
        return None


class ProduccionInsumo(Base):
    __tablename__ = "produccion_insumos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    produccion_id: Mapped[int] = mapped_column(Integer, ForeignKey("producciones.id"), nullable=False)
    lote_insumo_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("lotes_insumo.id"), nullable=True)
    lote_producto_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("lotes_producto_terminado.id"), nullable=True)
    cantidad_usada: Mapped[float] = mapped_column(Float, nullable=False)
    costo_unitario: Mapped[float] = mapped_column(Float, nullable=False)

    produccion: Mapped["Produccion"] = relationship("Produccion", back_populates="insumos_usados")
    lote_insumo: Mapped["LoteInsumo | None"] = relationship("LoteInsumo", back_populates="usos_produccion")
    lote_producto: Mapped["LoteProductoTerminado | None"] = relationship("LoteProductoTerminado")

    @property
    def costo_total(self) -> float:
        return self.cantidad_usada * self.costo_unitario

    @property
    def nombre_componente(self) -> str:
        if self.lote_insumo:
            return self.lote_insumo.insumo.nombre
        if self.lote_producto:
            return self.lote_producto.producto.nombre
        return "Desconocido"


class ProduccionTacho(Base):
    """Registro de apertura de tachos/insumos durante armado (staging antes de finalizar)."""
    __tablename__ = "produccion_tachos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    produccion_id: Mapped[int] = mapped_column(Integer, ForeignKey("producciones.id"), nullable=False)
    tipo: Mapped[str] = mapped_column(String(30), default="insumo")  # "insumo" | "tapas"
    # Para insumos (dulce, chocolate, etc.)
    insumo_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("insumos.id"), nullable=True)
    lote_insumo_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("lotes_insumo.id"), nullable=True)
    gramos_usados: Mapped[float | None] = mapped_column(Float)
    numero_apertura: Mapped[int] = mapped_column(Integer, default=1)
    # Para tapas (producto terminado)
    lote_producto_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("lotes_producto_terminado.id"), nullable=True)
    cantidad_tapas: Mapped[float | None] = mapped_column(Float)
    # Común
    notas: Mapped[str | None] = mapped_column(Text)
    registrado_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Horno(Base):
    __tablename__ = "hornos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    potencia_kw: Mapped[float | None] = mapped_column(Float)
    notas: Mapped[str | None] = mapped_column(Text)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
