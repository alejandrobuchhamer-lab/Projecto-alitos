from datetime import datetime
from pydantic import BaseModel, field_validator, Field


class InsumoBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    descripcion: str | None = Field(None, max_length=500)
    unidad_medida: str = Field(..., min_length=1, max_length=20)
    categoria: str = Field("otro", max_length=50)
    stock_minimo: float = Field(0.0, ge=0)
    proveedor_default: str | None = Field(None, max_length=200)


class InsumoCreate(InsumoBase):
    pass


class InsumoUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=200)
    descripcion: str | None = Field(None, max_length=500)
    unidad_medida: str | None = Field(None, max_length=20)
    categoria: str | None = Field(None, max_length=50)
    stock_minimo: float | None = Field(None, ge=0)
    proveedor_default: str | None = Field(None, max_length=200)
    activo: bool | None = None


class InsumoOut(InsumoBase):
    id: int
    activo: bool
    stock_actual: float = 0.0
    bajo_stock: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Lote ─────────────────────────────────────────────────────────────────────

class LoteInsumoBase(BaseModel):
    insumo_id: int = Field(..., gt=0)
    numero_lote: str | None = Field(None, max_length=100)
    cantidad_inicial: float = Field(..., gt=0, le=1_000_000)
    costo_unitario: float = Field(..., ge=0, le=100_000_000)
    moneda: str = Field("ARS", max_length=10)
    proveedor: str | None = Field(None, max_length=200)
    fecha_vencimiento: datetime | None = None
    notas: str | None = Field(None, max_length=500)
    tipo_presentacion: str = Field("unidad", max_length=30)
    cantidad_bultos: float | None = Field(None, gt=0)
    unidades_por_bulto: float | None = Field(None, gt=0)
    precio_por_bulto: float | None = Field(None, ge=0)
    costo_extra_unitario: float = Field(0.0, ge=0)


class LoteInsumoCreate(LoteInsumoBase):
    pass


class LoteInsumoUpdate(BaseModel):
    cantidad_actual: float | None = Field(None, ge=0)
    costo_unitario: float | None = Field(None, ge=0)
    proveedor: str | None = Field(None, max_length=200)
    fecha_vencimiento: datetime | None = None
    notas: str | None = Field(None, max_length=500)
    tipo_presentacion: str | None = Field(None, max_length=30)
    activo: bool | None = None


class LoteInsumoOut(LoteInsumoBase):
    id: int
    cantidad_actual: float
    activo: bool
    fecha_ingreso: datetime
    dias_para_vencer: int | None = None
    esta_vencido: bool = False
    costo_total: float = 0.0
    descripcion_presentacion: str = "unidad"
    orden_compra_id: int | None = None

    model_config = {"from_attributes": True}


# ── Ingreso masivo ────────────────────────────────────────────────────────────

class ItemIngresoCreate(BaseModel):
    insumo_id: int = Field(..., gt=0)
    tipo_presentacion: str = Field("unidad", max_length=30)
    cantidad_bultos: float = Field(1.0, gt=0, le=100_000)
    unidades_por_bulto: float = Field(1.0, gt=0, le=100_000)
    precio_por_bulto: float = Field(..., ge=0, le=100_000_000)
    proveedor: str | None = Field(None, max_length=200)
    fecha_vencimiento: datetime | None = None
    numero_lote: str | None = Field(None, max_length=100)
    notas: str | None = Field(None, max_length=500)


class IngresoMasivoCreate(BaseModel):
    proveedor_global: str | None = Field(None, max_length=200)
    fecha: datetime | None = None
    notas: str | None = Field(None, max_length=500)
    costo_extra: float = Field(0.0, ge=0)
    tipo_costo_extra: str = Field("flete", max_length=50)
    items: list[ItemIngresoCreate] = Field(..., min_length=1, max_length=200)


class IngresoMasivoResult(BaseModel):
    orden_compra_id: int
    lotes_creados: int
    total_sin_extra: float
    total_con_extra: float
    costo_extra: float
    items: list[LoteInsumoOut]
