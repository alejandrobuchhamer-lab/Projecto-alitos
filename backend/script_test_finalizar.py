"""Test directo de finalizar_armado."""
import sys, traceback
sys.path.insert(0, ".")

# Import all models via main app to ensure registry is complete
from app.main import app  # this triggers all model imports
from app.database import get_db
from app.models.produccion import Produccion, ProduccionTacho
from app.models.producto import LoteProductoTerminado
from app.models.insumo import Insumo, LoteInsumo
from app.services.produccion_service import finalizar_armado
from app.services.stock_service import consumir_stock_fefo

db = next(get_db())

PROD_ID = 5
UNIDADES = 80
DIAS_VTO = 35

prod = db.query(Produccion).filter(Produccion.id == PROD_ID).first()
print(f"Produccion: {prod.id}, tipo={prod.tipo_produccion}, estado={prod.estado}")

rv = prod.receta_version
print(f"RecetaVersion id={rv.id}, tapas_por_alfajor={rv.tapas_por_alfajor}")

# Check if RecetaVersion has 'produto' or 'producto' attribute
try:
    p = rv.produto
    print(f"rv.produto = {p.nombre}")
except AttributeError:
    print("rv.produto NO EXISTE")
try:
    p = rv.producto
    print(f"rv.producto = {p.nombre}")
except AttributeError:
    print("rv.producto NO EXISTE")

# Check LoteProductoTerminado attributes
lpt = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id == 4).first()
print(f"\nLote tapas: {lpt.numero_lote}, cantidad_actual={lpt.cantidad_actual}")

# Check what attribute LoteProductoTerminado uses for product id
try:
    print(f"lpt.produto_id = {lpt.produto_id}")
except AttributeError:
    print("lpt.produto_id NO EXISTE")
try:
    print(f"lpt.producto_id = {lpt.producto_id}")
except AttributeError:
    print("lpt.producto_id NO EXISTE")

# Now try ProduccionTacho auto-creation (simulate envasar_y_finalizar)
print("\n--- Simulando auto-creacion tapas tacho ---")
tapas_tachos = db.query(ProduccionTacho).filter(
    ProduccionTacho.produccion_id == PROD_ID,
    ProduccionTacho.tipo == "tapas",
).count()
print(f"tapas_tachos count = {tapas_tachos}")

if tapas_tachos == 0 and prod.lote_origen_id:
    tapas_por_alf = (rv.tapas_por_alfajor or 2) if rv else 2
    tacho_tapas = ProduccionTacho(
        produccion_id=PROD_ID,
        tipo="tapas",
        lote_producto_id=prod.lote_origen_id,
        cantidad_tapas=float(UNIDADES * tapas_por_alf),
    )
    db.add(tacho_tapas)
    db.flush()
    print(f"Tacho tapas creado: lote_id={prod.lote_origen_id}, cantidad={UNIDADES*tapas_por_alf}")

# Now try finalizar_armado
print("\n--- Ejecutando finalizar_armado ---")
try:
    lote = finalizar_armado(db, PROD_ID, UNIDADES, None, DIAS_VTO)
    print(f"EXITO: lote_alfajor={lote.numero_lote}, costo_unit={lote.costo_unitario_calculado}")
    db.rollback()  # Don't actually save
    print("Rolled back (solo fue test)")
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
    print(traceback.format_exc())
    db.rollback()
