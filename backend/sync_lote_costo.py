import sqlite3
conn = sqlite3.connect("alitos.db")
c = conn.cursor()
c.execute("SELECT costo_total_insumos, cantidad_producida FROM producciones WHERE id=5")
row = c.fetchone()
costo = row[0] / row[1] if row[1] else 0
print(f"Produccion 5 costo_unitario: {costo:.4f}")
c.execute("SELECT id, numero_lote, costo_unitario_calculado FROM lotes_producto_terminado WHERE produccion_id=5")
rows = c.fetchall()
for r in rows:
    print(f"Lote id={r[0]} {r[1]}: {r[2]:.4f} -> {costo:.4f}")
    c.execute("UPDATE lotes_producto_terminado SET costo_unitario_calculado=? WHERE id=?", (costo, r[0]))
conn.commit()
conn.close()
print("OK: lote sincronizado")
