from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

# Railway entrega URLs con prefijo "postgres://" (viejo) → normalizar a "postgresql://"
_db_url = settings.database_url
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql://", 1)

_is_sqlite = _db_url.startswith("sqlite")
engine = create_engine(
    _db_url,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.models import (  # noqa: F401
        insumo, receta, produccion, producto, cliente, venta, costo, sensorial, alerta, configuracion, usuario, conversacion_ia, gasto, ajuste_stock, registro_tapas  # noqa: F401
    )
    from app.models.venta import PedidoReserva  # noqa: F401
    from app.models.produccion import ProduccionTacho  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    _seed_admin()


def _run_migrations():
    """Add columns introduced after initial schema creation."""
    migrations = [
        "ALTER TABLE ventas ADD COLUMN forma_pago VARCHAR(30) DEFAULT 'efectivo'",
        "ALTER TABLE ventas ADD COLUMN consumidor_final BOOLEAN DEFAULT 0",
        "ALTER TABLE producciones ADD COLUMN tipo_produccion VARCHAR(20) DEFAULT 'general'",
        "ALTER TABLE producciones ADD COLUMN tapas_teoricas FLOAT",
        "ALTER TABLE producciones ADD COLUMN tapas_reales INTEGER",
        "ALTER TABLE producciones ADD COLUMN tapas_rotas INTEGER",
        "ALTER TABLE producciones ADD COLUMN peso_tapa_cruda_promedio_g FLOAT",
        "ALTER TABLE producciones ADD COLUMN peso_tapa_cocida_promedio_g FLOAT",
        "ALTER TABLE producciones ADD COLUMN masa_desperdiciada_g FLOAT",
        "ALTER TABLE producciones ADD COLUMN tapas_por_hornada INTEGER DEFAULT 80",
        "ALTER TABLE producciones ADD COLUMN minutos_por_hornada INTEGER DEFAULT 6",
        "ALTER TABLE producciones ADD COLUMN horas_horno_total FLOAT",
        "ALTER TABLE receta_ingredientes ADD COLUMN tipo_ingrediente VARCHAR(30) DEFAULT 'insumo'",
        "ALTER TABLE receta_ingredientes ADD COLUMN producto_terminado_id INTEGER",
        "ALTER TABLE produccion_insumos ADD COLUMN lote_producto_id INTEGER",
        "CREATE TABLE IF NOT EXISTS ordenes_compra (id INTEGER PRIMARY KEY, fecha DATETIME, proveedor VARCHAR(200), notas TEXT, costo_extra FLOAT DEFAULT 0, tipo_costo_extra VARCHAR(50) DEFAULT 'flete', total_sin_extra FLOAT DEFAULT 0, total_con_extra FLOAT DEFAULT 0, created_at DATETIME)",
        "ALTER TABLE lotes_insumo ADD COLUMN orden_compra_id INTEGER",
        "ALTER TABLE lotes_insumo ADD COLUMN tipo_presentacion VARCHAR(50) DEFAULT 'unidad'",
        "ALTER TABLE lotes_insumo ADD COLUMN cantidad_bultos FLOAT",
        "ALTER TABLE lotes_insumo ADD COLUMN unidades_por_bulto FLOAT",
        "ALTER TABLE lotes_insumo ADD COLUMN precio_por_bulto FLOAT",
        "ALTER TABLE lotes_insumo ADD COLUMN costo_extra_unitario FLOAT DEFAULT 0",
        "ALTER TABLE producciones ADD COLUMN peso_masa_total_g FLOAT",
        "ALTER TABLE producciones ADD COLUMN peso_tapa_objetivo_g FLOAT",
        "ALTER TABLE lotes_producto_terminado ADD COLUMN cantidad_reservada FLOAT DEFAULT 0",
        "CREATE TABLE IF NOT EXISTS pedido_reservas (id INTEGER PRIMARY KEY, pedido_id INTEGER NOT NULL, lote_id INTEGER NOT NULL, cantidad FLOAT NOT NULL, created_at DATETIME)",
        "CREATE TABLE IF NOT EXISTS produccion_tachos (id INTEGER PRIMARY KEY, produccion_id INTEGER NOT NULL, tipo VARCHAR(30) DEFAULT 'insumo', insumo_id INTEGER, lote_insumo_id INTEGER, gramos_usados FLOAT, numero_apertura INTEGER DEFAULT 1, lote_producto_id INTEGER, cantidad_tapas FLOAT, notas TEXT, registrado_at DATETIME)",
        "ALTER TABLE lotes_producto_terminado ADD COLUMN tipo VARCHAR(20) DEFAULT 'alfajor'",
        "ALTER TABLE producciones ADD COLUMN lote_origen_id INTEGER",
        "ALTER TABLE producciones ADD COLUMN horno_id INTEGER",
        "CREATE TABLE IF NOT EXISTS hornos (id INTEGER PRIMARY KEY, nombre VARCHAR(100), potencia_kw FLOAT, notas TEXT, activo BOOLEAN DEFAULT 1)",
        "ALTER TABLE receta_ingredientes ADD COLUMN cantidad_min FLOAT",
        "ALTER TABLE receta_ingredientes ADD COLUMN cantidad_max FLOAT",
        "ALTER TABLE producciones ADD COLUMN masa_real_g FLOAT",
        "ALTER TABLE producciones ADD COLUMN pesos_muestra_json TEXT",
        "ALTER TABLE producciones ADD COLUMN cantidad_recetas FLOAT DEFAULT 1",
        "ALTER TABLE producciones ADD COLUMN peso_tapa_min_g FLOAT",
        "ALTER TABLE producciones ADD COLUMN peso_tapa_max_g FLOAT",
        "ALTER TABLE producciones ADD COLUMN etapa_tapas VARCHAR(30)",
        "ALTER TABLE producciones ADD COLUMN tapas_crudas_contadas INTEGER",
        "ALTER TABLE producciones ADD COLUMN etapa_armado VARCHAR(30)",
        "ALTER TABLE producciones ADD COLUMN peso_alfajor_sin_bano_g FLOAT",
        "ALTER TABLE producciones ADD COLUMN peso_alfajor_con_bano_g FLOAT",
        "ALTER TABLE producciones ADD COLUMN pesos_sin_bano_json TEXT",
        "ALTER TABLE producciones ADD COLUMN pesos_con_bano_json TEXT",
        "ALTER TABLE producciones ADD COLUMN unidades_envasadas INTEGER",
        "CREATE TABLE IF NOT EXISTS gastos (id INTEGER PRIMARY KEY, fecha DATETIME, concepto VARCHAR(300) NOT NULL, monto FLOAT NOT NULL, categoria VARCHAR(50) DEFAULT 'otros', notas TEXT, created_at DATETIME)",
        "CREATE TABLE IF NOT EXISTS ajustes_stock (id INTEGER PRIMARY KEY, fecha DATETIME, tipo VARCHAR(20), insumo_id INTEGER, producto_id INTEGER, nombre VARCHAR(200), stock_sistema FLOAT, stock_real FLOAT, diferencia FLOAT, motivo VARCHAR(200) DEFAULT 'conteo fisico', created_at DATETIME)",
        "CREATE TABLE IF NOT EXISTS registros_tapas (id INTEGER PRIMARY KEY, produccion_id INTEGER NOT NULL, fecha DATETIME, tapas_ok INTEGER NOT NULL, tapas_rotas INTEGER DEFAULT 0, peso_tapa_cocida_g FLOAT, tiempo_coccion_min INTEGER, masa_desperdiciada_g FLOAT, notas TEXT, created_at DATETIME)",
        "ALTER TABLE registros_tapas ADD COLUMN peso_tapa_cocida_g FLOAT",
        "ALTER TABLE registros_tapas ADD COLUMN tiempo_coccion_min INTEGER",
        "ALTER TABLE registros_tapas ADD COLUMN masa_desperdiciada_g FLOAT",
        "ALTER TABLE registros_tapas ADD COLUMN notas TEXT",
        "ALTER TABLE registros_tapas ADD COLUMN created_at DATETIME",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(__import__("sqlalchemy").text(sql))
                conn.commit()
            except Exception:
                pass  # Column already exists


def _seed_admin():
    from app.models.usuario import Usuario
    db = SessionLocal()
    try:
        if not db.query(Usuario).filter(Usuario.username == "admin").first():
            u = Usuario(username="admin", nombre="Administrador", rol="admin")
            u.set_password("alitos2025")
            db.add(u)
            db.commit()
    finally:
        db.close()
