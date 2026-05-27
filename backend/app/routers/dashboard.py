from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.dashboard_service import get_kpis_dashboard

router = APIRouter(tags=["dashboard"])
from app.templates import templates


@router.get("/", response_class=HTMLResponse)
def dashboard_html(request: Request, db: Session = Depends(get_db)):
    kpis = get_kpis_dashboard(db)
    return templates.TemplateResponse("dashboard.html", {"request": request, "kpis": kpis})


@router.get("/api/dashboard/kpis")
def dashboard_kpis(db: Session = Depends(get_db)):
    return get_kpis_dashboard(db)

