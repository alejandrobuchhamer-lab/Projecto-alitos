import sqlite3
from datetime import datetime

TARIFA_KWH = 240.0        # ARS/kWh — estimado cooperativa residencial (ajustar con boleta real)
POTENCIA_KW = 2.67        # Santini MC600
HORAS_HORNO = 0.88        # registrado en produccion_id=4 (tapas)
ALFAJORES = 80

kwh_total = POTENCIA_KW * HORAS_HORNO
costo_luz_total = kwh_total * TARIFA_KWH
costo_luz_por_alf = costo_luz_total / ALFAJORES

print(f"Santini MC600: {POTENCIA_KW} kW x {HORAS_HORNO} hs = {kwh_total:.3f} kWh")
print(f"Costo total luz: ${costo_luz_total:.2f}  ({kwh_total:.3f} kWh x ${TARIFA_KWH}/kWh)")
print(f"Por alfajor: ${costo_luz_por_alf:.2f}")

conn = sqlite3.connect("alitos.db")
c = conn.cursor()

# Verificar si ya existe un insumo "Luz / Energía eléctrica"
c.execute("SELECT id FROM insumos WHERE nombre LIKE '%uz%' OR nombre LIKE '%energi%' OR nombre LIKE '%electr%'")
row = c.fetchone()

if not row:
    # Crear insumo virtual para energía eléctrica
    c.execute("""
        INSERT INTO insumos (nombre, unidad_medida, categoria, stock_minimo, activo, created_at, updated_at)
        VALUES ('Energia electrica (kWh)', 'kWh', 'servicios', 0, 1, ?, ?)
    """, (datetime.now().isoformat(), datetime.now().isoformat()))
    insumo_id = c.lastrowid
    print(f"Insumo creado: 'Energía eléctrica (kWh)' id={insumo_id}")
else:
    insumo_id = row[0]
    print(f"Insumo existente id={insumo_id}")

# Crear lote virtual para este insumo (precio = tarifa actual)
numero_lote = f"LUZ-COOP-{datetime.now().strftime('%Y%m')}"
c.execute("SELECT id FROM lotes_insumo WHERE numero_lote=?", (numero_lote,))
lote_row = c.fetchone()
if not lote_row:
    now = datetime.now().isoformat()
    c.execute("""
        INSERT INTO lotes_insumo (insumo_id, numero_lote, cantidad_inicial, cantidad_actual,
                                  costo_unitario, moneda, fecha_ingreso, activo, notas, created_at)
        VALUES (?, ?, 9999, 9999, ?, 'ARS', ?, 1, 'Tarifa estimada cooperativa residencial - ajustar con boleta', ?)
    """, (insumo_id, numero_lote, TARIFA_KWH, now, now))
    lote_id = c.lastrowid
    print(f"Lote creado: {numero_lote} id={lote_id} @ ${TARIFA_KWH}/kWh")
else:
    lote_id = lote_row[0]
    print(f"Lote existente id={lote_id}")

# Registrar en produccion_insumos para el armado (produccion_id=5)
c.execute("""
    INSERT INTO produccion_insumos (produccion_id, lote_insumo_id, cantidad_usada, costo_unitario)
    VALUES (5, ?, ?, ?)
""", (lote_id, round(kwh_total, 3), TARIFA_KWH))
print(f"ProduccionInsumo luz agregado: {kwh_total:.3f} kWh x ${TARIFA_KWH} = ${costo_luz_total:.2f}")

# Recalcular costo_total_insumos
c.execute("SELECT SUM(cantidad_usada * costo_unitario) FROM produccion_insumos WHERE produccion_id=5")
nuevo_total = c.fetchone()[0]
c.execute("UPDATE producciones SET costo_total_insumos=? WHERE id=5", (nuevo_total,))
nuevo_unitario = nuevo_total / ALFAJORES
c.execute("UPDATE lotes_producto_terminado SET costo_unitario_calculado=? WHERE produccion_id=5", (nuevo_unitario,))

print(f"\nCosto total insumos: ${nuevo_total:.2f}")
print(f"Costo por alfajor:   ${nuevo_unitario:.2f}")

conn.commit()
conn.close()
print("\nListo.")
