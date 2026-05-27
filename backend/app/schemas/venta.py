from datetime import datetime
from pydantic import BaseModel


class PedidoDetalleCreate(BaseModel):
    producto_id: int
    cantidad: float
    precio_unitario: float


class PedidoCreate(BaseModel):
    cliente_id: int
    fecha_entrega_requerida: datetime | None = None
    notas: str | None = None
    detalles: list[PedidoDetalleCreate] = []


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
    lote_producto_id: int
    cantidad: float
    precio_unitario: float


class VentaCreate(BaseModel):
    cliente_id: int
    pedido_id: int | None = None
    notas: str | None = None
    descuento: float = 0.0
    forma_pago: str = "efectivo"
    consumidor_final: bool = False
    detalles: list[VentaDetalleCreate] = []


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
