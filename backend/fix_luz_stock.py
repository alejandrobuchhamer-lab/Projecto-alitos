import sqlite3
conn = sqlite3.connect("alitos.db")
c = conn.cursor()

# Poner cantidad_actual = 0 en el lote de luz (no es stock físico)
c.execute("UPDATE lotes_insumo SET cantidad_actual=0, cantidad_inicial=0 WHERE numero_lote='LUZ-COOP-202605'")
print("Lote LUZ-COOP-202605: stock puesto a 0 (no es inventario físico)")

# Marcar el insumo como no visible en stock (activo=0 para que no aparezca en capital)
c.execute("UPDATE insumos SET activo=0 WHERE nombre='Energia electrica (kWh)'")
print("Insumo 'Energia electrica (kWh)' marcado inactivo (oculto en capital inmovilizado)")

# El ProduccionInsumo record queda intacto — sigue sumando al costo del armado
c.execute("SELECT id, cantidad_usada, costo_unitario FROM produccion_insumos WHERE produccion_id=5 AND lote_insumo_id=(SELECT id FROM lotes_insumo WHERE numero_lote='LUZ-COOP-202605')")
pi = c.fetchone()
if pi:
    print(f"ProduccionInsumo id={pi[0]}: {pi[1]} kWh x ${pi[2]} = ${pi[1]*pi[2]:.2f} (sigue en desglose del armado)")

conn.commit()
conn.close()
print("\nListo — electricidad ya no aparece en capital inmovilizado.")
