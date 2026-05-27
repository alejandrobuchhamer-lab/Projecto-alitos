from datetime import datetime
from pydantic import BaseModel


class ClienteBase(BaseModel):
    nombre: str
    apellido: str | None = None
    empresa: str | None = None
    email: str | None = None
    telefono: str | None = None
    direccion: str | None = None
    tipo_cliente: str = "minorista"
    limite_credito: float = 0.0
    notas: str | None = None


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(BaseModel):
    nombre: str | None = None
    apellido: str | None = None
    empresa: str | None = None
    email: str | None = None
    telefono: str | None = None
    direccion: str | None = None
    tipo_cliente: str | None = None
    limite_credito: float | None = None
    notas: str | None = None
    activo: bool | None = None


class ClienteOut(ClienteBase):
    id: int
    deuda_total: float
    activo: bool
    nombre_completo: str = ""
    credito_disponible: float = 0.0
    created_at: datetime

    model_config = {"from_attributes": True}
