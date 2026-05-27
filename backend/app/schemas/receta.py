from datetime import datetime
from pydantic import BaseModel


class RecetaIngredienteBase(BaseModel):
    tipo_ingrediente: str = "insumo"  # insumo | producto_terminado
    insumo_id: int | None = None
    producto_terminado_id: int | None = None
    cantidad: float
    unidad_medida: str
    es_critico: bool = False
    notas: str | None = None


class RecetaIngredienteCreate(RecetaIngredienteBase):
    pass


class RecetaIngredienteOut(RecetaIngredienteBase):
    id: int
    receta_version_id: int
    insumo_nombre: str = ""

    model_config = {"from_attributes": True}


class RecetaVersionBase(BaseModel):
    producto_id: int
    nombre: str
    descripcion: str | None = None
    rendimiento_esperado: float
    unidad_rendimiento: str = "unidad"
    tiempo_produccion_minutos: int | None = None
    instrucciones: str | None = None
    # Ficha técnica del alfajor
    peso_tapa_objetivo_g: float | None = None
    tapas_por_alfajor: int | None = None
    peso_relleno_objetivo_g: float | None = None
    peso_bano_objetivo_g: float | None = None
    peso_alfajor_objetivo_g: float | None = None


class RecetaVersionCreate(RecetaVersionBase):
    ingredientes: list[RecetaIngredienteCreate] = []
    created_by: str | None = None


class RecetaVersionOut(RecetaVersionBase):
    id: int
    version: int
    activo: bool
    fecha_creacion: datetime
    ingredientes: list[RecetaIngredienteOut] = []

    model_config = {"from_attributes": True}
