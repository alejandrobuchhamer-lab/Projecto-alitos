from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.alerta import Alerta
from app.services.stock_service import verificar_alertas_stock
from datetime import datetime

router = APIRouter(prefix="/alertas", tags=["alertas"])
from app.templates import templates


@router.get("/", response_class=HTMLResponse)
def alertas_html(request: Request, db: Session = Depends(get_db)):
    alertas = db.query(Alerta).filter(Alerta.resuelta == False).order_by(
        Alerta.prioridad.asc(), Alerta.fecha_creacion.desc()
    ).all()
    return templates.TemplateResponse("alertas/lista.html", {"request": request, "alertas": alertas})


@router.get("/api")
def listar_alertas(db: Session = Depends(get_db)):
    alertas = db.query(Alerta).filter(Alerta.resuelta == False).order_by(
        Alerta.fecha_creacion.desc()
    ).all()
    return [{"id": a.id, "tipo": a.tipo, "mensaje": a.mensaje, "prioridad": a.prioridad,
             "modulo": a.modulo, "fecha_creacion": a.fecha_creacion} for a in alertas]


@router.post("/api/verificar")
def verificar(db: Session = Depends(get_db)):
    alertas = verificar_alertas_stock(db)
    db.commit()
    if alertas:
        try:
            from app.routers.push import enviar_push
            altas = [a for a in alertas if a.prioridad == "alta"]
            if altas:
                nombres = ", ".join(a.mensaje[:40] for a in altas[:3])
                enviar_push(db, None, {
                    "title": f"⚠ Stock bajo ({len(altas)} alerta{'s' if len(altas)>1 else ''})",
                    "body":  nombres,
                    "url":   "/alertas/",
                }, a_todos_admins=True)
        except Exception:
            pass
    return {"alertas_generadas": len(alertas)}


@router.post("/api/{alerta_id}/resolver")
def resolver_alerta(alerta_id: int, db: Session = Depends(get_db)):
    alerta = db.query(Alerta).filter(Alerta.id == alerta_id).first()
    if alerta:
        alerta.resuelta = True
        alerta.fecha_resolucion = datetime.utcnow()
        db.commit()
    return {"ok": True}
