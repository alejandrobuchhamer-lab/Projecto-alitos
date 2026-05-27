from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.sensorial import PruebaSensorial
from app.models.producto import LoteProductoTerminado
from app.services.ia_service import generar_recomendacion_sensorial

router = APIRouter(prefix="/sensorial", tags=["sensorial"])
from app.templates import templates


class PruebaSensorialCreate(BaseModel):
    lote_producto_id: int | None = None
    receta_version_id: int | None = None
    evaluador: str
    dulzura: int | None = None
    acidez: int | None = None
    textura: int | None = None
    aroma: int | None = None
    sabor_general: int | None = None
    apariencia: int | None = None
    notas: str | None = None
    defectos_detectados: str | None = None
    aprobado: bool | None = None


@router.get("/", response_class=HTMLResponse)
def lista_sensorial_html(request: Request, db: Session = Depends(get_db)):
    pruebas = db.query(PruebaSensorial).order_by(PruebaSensorial.fecha.desc()).limit(50).all()
    lotes = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.activo == True).all()
    return templates.TemplateResponse("sensorial/lista.html", {
        "request": request, "pruebas": pruebas, "lotes": lotes
    })


@router.get("/api")
def listar_pruebas(db: Session = Depends(get_db)):
    pruebas = db.query(PruebaSensorial).order_by(PruebaSensorial.fecha.desc()).limit(100).all()
    return [{"id": p.id, "evaluador": p.evaluador, "fecha": p.fecha, "score_total": p.score_total,
             "aprobado": p.aprobado, "recomendacion_ia": p.recomendacion_ia,
             "lote_producto_id": p.lote_producto_id} for p in pruebas]


@router.post("/api", status_code=201)
def crear_prueba(data: PruebaSensorialCreate, db: Session = Depends(get_db)):
    prueba = PruebaSensorial(**data.model_dump())
    db.add(prueba)
    db.flush()
    prueba.recomendacion_ia = generar_recomendacion_sensorial(prueba)
    db.commit()
    db.refresh(prueba)
    return {
        "id": prueba.id,
        "score_total": prueba.score_total,
        "recomendacion_ia": prueba.recomendacion_ia,
        "aprobado": prueba.aprobado,
    }


@router.get("/api/{prueba_id}")
def obtener_prueba(prueba_id: int, db: Session = Depends(get_db)):
    p = db.query(PruebaSensorial).filter(PruebaSensorial.id == prueba_id).first()
    if not p:
        raise HTTPException(404, "Prueba no encontrada")
    return {"id": p.id, "evaluador": p.evaluador, "fecha": p.fecha, "score_total": p.score_total,
            "dulzura": p.dulzura, "acidez": p.acidez, "textura": p.textura, "aroma": p.aroma,
            "sabor_general": p.sabor_general, "apariencia": p.apariencia,
            "notas": p.notas, "recomendacion_ia": p.recomendacion_ia, "aprobado": p.aprobado}

