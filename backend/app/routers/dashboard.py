from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.dashboard_service import (
    get_kpis_dashboard,
    get_tab_ventas,
    get_tab_produccion,
    get_tab_insumos,
    get_tab_progreso,
)

router = APIRouter(tags=["dashboard"])
from app.templates import templates


@router.get("/", response_class=HTMLResponse)
def dashboard_html(request: Request, db: Session = Depends(get_db)):
    kpis = get_kpis_dashboard(db)
    return templates.TemplateResponse("dashboard.html", {"request": request, "kpis": kpis})


@router.get("/dashboard/")
def dashboard_redirect():
    return RedirectResponse("/", status_code=301)


@router.get("/api/dashboard/kpis")
def dashboard_kpis(db: Session = Depends(get_db)):
    return get_kpis_dashboard(db)


@router.get("/api/dashboard/tab/ventas")
def dashboard_tab_ventas(db: Session = Depends(get_db)):
    return get_tab_ventas(db)


@router.get("/api/dashboard/tab/produccion")
def dashboard_tab_produccion(db: Session = Depends(get_db)):
    return get_tab_produccion(db)


@router.get("/api/dashboard/tab/insumos")
def dashboard_tab_insumos(db: Session = Depends(get_db)):
    return get_tab_insumos(db)


@router.get("/api/dashboard/tab/progreso")
def dashboard_tab_progreso(db: Session = Depends(get_db)):
    return get_tab_progreso(db)

