from datetime import datetime
from pydantic import BaseModel, field_validator, Field


class PedidoDetalleCreate(BaseModel):
    producto_id: int = Field(..., gt=0)
    cantidad: float = Field(..., gt=0, le=100000)
    precio_unitario: float = Field(..., ge=0, le=10_000_000)


class PedidoCreate(BaseModel):
    cliente_id: int = Field(..., gt=0)
    fecha_entrega_requerida: datetime | None = None
    notas: str | None = Field(None, max_length=500)
    detalles: list[PedidoDetalleCreate] = Field(default_factory=list, max_length=100)


class PedidoOut(BaseModel):
    id: int
    cliente_id: int
    numero_pedido: str
    fecha_pedido: datetime
    fecha_entrega_requerida: datetime | None
    estado: str
    notas: str | None
    total_estimado: float

    model_config = {"from_attributes": True}


class VentaDetalleCreate(BaseModel):
    lote_producto_id: int = Field(..., gt=0)
    cantidad: float = Field(..., gt=0, le=100000)
    precio_unitario: float = Field(..., ge=0, le=10_000_000)


class VentaCreate(BaseModel):
    cliente_id: int = Field(..., ge=0)  # 0 = consumidor final
    pedido_id: int | None = Field(None, gt=0)
    notas: str | None = Field(None, max_length=500)
    descuento: float = Field(0.0, ge=0.0, le=10_000_000)
    forma_pago: str = Field("efectivo", max_length=50)
    consumidor_final: bool = False
    detalles: list[VentaDetalleCreate] = Field(default_factory=list, max_length=100)

    @field_validator("forma_pago")
    @classmethod
    def validar_forma_pago(cls, v: str) -> str:
        permitidas = {"efectivo", "transferencia", "debito", "credito", "qr", "fiado", "otro", "cuenta_corriente", "mercado_pago"}
        if v.lower() not in permitidas:
            raise ValueError(f"Forma de pago inválida. Opciones: {', '.join(permitidas)}")
        return v.lower()

    @field_validator("detalles")
    @classmethod
    def al_menos_un_detalle(cls, v):
        if not v:
            raise ValueError("La venta debe tener al menos un producto")
        return v


class VentaOut(BaseModel):
    id: int
    cliente_id: int
    pedido_id: int | None
    numero_factura: str
    fecha_venta: datetime
    estado: str
    forma_pago: str
    consumidor_final: bool
    total_bruto: float
    descuento: float
    total_neto: float
    costo_total: float
    margen_bruto: float
    margen_porcentaje: float

    model_config = {"from_attributes": True}
