#!/usr/bin/env python3
"""Migra todos los datos de SQLite local → PostgreSQL Railway. Borrar después de usar."""
import sqlite3
import sys
from pathlib import Path

PG_URL = "postgresql://postgres:LRDSbgFgsLNQOLXGYcvXdhQaEFiGaNkE@maglev.proxy.rlwy.net:47837/railway"
SQLITE_PATH = Path(__file__).parent / "backend" / "alitos.db"

TABLE_ORDER = [
    "usuarios", "hornos", "insumos", "ordenes_compra", "lotes_insumo",
    "productos", "recetas", "receta_versiones", "receta_ingredientes",
    "clientes", "producciones", "lotes_producto_terminado",
    "produccion_insumos", "produccion_tachos", "registros_tapas",
    "ventas", "venta_items", "pedido_reservas", "gastos",
    "configuraciones", "conversaciones_ia", "ajustes_stock",
]

def get_bool_columns(cur, table):
    """Devuelve set de columnas boolean en PostgreSQL."""
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=%s AND data_type='boolean'
    """, (table,))
    return {r[0] for r in cur.fetchall()}

def migrate():
    try:
        import psycopg2
    except ImportError:
        print("Instalando psycopg2...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary"])
        import psycopg2

    if not SQLITE_PATH.exists():
        print(f"No encontre la base SQLite en: {SQLITE_PATH}")
        sys.exit(1)

    print(f"SQLite: {SQLITE_PATH}")
    print(f"PostgreSQL: maglev.proxy.rlwy.net:47837/railway")
    print()

    src = sqlite3.connect(str(SQLITE_PATH))
    src.row_factory = sqlite3.Row

    all_tables = [r[0] for r in src.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()]

    ordered = [t for t in TABLE_ORDER if t in all_tables]
    rest = [t for t in all_tables if t not in TABLE_ORDER]
    tables = ordered + rest

    print(f"Tablas a migrar: {tables}\n")

    dst = psycopg2.connect(PG_URL)
    dst.autocommit = False

    try:
        with dst.cursor() as cur:
            cur.execute("SET session_replication_role = replica;")

            for table in tables:
                try:
                    rows = src.execute(f'SELECT * FROM "{table}"').fetchall()
                except Exception as e:
                    print(f"  SKIP {table}: {e}")
                    continue

                if not rows:
                    print(f"  -- {table}: vacia")
                    continue

                cols = list(rows[0].keys())
                cols_pg = ", ".join(f'"{c}"' for c in cols)
                placeholders = ", ".join(["%s"] * len(cols))

                try:
                    bool_cols = get_bool_columns(cur, table)
                    cur.execute(f'DELETE FROM "{table}"')
                    def conv(val, col):
                        if col in bool_cols and val is not None:
                            return bool(val)
                        return val
                    data = [tuple(conv(row[c], c) for c in cols) for row in rows]
                    cur.executemany(
                        f'INSERT INTO "{table}" ({cols_pg}) VALUES ({placeholders})',
                        data
                    )
                    print(f"  OK {table}: {len(data)} registros")
                except Exception as e:
                    print(f"  ERROR {table}: {e}")
                    dst.rollback()
                    cur.execute("SET session_replication_role = replica;")

            # Resetear secuencias para que el autoincrement siga bien
            cur.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public'
            """)
            pg_tables = [r[0] for r in cur.fetchall()]
            for t in pg_tables:
                try:
                    cur.execute(f"""
                        SELECT setval(
                            pg_get_serial_sequence('"{t}"', 'id'),
                            COALESCE((SELECT MAX(id) FROM "{t}"), 1)
                        )
                    """)
                except Exception:
                    pass

            cur.execute("SET session_replication_role = DEFAULT;")
            dst.commit()
            print("\nMigracion completada. Todos tus datos estan en Railway.")

    except Exception as e:
        dst.rollback()
        print(f"Error general: {e}")
        import traceback; traceback.print_exc()
        sys.exit(1)
    finally:
        src.close()
        dst.close()

if __name__ == "__main__":
    migrate()
