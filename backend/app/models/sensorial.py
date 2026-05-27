from datetime import datetime
from sqlalchemy import String, Float, DateTime, Boolean, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PruebaSensorial(Base):
    __tablename__ = "pruebas_sensoriales"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    lote_producto_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("lotes_producto_terminado.id"))
    receta_version_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("receta_versiones.id"))
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    evaluador: Mapped[str] = mapped_column(String(100), nullable=False)

    dulzura: Mapped[int | None] = mapped_column(Integer)
    acidez: Mapped[int | None] = mapped_column(Integer)
    textura: Mapped[int | None] = mapped_column(Integer)
    aroma: Mapped[int | None] = mapped_column(Integer)
    sabor_general: Mapped[int | None] = mapped_column(Integer)
    apariencia: Mapped[int | None] = mapped_column(Integer)

    notas: Mapped[str | None] = mapped_column(Text)
    defectos_detectados: Mapped[str | None] = mapped_column(Text)
    recomendacion_ia: Mapped[str | None] = mapped_column(Text)
    aprobado: Mapped[bool | None] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    lote_producto: Mapped["LoteProductoTerminado | None"] = relationship(
        "LoteProductoTerminado", back_populates="pruebas_sensoriales"
    )
    receta_version: Mapped["RecetaVersion | None"] = relationship(
        "RecetaVersion", back_populates="pruebas_sensoriales"
    )

    @property
    def score_total(self) -> float | None:
        scores = [v for v in [self.dulzura, self.acidez, self.textura, self.aroma, self.sabor_general, self.apariencia] if v is not None]
        return round(sum(scores) / len(scores), 1) if scores else None
