from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.receta import RecetaVersion, RecetaIngrediente
from app.models.producto import ProductoTerminado
from app.schemas.receta import RecetaVersionCreate, RecetaVersionOut, RecetaIngredienteOut

router = APIRouter(prefix="/recetas", tags=["recetas"])
from app.templates import templates


@router.get("/", response_class=HTMLResponse)
def lista_recetas_html(request: Request, db: Session = Depends(get_db)):
    recetas = db.query(RecetaVersion).filter(RecetaVersion.activo == True).order_by(RecetaVersion.nombre).all()
    productos = db.query(ProductoTerminado).filter(ProductoTerminado.activo == True).all()
    return templates.TemplateResponse("recetas/lista.html", {"request": request, "recetas": recetas, "productos": productos})


@router.get("/api", response_model=list[RecetaVersionOut])
def listar_recetas(db: Session = Depends(get_db)):
    return db.query(RecetaVersion).filter(RecetaVersion.activo == True).all()


@router.post("/api", response_model=RecetaVersionOut, status_code=201)
def crear_receta(data: RecetaVersionCreate, db: Session = Depends(get_db)):
    producto = db.query(ProductoTerminado).filter(ProductoTerminado.id == data.producto_id).first()
    if not producto:
        raise HTTPException(404, "Producto no encontrado")

    ultima = db.query(RecetaVersion).filter(
        RecetaVersion.producto_id == data.producto_id
    ).order_by(RecetaVersion.version.desc()).first()
    nueva_version = (ultima.version + 1) if ultima else 1

    if ultima and ultima.activo:
        ultima.activo = False

    ingredientes_data = data.ingredientes
    receta_dict = data.model_dump(exclude={"ingredientes"})
    receta = RecetaVersion(**receta_dict, version=nueva_version)
    db.add(receta)
    db.flush()

    for ing_data in ingredientes_data:
        ing = RecetaIngrediente(receta_version_id=receta.id, **ing_data.model_dump())
        db.add(ing)

    db.commit()
    db.refresh(receta)
    return receta


@router.get("/api/{receta_id}", response_model=RecetaVersionOut)
def obtener_receta(receta_id: int, db: Session = Depends(get_db)):
    receta = db.query(RecetaVersion).filter(RecetaVersion.id == receta_id).first()
    if not receta:
        raise HTTPException(404, "Receta no encontrada")
    return receta


@router.put("/api/{receta_id}", response_model=RecetaVersionOut, status_code=201)
def editar_receta_nueva_version(receta_id: int, data: RecetaVersionCreate, db: Session = Depends(get_db)):
    """Crear una nueva versión de la receta (la anterior queda desactivada)."""
    receta_actual = db.query(RecetaVersion).filter(RecetaVersion.id == receta_id).first()
    if not receta_actual:
        raise HTTPException(404, "Receta no encontrada")

    producto_id = receta_actual.producto_id
    ultima = db.query(RecetaVersion).filter(
        RecetaVersion.producto_id == producto_id, RecetaVersion.activo == True
    ).order_by(RecetaVersion.version.desc()).first()
    nueva_version = (ultima.version + 1) if ultima else 1
    if ultima:
        ultima.activo = False

    ingredientes_data = data.ingredientes
    receta_dict = data.model_dump(exclude={"ingredientes"})
    receta_dict["producto_id"] = producto_id
    nueva = RecetaVersion(**receta_dict, version=nueva_version)
    db.add(nueva)
    db.flush()
    for ing_data in ingredientes_data:
        ing = RecetaIngrediente(receta_version_id=nueva.id, **ing_data.model_dump())
        db.add(ing)
    db.commit()
    db.refresh(nueva)
    return nueva


@router.delete("/api/{receta_id}")
def desactivar_receta(receta_id: int, db: Session = Depends(get_db)):
    receta = db.query(RecetaVersion).filter(RecetaVersion.id == receta_id).first()
    if not receta:
        raise HTTPException(404, "Receta no encontrada")
    receta.activo = False
    db.commit()
    return {"ok": True}


@router.get("/api/{receta_id}/ficha-tecnica")
def ficha_tecnica(receta_id: int, cantidad_objetivo: float = 1.0, db: Session = Depends(get_db)):
    """
    Ficha técnica: ingredientes escalados a cantidad_objetivo unidades,
    costo estimado por unidad y total.
    """
    receta = db.query(RecetaVersion).filter(RecetaVersion.id == receta_id).first()
    if not receta:
        raise HTTPException(404, "Receta no encontrada")

    factor = cantidad_objetivo / receta.rendimiento_esperado if receta.rendimiento_esperado > 0 else 1.0

    ingredientes = []
    costo_total = 0.0
    for ing in receta.ingredientes:
        cantidad_escalada = ing.cantidad * factor

        if ing.tipo_ingrediente == "producto_terminado":
            from app.models.producto import ProductoTerminado
            pt = db.query(ProductoTerminado).filter(ProductoTerminado.id == ing.producto_terminado_id).first()
            nombre = pt.nombre if pt else f"Producto #{ing.producto_terminado_id}"
            ultimo_lote = sorted(pt.lotes, key=lambda l: l.fecha_produccion, reverse=True)[0] if pt and pt.lotes else None
            costo_unit = ultimo_lote.costo_unitario_calculado if ultimo_lote else 0.0
            tipo_label = "Producto"
        else:
            nombre = ing.insumo.nombre if ing.insumo else "?"
            ultimo_lote = sorted(ing.insumo.lotes, key=lambda l: l.fecha_ingreso, reverse=True)[0] if ing.insumo and ing.insumo.lotes else None
            costo_unit = ultimo_lote.costo_unitario if ultimo_lote else 0.0
            tipo_label = "Insumo"

        costo_ing = cantidad_escalada * costo_unit
        ingredientes.append({
            "nombre": nombre,
            "tipo": tipo_label,
            "cantidad_receta": ing.cantidad,
            "cantidad_objetivo": round(cantidad_escalada, 3),
            "unidad": ing.unidad_medida,
            "costo_unitario": costo_unit,
            "costo_total_ingrediente": round(costo_ing, 2),
            "es_critico": ing.es_critico,
        })
        costo_total += costo_ing

    return {
        "receta_nombre": receta.nombre,
        "receta_version": receta.version,
        "producto": receta.producto.nombre,
        "rendimiento_base": receta.rendimiento_esperado,
        "unidad_rendimiento": receta.unidad_rendimiento,
        "cantidad_objetivo": cantidad_objetivo,
        "factor_escala": round(factor, 4),
        "ingredientes": ingredientes,
        "costo_total_estimado": round(costo_total, 2),
        "costo_por_unidad": round(costo_total / cantidad_objetivo if cantidad_objetivo > 0 else 0, 4),
        # Ficha del alfajor
        "peso_tapa_objetivo_g": receta.peso_tapa_objetivo_g,
        "tapas_por_alfajor": receta.tapas_por_alfajor,
        "peso_relleno_objetivo_g": receta.peso_relleno_objetivo_g,
        "peso_bano_objetivo_g": receta.peso_bano_objetivo_g,
        "peso_alfajor_objetivo_g": receta.peso_alfajor_objetivo_g,
    }

