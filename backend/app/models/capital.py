from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, Text
from app.database import Base


class InyeccionCapital(Base):
    __tablename__ = "inyecciones_capital"

    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(DateTime, default=datetime.utcnow)
    monto = Column(Float, nullable=False)
    origen = Column(String(100), default="sueldo")  # sueldo, ahorro, prestamo, otro
    notas = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
