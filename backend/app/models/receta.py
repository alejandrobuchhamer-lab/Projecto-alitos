from datetime import datetime
from sqlalchemy import String, Float, DateTime, Boolean, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class RecetaVersion(Base):
    __tablename__ = "receta_versiones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    producto_id: Mapped[int] = mapped_column(Integer, ForeignKey("productos_terminados.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    nombre: Mapped[str] = mapped_column(String(300), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    rendimiento_esperado: Mapped[float] = mapped_column(Float, nullable=False)
    unidad_rendimiento: Mapped[str] = mapped_column(String(20), default="unidad")
    tiempo_produccion_minutos: Mapped[int | None] = mapped_column(Integer)
    instrucciones: Mapped[str | None] = mapped_column(Text)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[str | None] = mapped_column(String(100))

    # Ficha técnica del alfajor terminado
    peso_tapa_objetivo_g: Mapped[float | None] = mapped_column(Float)
    tapas_por_alfajor: Mapped[int | None] = mapped_column(Integer)
    peso_relleno_objetivo_g: Mapped[float | None] = mapped_column(Float)
    peso_bano_objetivo_g: Mapped[float | None] = mapped_column(Float)
    peso_alfajor_objetivo_g: Mapped[float | None] = mapped_column(Float)

    producto: Mapped["ProductoTerminado"] = relationship("ProductoTerminado", back_populates="recetas")
    ingredientes: Mapped[list["RecetaIngrediente"]] = relationship(
        "RecetaIngrediente", back_populates="receta_version", cascade="all, delete-orphan"
    )
    producciones: Mapped[list["Produccion"]] = relationship("Produccion", back_populates="receta_version")
    pruebas_sensoriales: Mapped[list["PruebaSensorial"]] = relationship("PruebaSensorial", back_populates="receta_version")


class RecetaIngrediente(Base):
    __tablename__ = "receta_ingredientes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    receta_version_id: Mapped[int] = mapped_column(Integer, ForeignKey("receta_versiones.id"), nullable=False)
    # tipo_ingrediente = 'insumo' | 'producto_terminado'
    tipo_ingrediente: Mapped[str] = mapped_column(String(30), default="insumo")
    insumo_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("insumos.id"), nullable=True)
    producto_terminado_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cantidad: Mapped[float] = mapped_column(Float, nullable=False)
    unidad_medida: Mapped[str] = mapped_column(String(20), nullable=False)
    es_critico: Mapped[bool] = mapped_column(Boolean, default=False)
    cantidad_min: Mapped[float | None] = mapped_column(Float)
    cantidad_max: Mapped[float | None] = mapped_column(Float)
    notas: Mapped[str | None] = mapped_column(Text)

    receta_version: Mapped["RecetaVersion"] = relationship("RecetaVersion", back_populates="ingredientes")
    insumo: Mapped["Insumo | None"] = relationship("Insumo", back_populates="ingredientes_receta")

    @property
    def insumo_nombre(self) -> str:
        if self.tipo_ingrediente == "producto_terminado":
            return self._nombre_producto or f"Producto #{self.producto_terminado_id}"
        return self.insumo.nombre if self.insumo else ""

    @property
    def _nombre_producto(self) -> str | None:
        """Lazy name — cargado por el servicio si es necesario."""
        return getattr(self, "_cached_nombre_producto", None)

    def set_nombre_producto(self, nombre: str):
        self._cached_nombre_producto = nombre
