import sqlite3
conn = sqlite3.connect("alitos.db")
c = conn.cursor()

c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
print("ALL TABLES:", [r[0] for r in c.fetchall()])

c.execute("PRAGMA table_info(produccion_insumos)")
print("produccion_insumos:", [r[1] for r in c.fetchall()])

# Find lotes_producto table
c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%lote%'")
print("lote tables:", c.fetchall())

c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%product%'")
print("product tables:", c.fetchall())

# Check which model file is being used
import os
for root, dirs, files in os.walk("app/models"):
    for f in files:
        print(os.path.join(root, f))

conn.close()
