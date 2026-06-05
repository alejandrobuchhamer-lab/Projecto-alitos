# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos esenciales

```bash
# Arrancar el servidor de desarrollo
cd backend && python run.py
# → http://localhost:8000  (admin / alitos2025)

# Python path
C:\Users\PC\AppData\Local\Programs\Python\Python314\python.exe

# Health check
GET http://localhost:8000/health
```

No hay sistema de tests ni linter configurado.

## Arquitectura

Monolito FastAPI + SQLite + Jinja2 + vanilla JS. Sin frontend framework separado.

```
backend/
  app/
    main.py          ← middlewares (Auth, Audit, SecurityHeaders) + registro de routers
    database.py      ← SQLAlchemy engine, init_db(), migraciones inline en _run_migrations()
    config.py        ← Settings via pydantic-settings (.env opcional)
    templates.py     ← ÚNICO punto de acceso a Jinja2 — SIEMPRE importar desde aquí
    security.py      ← rate limiting, CSRF, audit_log
    routers/         ← un archivo por módulo (insumos, produccion, ventas, etc.)
    services/        ← lógica de negocio (produccion_service, stock_service, etc.)
    models/          ← SQLAlchemy ORM
    schemas/         ← Pydantic schemas para API
frontend/
  templates/         ← Jinja2 HTML (base.html + subcarpetas por módulo)
  static/            ← CSS, JS, imágenes
```

## Reglas críticas

**Templates:** Siempre usar `from app.templates import templates` — NUNCA instanciar `Jinja2Templates` propio. El wrapper en `app/templates.py` evita un bug de cache de Starlette con Python 3.14. Usar `Jinja2Templates` directamente causa errores 500.

**Migraciones:** No hay Alembic. Los cambios de schema se agregan como `ALTER TABLE` en la lista `migrations` de `database.py:_run_migrations()`. Son idempotentes (errores ignorados silenciosamente).

**Auth:** Sesión por cookie `session` (JWT). El `AuthMiddleware` en `main.py` inyecta `request.state.user`. Las rutas bajo `/auth/`, `/static/`, `/health`, `/favicon`, `/pos/` son públicas. Las rutas API (`/api` en el path) también pasan sin auth.

**Stock FEFO:** `stock_service.consumir_stock_fefo()` y `consumir_stock_producto_fefo()` manejan el consumo por lote más antiguo primero. Toda operación que consume insumos o productos terminados debe pasar por estas funciones.

**Tipos de producción:** `tipo_produccion` en `Produccion` puede ser `"masa"`, `"tapas"`, o `"armado"`. El flujo es masa → tapas → armado (alfajores).

**Tipos de lote producto terminado:** `LoteProductoTerminado.tipo` puede ser `"masa"`, `"tapas"`, o `"alfajor"`. El stock de ventas filtra solo `tipo="alfajor"`.

## Módulos principales

| Ruta | Router | Descripción |
|------|--------|-------------|
| `/insumos/` | `routers/insumos.py` | CRUD insumos, lotes FEFO, ingreso masivo, bultos |
| `/recetas/` | `routers/recetas.py` | Recetas versionadas con ingredientes (insumo o producto terminado) |
| `/produccion/` | `routers/produccion.py` | Masa → Tapas → Armado alfajores |
| `/ventas/` | `routers/ventas.py` | Ventas con margen en tiempo real, cobrar |
| `/productos/` | `routers/productos.py` | Stock de productos terminados (alfajores) |
| `/stock/` | `routers/stock.py` | Conteo físico, ajustes de stock |
| `/dashboard/` | `routers/dashboard.py` | KPIs, gráficos |
| `/alertas/` | `routers/alertas.py` | Alertas de stock bajo |
| `/finanzas/` | `routers/finanzas.py` | Gastos, capital |
| `/pos/` | `routers/pos.py` | PWA punto de venta móvil (no requiere auth) |
| `/ia/` | `routers/ia.py` | Chat IA (Anthropic API opcional) |

## Deploy

Railway: `nixpacks` con root en `backend/`. DB SQLite en el filesystem (no persiste entre deploys — pendiente migrar a PostgreSQL). El `database.py` normaliza automáticamente URLs `postgres://` → `postgresql://`.
