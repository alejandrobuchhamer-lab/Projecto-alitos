from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.database import init_db
from app.routers import dashboard, insumos, recetas, produccion, productos, clientes, ventas, sensorial, ia, alertas, finanzas, stock
from app.routers import auth as auth_router, admin as admin_router
from app.routers import mobile_auth as mobile_auth_router
from app.routers import pos as pos_router
from app.services.auth_service import verify_session_token

PROJECT_ROOT = Path(__file__).parent.parent.parent

# Paths that don't need auth (starts-with check)
_PUBLIC = ("/auth/", "/static/", "/health", "/favicon", "/pos/")
# API paths are open for the mobile app
_API_MARKER = "/api"


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        # Attach user to request.state for all routes
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

        if any(path.startswith(p) for p in _PUBLIC) or _API_MARKER in path:
            return await call_next(request)
        if not token or request.state.user is None:
            return RedirectResponse("/auth/login")
        return await call_next(request)


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Sistema Operativo Empresarial — ALITOS Alfajores Premium",
)

app.add_middleware(AuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(PROJECT_ROOT / "frontend" / "static")), name="static")

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


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name, "version": settings.app_version}
