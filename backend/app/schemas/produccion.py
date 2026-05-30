from datetime import datetime
from pydantic import BaseModel


class ProduccionCreate(BaseModel):
    receta_version_id: int | None = None
    operario: str | None = None
    notas: str | None = None
    tipo_produccion: str = "general"  # general | tapas | armado | masa
    peso_masa_total_g: float | None = None
    peso_tapa_objetivo_g: float | None = None
    peso_tapa_min_g: float | None = None
    peso_tapa_max_g: float | None = None
    lote_origen_id: int | None = None
    cantidad_recetas: float = 1.0
    cantidad_tapas_a_usar: int | None = None


class ProduccionOut(BaseModel):
    id: int
    receta_version_id: int | None
    numero_lote_produccion: str
    fecha_inicio: datetime
    fecha_fin: datetime | None
    cantidad_producida: float
    costo_total_insumos: float
    costo_unitario: float
    estado: str
    operario: str | None
    notas: str | None
    tipo_produccion: str = "general"
    peso_masa_total_g: float | None = None
    peso_tapa_objetivo_g: float | None = None
    tapas_desde_masa: float | None = None
    merma_tapas: int | None = None
    tapas_teoricas: float | None = None
    tapas_reales: int | None = None
    tapas_rotas: int | None = None
    peso_tapa_cruda_promedio_g: float | None = None
    peso_tapa_cocida_promedio_g: float | None = None
    masa_desperdiciada_g: float | None = None
    tapas_por_hornada: int | None = None
    minutos_por_hornada: int | None = None
    horas_horno_total: float | None = None
    rendimiento_real_pct: float | None = None
    desperdicio_pct: float | None = None
    hornadas_calculadas: int | None = None
    tiempo_coccion_minutos: float | None = None
    lote_origen_id: int | None = None
    masa_real_g: float | None = None
    pesos_muestra_json: str | None = None
    cantidad_recetas: float = 1.0
    peso_tapa_min_g: float | None = None
    peso_tapa_max_g: float | None = None
    etapa_tapas: str | None = None
    tapas_crudas_contadas: int | None = None

    model_config = {"from_attributes": True}


class ProduccionFinalizar(BaseModel):
    cantidad_producida: float | None = None  # si None, se usa tapas_reales
    notas: str | None = None
    # Masa fields
    masa_real_g: float | None = None
    pesos_muestra_json: str | None = None
    # Tapas fields
    tapas_reales: int | None = None
    tapas_rotas: int | None = None
    peso_tapa_cruda_promedio_g: float | None = None
    peso_tapa_cocida_promedio_g: float | None = None
    masa_desperdiciada_g: float | None = None
    tapas_por_hornada: int | None = None
    minutos_por_hornada: int | None = None
    horas_horno_total: float | None = None


class ProduccionTapaUpdate(BaseModel):
    """Para actualizar datos de producción de tapas en tiempo real (PATCH)."""
    tapas_reales: int | None = None
    tapas_rotas: int | None = None
    peso_tapa_cruda_promedio_g: float | None = None
    peso_tapa_cocida_promedio_g: float | None = None
    masa_desperdiciada_g: float | None = None
    horas_horno_total: float | None = None
