import sqlite3
from datetime import datetime

conn = sqlite3.connect("alitos.db")
c = conn.cursor()

# Check existing
c.execute("SELECT id, nombre, unidad_medida FROM insumos WHERE lower(nombre) LIKE '%etiq%'")
etiq = c.fetchall()
print("Etiqueta insumos:", etiq)

c.execute("SELECT id, nombre, unidad_medida FROM insumos WHERE lower(nombre) LIKE '%envolt%'")
envolt = c.fetchall()
print("Envoltorio insumos:", envolt)

c.execute("SELECT id, nombre, unidad_medida FROM insumos ORDER BY id DESC LIMIT 10")
print("Ultimos insumos:", c.fetchall())

# If no etiqueta, create one
if not etiq:
    now = datetime.utcnow().isoformat()
    c.execute("""
        INSERT INTO insumos (nombre, descripcion, unidad_medida,
            categoria, stock_minimo, activo, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, ("Etiqueta (unidad)", "Etiqueta individual para alfajor, 41 por plancha",
          "unidad", "packaging", 200, 1, now, now))
    insumo_id = c.lastrowid
    print("Nuevo insumo etiqueta id:", insumo_id)

    # Create fictitious lot: 2000 units @ $40/unit = $80,000
    lote_num = "ETQ-FICTICIO-001"
    c.execute("""
        INSERT INTO lotes_insumo (insumo_id, numero_lote, proveedor, cantidad_inicial,
            cantidad_actual, costo_unitario, moneda, activo, fecha_ingreso, notas, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (insumo_id, lote_num, "Stock inicial ficticio", 2000, 2000, 40.0, "ARS", 1, now, "2000 etiquetas @ $40/u = $80.000 — stock ficticio inicial", now))
    print("Lote ficticio ETQ-FICTICIO-001 creado: 2000 unidades @ $40 = $80,000")
else:
    # etiqueta exists, check lotes
    insumo_id = etiq[0][0]
    c.execute("SELECT id, numero_lote, cantidad_actual, costo_unitario FROM lotes_insumo WHERE insumo_id=?", (insumo_id,))
    print("Lotes etiqueta:", c.fetchall())

conn.commit()
conn.close()
print("Done.")
