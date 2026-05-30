import sqlite3

conn = sqlite3.connect("alitos.db")
c = conn.cursor()

# 1. Actualizar costo real de los lotes de packaging
c.execute("UPDATE lotes_insumo SET costo_unitario=30 WHERE numero_lote='ENV-FICTICIO-001'")
c.execute("UPDATE lotes_insumo SET costo_unitario=62 WHERE numero_lote='ETQ-FICTICIO-001'")
print("Lotes packaging actualizados: envoltorio=$30/u, etiqueta=$62/u")

# 2. Obtener lote ids
c.execute("SELECT id FROM lotes_insumo WHERE numero_lote='ENV-FICTICIO-001'")
lote_env_id = c.fetchone()[0]
c.execute("SELECT id FROM lotes_insumo WHERE numero_lote='ETQ-FICTICIO-001'")
lote_etq_id = c.fetchone()[0]
print(f"Lote envoltorio id={lote_env_id}, lote etiqueta id={lote_etq_id}")

# 3. Agregar ProduccionInsumo para envoltorio (80 unidades)
c.execute("""
    INSERT INTO produccion_insumos (produccion_id, lote_insumo_id, cantidad_usada, costo_unitario)
    VALUES (5, ?, 80, 30)
""", (lote_env_id,))
print("ProduccionInsumo envoltorio agregado: 80u × $30 = $2,400")

# 4. Agregar ProduccionInsumo para etiqueta (80 unidades)
c.execute("""
    INSERT INTO produccion_insumos (produccion_id, lote_insumo_id, cantidad_usada, costo_unitario)
    VALUES (5, ?, 80, 62)
""", (lote_etq_id,))
print("ProduccionInsumo etiqueta agregado: 80u × $62 = $4,960")

# 5. Descontar stock de lotes
c.execute("UPDATE lotes_insumo SET cantidad_actual = cantidad_actual - 80 WHERE id=?", (lote_env_id,))
c.execute("UPDATE lotes_insumo SET cantidad_actual = cantidad_actual - 80 WHERE id=?", (lote_etq_id,))
print("Stock descontado: -80 envoltorios, -80 etiquetas")

# 6. Recalcular costo_total_insumos para produccion 5
c.execute("SELECT SUM(cantidad_usada * costo_unitario) FROM produccion_insumos WHERE produccion_id=5")
nuevo_total = c.fetchone()[0]
print(f"\nNuevo costo_total_insumos: ${nuevo_total:.2f}")

c.execute("UPDATE producciones SET costo_total_insumos=? WHERE id=5", (nuevo_total,))

# 7. Actualizar lote alfajor
costo_unitario = nuevo_total / 80
c.execute("UPDATE lotes_producto_terminado SET costo_unitario_calculado=? WHERE produccion_id=5", (costo_unitario,))
print(f"Costo por alfajor: ${costo_unitario:.2f}")

conn.commit()
conn.close()
print("\nListo — costos de packaging registrados y totales actualizados.")
