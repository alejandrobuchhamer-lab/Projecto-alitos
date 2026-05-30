"""
Corrección de costos para producción de armado:
- Las tapas tienen costo $0 porque la prod de tapas no registró costo de masa
- Se corrige usando el costo calculado desde la masa (confirmado por el desglose: $86.2211/tapa)
"""
import sqlite3

conn = sqlite3.connect("alitos.db")
c = conn.cursor()

# 1. Calcular costo real por tapa desde los insumos de la producción de MASA (id=3)
c.execute("""
    SELECT SUM(cantidad_usada * costo_unitario)
    FROM produccion_insumos
    WHERE produccion_id = 3
""")
costo_masa_total = c.fetchone()[0] or 0
print(f"Costo total masa: ${costo_masa_total:.4f}")

c.execute("SELECT tapas_reales FROM producciones WHERE id=4")
tapas_reales = c.fetchone()[0] or 380
print(f"Tapas reales: {tapas_reales}")

costo_por_tapa = costo_masa_total / tapas_reales
print(f"Costo por tapa cocida: ${costo_por_tapa:.4f}")

# 2. Actualizar el lote de tapas con el costo correcto
c.execute("UPDATE lotes_producto_terminado SET costo_unitario_calculado=? WHERE id=4", (costo_por_tapa,))
print(f"\nLote tapas (id=4) actualizado: costo_unitario_calculado = ${costo_por_tapa:.4f}")

# 3. Actualizar el ProduccionInsumo del armado para tapas (record 34)
tapas_usadas = 160.0
costo_tapas_armado = tapas_usadas * costo_por_tapa
c.execute("""
    UPDATE produccion_insumos
    SET costo_unitario = ?
    WHERE id = 34
""", (costo_por_tapa,))
print(f"ProduccionInsumo tapas (id=34) actualizado: costo_unitario = ${costo_por_tapa:.4f}")
print(f"Subtotal tapas en armado: ${costo_tapas_armado:.2f}")

# 4. Recalcular costo_total_insumos para el armado (produccion id=5)
c.execute("""
    SELECT SUM(cantidad_usada * costo_unitario)
    FROM produccion_insumos
    WHERE produccion_id = 5
""")
nuevo_total = c.fetchone()[0] or 0
print(f"\nNuevo costo_total_insumos armado: ${nuevo_total:.2f}")

c.execute("UPDATE producciones SET costo_total_insumos=? WHERE id=5", (nuevo_total,))
print(f"Produccion 5 actualizada: costo_total_insumos = ${nuevo_total:.2f}")

costo_unitario_real = nuevo_total / 80
print(f"Costo unitario real: ${costo_unitario_real:.2f}/alfajor")

# 5. También actualizar la produccion de tapas con su costo
c.execute("UPDATE producciones SET costo_total_insumos=? WHERE id=4", (costo_masa_total,))
print(f"\nProduccion tapas (id=4) actualizada: costo_total_insumos = ${costo_masa_total:.2f}")

conn.commit()
conn.close()
print("\nCorrecciones aplicadas correctamente.")
