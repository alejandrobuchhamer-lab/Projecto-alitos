import sqlite3
conn = sqlite3.connect("alitos.db")
c = conn.cursor()
c.execute("SELECT id, nombre, unidad_medida, categoria FROM insumos WHERE categoria='packaging' OR nombre LIKE '%envoltor%' OR nombre LIKE '%etiqueta%'")
rows = c.fetchall()
print("Insumos packaging:")
for r in rows:
    print(f"  id={r[0]} | {r[1]} | {r[2]} | cat={r[3]}")
    c.execute("SELECT id, numero_lote, cantidad_actual, costo_unitario FROM lotes_insumo WHERE insumo_id=? AND activo=1", (r[0],))
    lotes = c.fetchall()
    if lotes:
        for l in lotes:
            print(f"    lote: {l[1]} | stock={l[2]} | costo=${l[3]}/u")
    else:
        print("    sin lotes registrados")
conn.close()
