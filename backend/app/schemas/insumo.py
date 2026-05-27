from datetime import datetime
from pydantic import BaseModel


class InsumoBase(BaseModel):
    nombre: str
    descripcion: str | None = None
    unidad_medida: str
    categoria: str = "otro"
    stock_minimo: float = 0.0
    proveedor_default: str | None = None


class InsumoCreate(InsumoBase):
    pass


class InsumoUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    unidad_medida: str | None = None
    categoria: str | None = None
    stock_minimo: float | None = None
    proveedor_default: str | None = None
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
    insumo_id: int
    numero_lote: str
    cantidad_inicial: float
    costo_unitario: float
    moneda: str = "ARS"
    proveedor: str | None = None
    fecha_vencimiento: datetime | None = None
    notas: str | None = None
    # Presentación / bulto
    tipo_presentacion: str = "unidad"
    cantidad_bultos: float | None = None
    unidades_por_bulto: float | None = None
    precio_por_bulto: float | None = None
    costo_extra_unitario: float = 0.0


class LoteInsumoCreate(LoteInsumoBase):
    pass


class LoteInsumoUpdate(BaseModel):
    cantidad_actual: float | None = None
    costo_unitario: float | None = None
    proveedor: str | None = None
    fecha_vencimiento: datetime | None = None
    notas: str | None = None
    tipo_presentacion: str | None = None
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
    insumo_id: int
    tipo_presentacion: str = "unidad"
    cantidad_bultos: float = 1.0
    unidades_por_bulto: float = 1.0
    precio_por_bulto: float
    proveedor: str | None = None
    fecha_vencimiento: datetime | None = None
    numero_lote: str | None = None
    notas: str | None = None


class IngresoMasivoCreate(BaseModel):
    proveedor_global: str | None = None
    fecha: datetime | None = None
    notas: str | None = None
    costo_extra: float = 0.0
    tipo_costo_extra: str = "flete"
    items: list[ItemIngresoCreate]


class IngresoMasivoResult(BaseModel):
    orden_compra_id: int
    lotes_creados: int
    total_sin_extra: float
    total_con_extra: float
    costo_extra: float
    items: list[LoteInsumoOut]
