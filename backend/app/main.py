from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, FileResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.database import init_db
from app.routers import dashboard, insumos, recetas, produccion, productos, clientes, ventas, sensorial, ia, alertas, finanzas, stock
from app.routers import auth as auth_router, admin as admin_router
from app.routers import mobile_auth as mobile_auth_router
from app.routers import pos as pos_router
from app.routers import cuenta as cuenta_router
from app.routers import vendedores as vendedores_router
from app.routers import cuentas as cuentas_router
from app.routers import push as push_router
from app.services.auth_service import verify_session_token

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

_PUBLIC = ("/auth/", "/static/", "/health", "/favicon", "/pos/", "/sw.js", "/manifest.json")
_API_MARKER = "/api"

# Acciones que se auditan automáticamente
_AUDIT_METHODS = {"DELETE", "POST", "PATCH", "PUT"}
_AUDIT_PATHS = ("/ventas/", "/produccion/", "/insumos/", "/clientes/", "/admin/")


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        token = request.cookies.get("session")
        request.state.user = None

        if token:
            user_id = verify_session_token(token)
            if user_id:
                from app.database import SessionLocal
                from app.models.usuario import Usuario
                db = SessionLocal()
                try:
                    request.state.user = db.query(Usuario).filter(
                        Usuario.id == user_id, Usuario.activo == True
                    ).first()
                finally:
                    db.close()

        # Bearer token para la app móvil React (Authorization: Bearer <jwt>)
        if request.state.user is None:
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer "):
                from app.routers.mobile_auth import verificar_token
                from app.database import SessionLocal
                from app.models.usuario import Usuario
                payload = verificar_token(auth_header.split(" ", 1)[1])
                if payload:
                    db = SessionLocal()
                    try:
                        request.state.user = db.query(Usuario).filter(
                            Usuario.id == int(payload["sub"]), Usuario.activo == True
                        ).first()
                    finally:
                        db.close()

        if any(path.startswith(p) for p in _PUBLIC) or _API_MARKER in path:
            return await call_next(request)
        if not token or request.state.user is None:
            return RedirectResponse("/auth/login")
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Agrega headers de seguridad HTTP a todas las respuestas."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        # En producción Railway, HSTS se maneja a nivel proxy
        return response


class AuditMiddleware(BaseHTTPMiddleware):
    """Registra automáticamente operaciones críticas."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        try:
            if (request.method in _AUDIT_METHODS
                    and any(request.url.path.startswith(p) for p in _AUDIT_PATHS)
                    and response.status_code < 400):
                from app.security import audit_log
                user = getattr(request.state, "user", None)
                forwarded = request.headers.get("X-Forwarded-For", "")
                ip = forwarded.split(",")[0].strip() if forwarded else (
                    request.client.host if request.client else "unknown"
                )
                audit_log(
                    action=f"{request.method} {request.url.path}",
                    user_id=user.id if user else None,
                    username=user.username if user else None,
                    resource=request.url.path.split("/")[1],
                    ip=ip,
                )
        except Exception:
            pass
        return response


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Sistema Operativo Empresarial — ALITOS Alfajores Premium",
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(AuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_static_dir = PROJECT_ROOT / "frontend" / "static"
if _static_dir.is_dir():
    app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")

app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(mobile_auth_router.router)
app.include_router(dashboard.router)
app.include_router(insumos.router)
app.include_router(recetas.router)
app.include_router(produccion.router)
app.include_router(productos.router)
app.include_router(clientes.router)
app.include_router(ventas.router)
app.include_router(sensorial.router)
app.include_router(ia.router)
app.include_router(alertas.router)
app.include_router(finanzas.router)
app.include_router(stock.router)
app.include_router(pos_router.router)
app.include_router(cuenta_router.router)
app.include_router(vendedores_router.router)
app.include_router(cuentas_router.router)
app.include_router(push_router.router)


@app.get("/sw.js", include_in_schema=False)
def serve_sw():
    path = PROJECT_ROOT / "frontend" / "static" / "sw.js"
    return FileResponse(str(path), media_type="application/javascript")


@app.get("/manifest.json", include_in_schema=False)
def serve_manifest():
    path = PROJECT_ROOT / "frontend" / "static" / "manifest.json"
    return FileResponse(str(path), media_type="application/manifest+json")


@app.on_event("startup")
def on_startup():
    # Run init_db in background thread so /health responds immediately
    # (avoids DB lock conflicts during Railway blue-green deployments)
    import threading
    threading.Thread(target=init_db, daemon=True).start()


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name, "version": settings.app_version}
