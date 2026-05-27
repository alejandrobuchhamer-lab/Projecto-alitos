from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.cliente import Cliente
from app.schemas.cliente import ClienteCreate, ClienteUpdate, ClienteOut
from app.templates import templates

router = APIRouter(prefix="/clientes", tags=["clientes"])


@router.get("/", response_class=HTMLResponse)
def lista_clientes_html(request: Request, db: Session = Depends(get_db)):
    clientes = db.query(Cliente).filter(Cliente.activo == True).order_by(Cliente.nombre).all()
    return templates.TemplateResponse("clientes/lista.html", {"request": request, "clientes": clientes})


@router.get("/api", response_model=list[ClienteOut])
def listar_clientes(db: Session = Depends(get_db)):
    return [ClienteOut.model_validate(c) for c in db.query(Cliente).filter(Cliente.activo == True).order_by(Cliente.nombre).all()]


@router.post("/api", response_model=ClienteOut, status_code=201)
def crear_cliente(data: ClienteCreate, db: Session = Depends(get_db)):
    cliente = Cliente(**data.model_dump())
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return ClienteOut.model_validate(cliente)


@router.get("/api/{cliente_id}", response_model=ClienteOut)
def obtener_cliente(cliente_id: int, db: Session = Depends(get_db)):
    c = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    return ClienteOut.model_validate(c)


@router.put("/api/{cliente_id}", response_model=ClienteOut)
def actualizar_cliente(cliente_id: int, data: ClienteUpdate, db: Session = Depends(get_db)):
    c = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return ClienteOut.model_validate(c)


@router.delete("/api/{cliente_id}")
def eliminar_cliente(cliente_id: int, db: Session = Depends(get_db)):
    c = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not c:
        raise HTTPException(404, "Cliente no encontrado")
    c.activo = False
    db.commit()
    return {"ok": True}
