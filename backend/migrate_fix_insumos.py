"""Migración: lote_insumo_id en produccion_insumos debe ser nullable (NULL para tapas/producto terminado)."""
import sqlite3

conn = sqlite3.connect("alitos.db")
c = conn.cursor()

print("Datos existentes en produccion_insumos:")
c.execute("SELECT * FROM produccion_insumos")
for r in c.fetchall():
    print(" ", r)

print("\nCreando tabla nueva con lote_insumo_id nullable...")
c.execute("""
    CREATE TABLE produccion_insumos_new (
        id INTEGER NOT NULL PRIMARY KEY,
        produccion_id INTEGER NOT NULL,
        lote_insumo_id INTEGER,
        cantidad_usada FLOAT NOT NULL,
        costo_unitario FLOAT NOT NULL,
        lote_producto_id INTEGER,
        FOREIGN KEY(produccion_id) REFERENCES producciones(id),
        FOREIGN KEY(lote_insumo_id) REFERENCES lotes_insumo(id),
        FOREIGN KEY(lote_producto_id) REFERENCES lotes_producto_terminado(id)
    )
""")

c.execute("""
    INSERT INTO produccion_insumos_new (id, produccion_id, lote_insumo_id, cantidad_usada, costo_unitario, lote_producto_id)
    SELECT id, produccion_id, lote_insumo_id, cantidad_usada, costo_unitario, lote_producto_id
    FROM produccion_insumos
""")
print("Datos copiados.")

c.execute("DROP TABLE produccion_insumos")
c.execute("ALTER TABLE produccion_insumos_new RENAME TO produccion_insumos")

conn.commit()
print("\nMigración completada. Verificando:")
c.execute("PRAGMA table_info(produccion_insumos)")
for r in c.fetchall():
    print(" ", r)

conn.close()
print("\nListo — lote_insumo_id ahora es nullable.")
