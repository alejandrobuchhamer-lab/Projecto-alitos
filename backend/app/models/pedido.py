from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean
from app.database import Base


class PedidoVendedor(Base):
    __tablename__ = "pedidos_vendedor"

    id               = Column(Integer, primary_key=True, index=True)
    vendedor_id      = Column(Integer, nullable=True)
    vendedor_nombre  = Column(String(200), nullable=True)
    lugar            = Column(String(300), nullable=False)
    negocio_id       = Column(Integer, nullable=True)
    unidades         = Column(Integer, nullable=False, default=0)
    monto            = Column(Float, nullable=False, default=0)
    estado           = Column(String(30), nullable=False, default="pendiente")
    productos_json   = Column(Text, nullable=True)
    notas            = Column(Text, nullable=True)
    activo           = Column(Boolean, default=True)
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Cliente
    tipo_cliente     = Column(String(30), default="consumidor_final")
    cliente_id       = Column(Integer, nullable=True)
    cliente_nombre   = Column(String(200), nullable=True)
    cliente_localidad = Column(String(100), nullable=True)
    # Entrega y pago
    fecha_entrega    = Column(DateTime, nullable=True)
    forma_pago       = Column(String(30), nullable=True)
    descuento_pct    = Column(Float, default=0)
    monto_lista      = Column(Float, default=0)
