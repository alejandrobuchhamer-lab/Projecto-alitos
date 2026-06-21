from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.produccion import Produccion, ProduccionInsumo, ProduccionTacho, Horno, ConfiguracionProduccion
from app.models.registro_tapas import RegistroTapas
from app.models.receta import RecetaVersion
from app.models.insumo import LoteInsumo, Insumo
from app.models.producto import LoteProductoTerminado, ProductoTerminado
from app.schemas.produccion import ProduccionCreate, ProduccionOut, ProduccionFinalizar, ProduccionTapaUpdate
from app.services.produccion_service import iniciar_produccion, finalizar_produccion, finalizar_armado
from app.routers.auth import permiso
from app.models.usuario import Usuario

router = APIRouter(prefix="/produccion", tags=["produccion"])
from app.templates import templates


@router.get("/", response_class=HTMLResponse)
def lista_produccion_html(request: Request, db: Session = Depends(get_db), _u: Usuario = Depends(permiso("produccion"))):
    from sqlalchemy.orm import joinedload
    producciones = (
        db.query(Produccion)
        .options(
            joinedload(Produccion.receta_version).joinedload(RecetaVersion.producto),
        )
        .order_by(Produccion.fecha_inicio.desc())
        .limit(100)
        .all()
    )
    recetas = db.query(RecetaVersion).filter(RecetaVersion.activo == True).all()
    lotes_masa = db.query(LoteProductoTerminado).filter(
        LoteProductoTerminado.tipo == "masa",
        LoteProductoTerminado.activo == True,
        LoteProductoTerminado.cantidad_actual > 0,
    ).order_by(LoteProductoTerminado.fecha_produccion.desc()).all()
    prod_masa = [p for p in producciones if p.tipo_produccion == "masa"]
    prod_tapas = [p for p in producciones if p.tipo_produccion == "tapas"]
    prod_armado = [p for p in producciones if p.tipo_produccion in ("armado", "general")]

    # Pre-fetch todos los lotes origen de una sola query
    lote_ids = {p.lote_origen_id for p in producciones if p.lote_origen_id}
    if lote_ids:
        lotes_map = {
            l.id: l for l in db.query(LoteProductoTerminado)
            .options(joinedload(LoteProductoTerminado.produccion))
            .filter(LoteProductoTerminado.id.in_(lote_ids))
            .all()
        }
        lote_ids2 = {l.produccion.lote_origen_id for l in lotes_map.values() if l.produccion and l.produccion.lote_origen_id}
        if lote_ids2:
            lotes_map.update({l.id: l for l in db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id.in_(lote_ids2)).all()})
    else:
        lotes_map = {}

    tapas_extras = {}
    for p in prod_tapas:
        tapas_extras[p.id] = {"lote_masa": lotes_map.get(p.lote_origen_id) if p.lote_origen_id else None}

    armado_extras = {}
    for p in prod_armado:
        lote_tapas = lotes_map.get(p.lote_origen_id) if p.lote_origen_id else None
        lote_masa = None
        if lote_tapas and lote_tapas.produccion and lote_tapas.produccion.lote_origen_id:
            lote_masa = lotes_map.get(lote_tapas.produccion.lote_origen_id)
        armado_extras[p.id] = {"lote_tapas": lote_tapas, "lote_masa": lote_masa}
    return templates.TemplateResponse("produccion/lista.html", {
        "request": request,
        "producciones": producciones,
        "recetas": recetas,
        "lotes_masa": lotes_masa,
        "prod_masa": prod_masa,
        "prod_tapas": prod_tapas,
        "prod_armado": prod_armado,
        "tapas_extras": tapas_extras,
        "armado_extras": armado_extras,
    })


@router.get("/api", response_model=list[ProduccionOut])
def listar_producciones(db: Session = Depends(get_db)):
    return [ProduccionOut.model_validate(p) for p in db.query(Produccion).order_by(Produccion.fecha_inicio.desc()).limit(100).all()]


@router.get("/api/lotes/masa")
def lotes_masa_disponibles(db: Session = Depends(get_db)):
    """Lotes de masa disponibles para usar como origen de tapas."""
    from app.models.producto import LoteProductoTerminado
    # Excluir lotes ya vinculados a una producción de tapas en proceso
    en_uso = db.query(Produccion.lote_origen_id).filter(
        Produccion.tipo_produccion == "tapas",
        Produccion.estado == "en_proceso",
        Produccion.lote_origen_id.isnot(None),
    ).subquery()
    lotes = db.query(LoteProductoTerminado).filter(
        LoteProductoTerminado.tipo == "masa",
        LoteProductoTerminado.activo == True,
        LoteProductoTerminado.cantidad_actual > 0,
        ~LoteProductoTerminado.id.in_(en_uso),
    ).order_by(LoteProductoTerminado.fecha_produccion.desc()).all()
    result = []
    for l in lotes:
        prod = l.produccion
        result.append({
            "id": l.id,
            "numero_lote": l.numero_lote,
            "cantidad_actual": l.cantidad_actual,
            "fecha_produccion": l.fecha_produccion.isoformat() if l.fecha_produccion else None,
            "producto_nombre": l.producto.nombre,
            # Datos de la producción de masa
            "peso_masa_teo_g": prod.peso_masa_total_g if prod else None,
            "masa_real_g": prod.masa_real_g if prod else None,
            "peso_tapa_objetivo_g": prod.peso_tapa_objetivo_g if prod else None,
            "tapas_teo_desde_teo": (
                round(prod.peso_masa_total_g / prod.peso_tapa_objetivo_g, 1)
                if prod and prod.peso_masa_total_g and prod.peso_tapa_objetivo_g and prod.peso_tapa_objetivo_g > 0
                else None
            ),
            "tapas_teo_desde_real": (
                round(prod.masa_real_g / prod.peso_tapa_objetivo_g, 1)
                if prod and prod.masa_real_g and prod.peso_tapa_objetivo_g and prod.peso_tapa_objetivo_g > 0
                else None
            ),
        })
    return result


@router.get("/api/lotes/tapas")
def lotes_tapas_disponibles(db: Session = Depends(get_db)):
    """Lotes de tapas disponibles para armar alfajores."""
    from app.models.producto import LoteProductoTerminado
    lotes = db.query(LoteProductoTerminado).filter(
        LoteProductoTerminado.tipo == "tapas",
        LoteProductoTerminado.activo == True,
        LoteProductoTerminado.cantidad_actual > 0,
    ).order_by(LoteProductoTerminado.fecha_produccion.desc()).all()
    from app.models.receta import RecetaVersion
    result = []
    for l in lotes:
        prod = l.produccion
        receta = db.query(RecetaVersion).filter(
            RecetaVersion.producto_id == l.producto_id,
            RecetaVersion.activo == True,
        ).order_by(RecetaVersion.version.desc()).first()
        result.append({
            "id": l.id,
            "numero_lote": l.numero_lote,
            "cantidad_actual": l.cantidad_actual,
            "cantidad_libre": l.cantidad_libre,
            "fecha_produccion": l.fecha_produccion.isoformat() if l.fecha_produccion else None,
            "producto_nombre": l.producto.nombre if l.producto else "",
            "peso_tapa_cocida_g": prod.peso_tapa_cocida_promedio_g if prod else None,
            "fecha_vencimiento": l.fecha_vencimiento.isoformat() if l.fecha_vencimiento else None,
            "receta_version_id": receta.id if receta else None,
        })
    return result


@router.get("/api/{produccion_id}/origen-masa")
def origen_masa(produccion_id: int, db: Session = Depends(get_db)):
    """Devuelve datos del lote de masa origen de una producción de tapas."""
    from app.models.producto import LoteProductoTerminado
    prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not prod:
        raise HTTPException(404, "Producción no encontrada")
    if not prod.lote_origen_id:
        return {"lote_origen": None}
    lote = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id == prod.lote_origen_id).first()
    if not lote:
        return {"lote_origen": None}
    masa_prod = lote.produccion
    return {
        "lote_origen": {
            "id": lote.id,
            "numero_lote": lote.numero_lote,
            "cantidad_actual": lote.cantidad_actual,
            "producto_nombre": lote.producto.nombre,
            "peso_masa_teo_g": masa_prod.peso_masa_total_g if masa_prod else None,
            "masa_real_g": masa_prod.masa_real_g if masa_prod else None,
            "peso_tapa_objetivo_g": masa_prod.peso_tapa_objetivo_g if masa_prod else None,
            "tapas_teo_desde_teo": (
                round(masa_prod.peso_masa_total_g / masa_prod.peso_tapa_objetivo_g, 1)
                if masa_prod and masa_prod.peso_masa_total_g and masa_prod.peso_tapa_objetivo_g and masa_prod.peso_tapa_objetivo_g > 0
                else None
            ),
            "tapas_teo_desde_real": (
                round(masa_prod.masa_real_g / masa_prod.peso_tapa_objetivo_g, 1)
                if masa_prod and masa_prod.masa_real_g and masa_prod.peso_tapa_objetivo_g and masa_prod.peso_tapa_objetivo_g > 0
                else None
            ),
        }
    }


@router.get("/api/lote-alfajor/{lote_id}/costo-detalle")
def costo_detalle_alfajor(lote_id: int, db: Session = Depends(get_db)):
    """Desglose completo de costos de producción para un lote de alfajores terminados."""
    from app.models.produccion import ProduccionInsumo, ProduccionTacho
    from sqlalchemy.orm import joinedload as _jl3

    lote = db.query(LoteProductoTerminado).options(
        _jl3(LoteProductoTerminado.producto),
        _jl3(LoteProductoTerminado.produccion),
    ).filter(LoteProductoTerminado.id == lote_id, LoteProductoTerminado.tipo == "alfajor").first()
    if not lote:
        raise HTTPException(404, "Lote de alfajor no encontrado")

    def _uso_a_dict(uso):
        if uso.lote_insumo and uso.lote_insumo.insumo:
            ins = uso.lote_insumo.insumo
            return {
                "nombre": ins.nombre, "unidad": ins.unidad_medida,
                "cantidad": round(uso.cantidad_usada, 4),
                "costo_unitario": round(uso.costo_unitario, 4),
                "costo_total": round(uso.cantidad_usada * uso.costo_unitario, 2),
            }
        if uso.lote_producto and uso.lote_producto.producto:
            pt = uso.lote_producto.producto
            return {
                "nombre": pt.nombre, "unidad": "u.",
                "cantidad": round(uso.cantidad_usada, 2),
                "costo_unitario": round(uso.costo_unitario, 4),
                "costo_total": round(uso.cantidad_usada * uso.costo_unitario, 2),
            }
        return None

    etapas = []
    costo_total_global = 0.0

    # ── Armado ────────────────────────────────────────────────────────────────
    armado = lote.produccion
    armado_items = []
    armado_tacho_items = []
    if armado:
        for uso in armado.insumos_usados:
            d = _uso_a_dict(uso)
            if d:
                armado_items.append(d)
        # Tachos (chocolate, dulce de leche, envoltorio, etc.)
        for tacho in db.query(ProduccionTacho).filter(ProduccionTacho.produccion_id == armado.id).all():
            if tacho.tipo == "insumo" and tacho.insumo_id:
                from app.models.insumo import Insumo as _Ins
                ins = db.query(_Ins).filter(_Ins.id == tacho.insumo_id).first()
                if ins and tacho.cantidad_usada and tacho.costo_unitario:
                    armado_tacho_items.append({
                        "nombre": ins.nombre, "unidad": ins.unidad_medida,
                        "cantidad": round(tacho.cantidad_usada, 4),
                        "costo_unitario": round(tacho.costo_unitario, 4),
                        "costo_total": round(tacho.cantidad_usada * tacho.costo_unitario, 2),
                    })
    all_armado = armado_items + armado_tacho_items
    sub_armado = sum(i["costo_total"] for i in all_armado)
    if all_armado:
        etapas.append({"etapa": "Armado", "icono": "box", "items": all_armado, "subtotal": sub_armado})
    costo_total_global += sub_armado

    # ── Tapas ─────────────────────────────────────────────────────────────────
    tapas = None
    lote_tapas = None
    if armado and armado.lote_origen_id:
        lote_tapas = db.query(LoteProductoTerminado).options(
            _jl3(LoteProductoTerminado.produccion)
        ).filter(LoteProductoTerminado.id == armado.lote_origen_id).first()
        if lote_tapas:
            tapas = lote_tapas.produccion
    tapas_items = []
    if tapas:
        for uso in tapas.insumos_usados:
            d = _uso_a_dict(uso)
            if d:
                tapas_items.append(d)
    sub_tapas = sum(i["costo_total"] for i in tapas_items)
    if tapas_items:
        etapas.append({"etapa": "Tapas", "icono": "flame", "items": tapas_items, "subtotal": sub_tapas})
    costo_total_global += sub_tapas

    # ── Masa ──────────────────────────────────────────────────────────────────
    masa = None
    if tapas and tapas.lote_origen_id:
        lote_masa = db.query(LoteProductoTerminado).options(
            _jl3(LoteProductoTerminado.produccion)
        ).filter(LoteProductoTerminado.id == tapas.lote_origen_id).first()
        if lote_masa:
            masa = lote_masa.produccion
    masa_items = []
    if masa:
        for uso in masa.insumos_usados:
            d = _uso_a_dict(uso)
            if d:
                masa_items.append(d)
    sub_masa = sum(i["costo_total"] for i in masa_items)
    if masa_items:
        etapas.append({"etapa": "Masa", "icono": "package", "items": masa_items, "subtotal": sub_masa})
    costo_total_global += sub_masa

    cant = lote.cantidad_inicial or lote.cantidad_actual or 1
    costo_unit = round(costo_total_global / cant, 4) if cant > 0 else 0

    return {
        "lote_id": lote.id,
        "numero_lote": lote.numero_lote,
        "producto": lote.producto.nombre if lote.producto else "",
        "cantidad_inicial": lote.cantidad_inicial,
        "cantidad_actual": lote.cantidad_actual,
        "costo_total": round(costo_total_global, 2),
        "costo_unitario": costo_unit,
        "etapas": etapas,
        "tiene_datos": len(etapas) > 0,
    }


@router.post("/api/iniciar", response_model=ProduccionOut, status_code=201)
def iniciar(data: ProduccionCreate, db: Session = Depends(get_db)):
    receta_id = data.receta_version_id
    # Para armado sin receta: buscar automáticamente por el producto del lote
    if receta_id is None and data.tipo_produccion == "armado" and data.lote_origen_id:
        from app.models.producto import LoteProductoTerminado
        lote = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id == data.lote_origen_id).first()
        if lote and lote.producto_id:
            receta = db.query(RecetaVersion).filter(
                RecetaVersion.producto_id == lote.producto_id,
                RecetaVersion.activo == True,
            ).order_by(RecetaVersion.version.desc()).first()
            if receta:
                receta_id = receta.id
        if receta_id is None:
            receta_fallback = db.query(RecetaVersion).filter(RecetaVersion.activo == True).first()
            if receta_fallback:
                receta_id = receta_fallback.id
        if receta_id is None:
            raise HTTPException(400, "No hay recetas en el sistema. Creá una en la sección Recetas primero.")
    # Para tapas sin receta: buscar automáticamente igual que armado
    if receta_id is None and data.tipo_produccion == "tapas" and data.lote_origen_id:
        from app.models.producto import LoteProductoTerminado
        lote = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id == data.lote_origen_id).first()
        if lote and lote.producto_id:
            receta = db.query(RecetaVersion).filter(
                RecetaVersion.producto_id == lote.producto_id,
                RecetaVersion.activo == True,
            ).order_by(RecetaVersion.version.desc()).first()
            if receta:
                receta_id = receta.id
        if receta_id is None:
            receta_fallback = db.query(RecetaVersion).filter(RecetaVersion.activo == True).first()
            if receta_fallback:
                receta_id = receta_fallback.id
        if receta_id is None:
            raise HTTPException(400, "No hay recetas en el sistema. Creá una en la sección Recetas primero.")
    try:
        produccion = iniciar_produccion(
            db, receta_id, data.operario, data.notas, data.tipo_produccion,
            data.peso_masa_total_g, data.peso_tapa_objetivo_g,
            data.peso_tapa_min_g, data.peso_tapa_max_g,
            data.lote_origen_id, data.cantidad_recetas,
            data.cantidad_tapas_a_usar,
        )
        db.commit()
        db.refresh(produccion)
        return ProduccionOut.model_validate(produccion)
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))


@router.post("/api/{produccion_id}/finalizar", response_model=ProduccionOut)
def finalizar(produccion_id: int, data: ProduccionFinalizar, db: Session = Depends(get_db)):
    try:
        cantidad = data.cantidad_producida or data.tapas_reales or 0
        finalizar_produccion(
            db, produccion_id, cantidad, data.notas,
            data.masa_real_g, data.pesos_muestra_json,
            data.tapas_reales, data.tapas_rotas,
            data.peso_tapa_cruda_promedio_g, data.peso_tapa_cocida_promedio_g,
            data.masa_desperdiciada_g, data.tapas_por_hornada,
            data.minutos_por_hornada, data.horas_horno_total,
            getattr(data, 'horas_mano_obra', None),
            getattr(data, 'tapas_crudas_rotas', None),
        )
        db.commit()
        produccion = db.query(Produccion).filter(Produccion.id == produccion_id).first()
        db.refresh(produccion)
        return ProduccionOut.model_validate(produccion)
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))


@router.patch("/api/{produccion_id}/tapa", response_model=ProduccionOut)
def actualizar_datos_tapa(produccion_id: int, data: ProduccionTapaUpdate, db: Session = Depends(get_db)):
    """Actualizar datos de tapa en tiempo real (sin finalizar)."""
    prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not prod:
        raise HTTPException(404, "Produccion no encontrada")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(prod, k, v)
    db.commit()
    db.refresh(prod)
    return ProduccionOut.model_validate(prod)


@router.get("/api/etapas")
def etapas_activas(db: Session = Depends(get_db)):
    """Vista simplificada de producciones activas para la app móvil."""
    from sqlalchemy.orm import joinedload
    prods = (
        db.query(Produccion)
        .options(joinedload(Produccion.receta_version).joinedload(RecetaVersion.producto))
        .filter(Produccion.estado == "en_proceso")
        .order_by(Produccion.fecha_inicio.desc())
        .limit(20)
        .all()
    )
    ETAPA_MAP = {"masa": "Amasado", "tapas": "Tapas", "armado": "Armado"}
    result = []
    for p in prods:
        nombre_producto = p.receta_version.producto.nombre if p.receta_version and p.receta_version.producto else "Producción"
        result.append({
            "id":           p.id,
            "tipo":         p.tipo_produccion,
            "etapa_label":  ETAPA_MAP.get(p.tipo_produccion, p.tipo_produccion),
            "producto":     nombre_producto,
            "cantidad":     float(p.cantidad_producida or 0),
            "unidad":       "kg" if p.tipo_produccion == "masa" else "und",
            "fecha_inicio": p.fecha_inicio.strftime("%d/%m %H:%M") if p.fecha_inicio else None,
            "operario":     p.operario or "Sin asignar",
        })
    return result


@router.get("/api/config")
def get_config(db: Session = Depends(get_db)):
    """Devuelve configuración actual: horno activo y precio mano de obra."""
    cfg = db.query(ConfiguracionProduccion).filter(ConfiguracionProduccion.id == 1).first()
    horno = None
    if cfg and cfg.horno_activo_id:
        h = db.query(Horno).filter(Horno.id == cfg.horno_activo_id).first()
        if h:
            horno = {"id": h.id, "nombre": h.nombre, "potencia_kw": h.potencia_kw, "precio_kwh": h.precio_kwh}
    return {
        "precio_hora_mano_obra": cfg.precio_hora_mano_obra if cfg else 0.0,
        "horno": horno,
    }


@router.get("/api/stock-terminado")
def stock_terminado(db: Session = Depends(get_db)):
    """Lotes de alfajores terminados disponibles en la fábrica."""
    from sqlalchemy.orm import joinedload as _jl2
    from datetime import datetime as _dt2
    lotes = (
        db.query(LoteProductoTerminado)
        .options(_jl2(LoteProductoTerminado.producto), _jl2(LoteProductoTerminado.produccion))
        .filter(
            LoteProductoTerminado.tipo == "alfajor",
            LoteProductoTerminado.activo == True,
            LoteProductoTerminado.cantidad_actual > 0,
        )
        .order_by(LoteProductoTerminado.fecha_produccion.desc())
        .all()
    )
    return [{
        "id":               l.id,
        "numero_lote":      l.numero_lote,
        "producto_id":      l.producto_id,
        "producto":         l.producto.nombre if l.producto else f"Producto #{l.producto_id}",
        "cantidad_actual":  l.cantidad_actual,
        "cantidad_inicial": l.cantidad_inicial,
        "costo_unitario":   l.costo_unitario_calculado or 0,
        "fecha_produccion": l.fecha_produccion.strftime("%d/%m/%Y") if l.fecha_produccion else None,
        "fecha_vencimiento": l.fecha_vencimiento.strftime("%d/%m/%Y") if l.fecha_vencimiento else None,
        "dias_para_vencer": (
            (l.fecha_vencimiento - _dt2.utcnow()).days if l.fecha_vencimiento else None
        ),
        "produccion_id":    l.produccion_id,
        "operario":         l.produccion.operario if l.produccion else None,
    } for l in lotes]


@router.get("/api/analytics/tapas")
def analytics_tapas(db: Session = Depends(get_db)):
    prods = (
        db.query(Produccion)
        .filter(Produccion.tipo_produccion == "tapas", Produccion.estado == "finalizada")
        .order_by(Produccion.fecha_inicio.desc())
        .limit(20)
        .all()
    )
    if not prods:
        return {"registros": 0}

    with_rendimiento = [p for p in prods if p.tapas_reales and p.tapas_teoricas]
    avg_rendimiento = (
        sum(p.rendimiento_real_pct for p in with_rendimiento) / len(with_rendimiento)
        if with_rendimiento else None
    )
    with_cruda = [p for p in prods if p.peso_tapa_cruda_promedio_g]
    avg_cruda = sum(p.peso_tapa_cruda_promedio_g for p in with_cruda) / len(with_cruda) if with_cruda else None
    with_cocida = [p for p in prods if p.peso_tapa_cocida_promedio_g]
    avg_cocida = sum(p.peso_tapa_cocida_promedio_g for p in with_cocida) / len(with_cocida) if with_cocida else None
    with_desperdicio = [p for p in prods if p.masa_desperdiciada_g]
    avg_desperdicio = sum(p.masa_desperdiciada_g for p in with_desperdicio) / len(with_desperdicio) if with_desperdicio else None

    return {
        "registros": len(prods),
        "promedio_rendimiento_pct": round(avg_rendimiento, 1) if avg_rendimiento else None,
        "promedio_peso_cruda_g": round(avg_cruda, 1) if avg_cruda else None,
        "promedio_peso_cocida_g": round(avg_cocida, 1) if avg_cocida else None,
        "promedio_desperdicio_g": round(avg_desperdicio, 1) if avg_desperdicio else None,
        "merma_coccion_pct": round(((avg_cruda - avg_cocida) / avg_cruda) * 100, 1) if avg_cruda and avg_cocida else None,
        "ultimas": [
            {
                "lote": p.numero_lote_produccion,
                "fecha": p.fecha_inicio,
                "tapas_teoricas": p.tapas_teoricas,
                "tapas_reales": p.tapas_reales,
                "rendimiento_pct": p.rendimiento_real_pct,
                "desperdicio_pct": p.desperdicio_pct,
            }
            for p in prods[:5]
        ],
    }


@router.get("/api/debug-stock/{receta_version_id}")
def debug_stock_receta(receta_version_id: int, escala: float = 1.0, db: Session = Depends(get_db)):
    from datetime import datetime as _dt
    receta = db.query(RecetaVersion).filter(RecetaVersion.id == receta_version_id).first()
    if not receta:
        raise HTTPException(404, "Receta no encontrada")
    resultado = []
    for ing in receta.ingredientes:
        if ing.tipo_ingrediente == "insumo":
            insumo = db.query(Insumo).filter(Insumo.id == ing.insumo_id).first()
            lotes = db.query(LoteInsumo).filter(LoteInsumo.insumo_id == ing.insumo_id).all()
            lotes_activos = [l for l in lotes if l.activo and l.cantidad_actual > 0]
            lotes_vencidos = [l for l in lotes_activos if l.fecha_vencimiento and _dt.utcnow() > l.fecha_vencimiento]
            resultado.append({
                "tipo": "insumo",
                "insumo_id": ing.insumo_id,
                "nombre": insumo.nombre if insumo else f"Insumo #{ing.insumo_id}",
                "cantidad_necesaria": ing.cantidad * escala,
                "unidad": ing.unidad_medida,
                "stock_activo_total": sum(l.cantidad_actual for l in lotes_activos),
                "stock_sin_vencidos": sum(l.cantidad_actual for l in lotes_activos if l not in lotes_vencidos),
                "lotes_activos": len(lotes_activos),
                "lotes_vencidos": len(lotes_vencidos),
                "lotes_detalle": [{
                    "id": l.id,
                    "numero_lote": l.numero_lote,
                    "cantidad_actual": l.cantidad_actual,
                    "activo": l.activo,
                    "fecha_vencimiento": str(l.fecha_vencimiento) if l.fecha_vencimiento else None,
                    "vencido": bool(l.fecha_vencimiento and _dt.utcnow() > l.fecha_vencimiento),
                } for l in lotes],
            })
    return {"receta_id": receta_version_id, "escala": escala, "ingredientes": resultado}


@router.get("/api/{produccion_id}", response_model=ProduccionOut)
def obtener_produccion(produccion_id: int, db: Session = Depends(get_db)):
    prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not prod:
        raise HTTPException(404, "Produccion no encontrada")
    return ProduccionOut.model_validate(prod)


@router.get("/api/{produccion_id}/insumos-usados")
def insumos_usados(produccion_id: int, db: Session = Depends(get_db)):
    """Historial de componentes (insumos y productos) consumidos en esta producción."""
    usos = db.query(ProduccionInsumo).filter(ProduccionInsumo.produccion_id == produccion_id).all()
    resultado = []
    for u in usos:
        if u.lote_insumo:
            resultado.append({
                "tipo": "insumo",
                "nombre": u.lote_insumo.insumo.nombre,
                "numero_lote": u.lote_insumo.numero_lote,
                "proveedor": u.lote_insumo.proveedor,
                "cantidad_usada": u.cantidad_usada,
                "unidad": u.lote_insumo.insumo.unidad_medida,
                "costo_unitario": u.costo_unitario,
                "costo_total": round(u.cantidad_usada * u.costo_unitario, 2),
            })
        elif u.lote_producto:
            resultado.append({
                "tipo": "producto_terminado",
                "nombre": u.lote_producto.producto.nombre,
                "numero_lote": u.lote_producto.numero_lote,
                "proveedor": None,
                "cantidad_usada": u.cantidad_usada,
                "unidad": u.lote_producto.producto.unidad_medida,
                "costo_unitario": u.costo_unitario,
                "costo_total": round(u.cantidad_usada * u.costo_unitario, 2),
            })
    return resultado


# ── Armado endpoints ────────────────────────────────────────────────────────

class RegistrarTapasBody(BaseModel):
    lote_producto_id: int
    cantidad_tapas: float
    notas: str | None = None


class RegistrarInsumoBody(BaseModel):
    insumo_id: int
    lote_insumo_id: int | None = None
    gramos_usados: float
    notas: str | None = None


@router.get("/api/{produccion_id}/armado-context")
def armado_context(produccion_id: int, db: Session = Depends(get_db)):
    prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not prod:
        raise HTTPException(404, "Producción no encontrada")

    receta = prod.receta_version
    ingredientes_info = []

    for ing in receta.ingredientes:
        if ing.tipo_ingrediente == "producto_terminado":
            pt = db.query(ProductoTerminado).filter(ProductoTerminado.id == ing.producto_terminado_id).first()
            lotes = (
                db.query(LoteProductoTerminado)
                .filter(
                    LoteProductoTerminado.producto_id == ing.producto_terminado_id,
                    LoteProductoTerminado.activo == True,
                    LoteProductoTerminado.cantidad_actual > 0,
                    LoteProductoTerminado.tipo == "tapas",  # solo lotes de tapas cocidas
                )
                .all()
            )
            con_venc = sorted([l for l in lotes if l.fecha_vencimiento], key=lambda l: l.fecha_vencimiento)
            sin_venc = [l for l in lotes if not l.fecha_vencimiento]
            lotes_ord = con_venc + sin_venc
            ingredientes_info.append({
                "tipo": "producto_terminado",
                "producto_terminado_id": ing.producto_terminado_id,
                "nombre": pt.nombre if pt else f"Producto #{ing.producto_terminado_id}",
                "cantidad_necesaria": ing.cantidad,
                "unidad": ing.unidad_medida,
                "lotes_disponibles": [
                    {
                        "id": l.id,
                        "numero_lote": l.numero_lote,
                        "cantidad_libre": l.cantidad_libre,
                        "cantidad_actual": l.cantidad_actual,
                        "fecha_vencimiento": l.fecha_vencimiento.isoformat() if l.fecha_vencimiento else None,
                        "costo_unitario": l.costo_unitario_calculado or 0.0,
                    }
                    for l in lotes_ord
                ],
            })
        else:
            from app.services.stock_service import get_lotes_fefo
            lotes = get_lotes_fefo(db, ing.insumo_id)
            stock_total = sum(l.cantidad_actual for l in lotes)
            ingredientes_info.append({
                "tipo": "insumo",
                "insumo_id": ing.insumo_id,
                "nombre": ing.insumo.nombre if ing.insumo else f"Insumo #{ing.insumo_id}",
                "unidad_medida": ing.insumo.unidad_medida if ing.insumo else "kg",
                "cantidad_necesaria": ing.cantidad,
                "unidad": ing.unidad_medida,
                "stock_total": round(stock_total, 3),
                "lotes_disponibles": [
                    {
                        "id": l.id,
                        "numero_lote": l.numero_lote,
                        "cantidad_actual": round(l.cantidad_actual, 3),
                        "fecha_vencimiento": l.fecha_vencimiento.isoformat() if l.fecha_vencimiento else None,
                        "costo_unitario": l.costo_unitario,
                    }
                    for l in lotes
                ],
            })

    tachos = db.query(ProduccionTacho).filter(ProduccionTacho.produccion_id == produccion_id).order_by(ProduccionTacho.registrado_at).all()

    tachos_data = []
    totales_insumo_g: dict[int, float] = {}
    total_tapas: dict[int, float] = {}

    for t in tachos:
        nombre = "—"
        if t.tipo == "insumo" and t.insumo_id:
            ins = db.query(Insumo).filter(Insumo.id == t.insumo_id).first()
            nombre = ins.nombre if ins else f"Insumo #{t.insumo_id}"
            totales_insumo_g[t.insumo_id] = totales_insumo_g.get(t.insumo_id, 0) + (t.gramos_usados or 0)
        elif t.tipo == "tapas" and t.lote_producto_id:
            lpt = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id == t.lote_producto_id).first()
            nombre = lpt.producto.nombre if lpt else "Tapas"
            total_tapas[t.lote_producto_id] = total_tapas.get(t.lote_producto_id, 0) + (t.cantidad_tapas or 0)
        tachos_data.append({
            "id": t.id,
            "tipo": t.tipo,
            "nombre": nombre,
            "numero_apertura": t.numero_apertura,
            "gramos_usados": t.gramos_usados,
            "cantidad_tapas": t.cantidad_tapas,
            "insumo_id": t.insumo_id,
            "lote_insumo_id": t.lote_insumo_id,
            "lote_producto_id": t.lote_producto_id,
            "notas": t.notas,
            "registrado_at": t.registrado_at.isoformat() if t.registrado_at else None,
        })

    # Datos de la producción de tapas origen (pesos cruda/cocida) + masa origen de las tapas
    tapas_prod_info = None
    if prod.lote_origen_id:
        lote_tapas = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id == prod.lote_origen_id).first()
        if lote_tapas and lote_tapas.produccion:
            tp = lote_tapas.produccion
            masa_info = None
            if tp.lote_origen_id:
                lote_masa = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id == tp.lote_origen_id).first()
                if lote_masa and lote_masa.produccion:
                    mp = lote_masa.produccion
                    masa_info = {
                        "numero_lote": lote_masa.numero_lote,
                        "peso_masa_total_g": mp.peso_masa_total_g,
                        "masa_real_g": mp.masa_real_g,
                        "peso_tapa_objetivo_g": mp.peso_tapa_objetivo_g,
                        "produccion_id": mp.id,
                        "costo_total_insumos": mp.costo_total_insumos,
                    }
            # Costo por tapa: total masa / tapas buenas (incluye merma por cocción)
            costo_unitario_tapa = None
            if tp.costo_total_insumos and tp.tapas_reales and tp.tapas_reales > 0:
                costo_unitario_tapa = round(tp.costo_total_insumos / tp.tapas_reales, 4)
            elif masa_info and masa_info["costo_total_insumos"] and tp.tapas_reales and tp.tapas_reales > 0:
                costo_unitario_tapa = round(masa_info["costo_total_insumos"] / tp.tapas_reales, 4)
            tapas_prod_info = {
                "numero_lote": lote_tapas.numero_lote,
                "numero_lote_produccion": tp.numero_lote_produccion,
                "peso_cruda_prom_g": tp.peso_tapa_cruda_promedio_g,
                "peso_cocida_prom_g": tp.peso_tapa_cocida_promedio_g,
                "tapas_reales": tp.tapas_reales,
                "tapas_rotas": tp.tapas_rotas,
                "tapas_crudas_contadas": tp.tapas_crudas_contadas,
                "produccion_id": tp.id,
                "costo_total_insumos": tp.costo_total_insumos,
                "costo_unitario_tapa": costo_unitario_tapa,
                "masa": masa_info,
            }

    return {
        "produccion": {
            "id": prod.id,
            "numero_lote": prod.numero_lote_produccion,
            "estado": prod.estado,
            "receta": receta.nombre,
            "producto": receta.producto.nombre,
            "dias_vida_util": receta.producto.dias_vida_util,
            "tapas_teoricas": prod.tapas_teoricas,
            "tapas_rotas": prod.tapas_rotas,
            "cantidad_producida": prod.cantidad_producida,
            "etapa_armado": prod.etapa_armado,
            "rendimiento_esperado": receta.rendimiento_esperado,
            "tapas_por_alfajor": receta.tapas_por_alfajor,
            "peso_relleno_objetivo_g": receta.peso_relleno_objetivo_g,
            "peso_bano_objetivo_g": receta.peso_bano_objetivo_g,
            "peso_alfajor_objetivo_g": receta.peso_alfajor_objetivo_g,
        },
        "ingredientes": ingredientes_info,
        "tachos": tachos_data,
        "totales_insumo_g": totales_insumo_g,
        "total_tapas": total_tapas,
        "tapas_prod_info": tapas_prod_info,
    }


class TapasRotasBody(BaseModel):
    tapas_rotas: int


@router.patch("/api/{produccion_id}/tapas-rotas")
def set_tapas_rotas(produccion_id: int, data: TapasRotasBody, db: Session = Depends(get_db)):
    prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not prod:
        raise HTTPException(404, "Producción no encontrada")
    prod.tapas_rotas = data.tapas_rotas
    db.commit()
    return {"ok": True, "tapas_rotas": prod.tapas_rotas}


class PesajeCrudaBody(BaseModel):
    pesos: list[float]


class ConteoCrudoBody(BaseModel):
    tapas_crudas: int
    masa_sobrante_g: float | None = None


@router.post("/api/{produccion_id}/guardar-pesaje-cruda")
def guardar_pesaje_cruda(produccion_id: int, data: PesajeCrudaBody, db: Session = Depends(get_db)):
    import json
    prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not prod:
        raise HTTPException(404, "Producción no encontrada")
    if prod.estado == "finalizada":
        raise HTTPException(400, "La producción ya fue finalizada")
    if not data.pesos:
        raise HTTPException(400, "Ingresá al menos un peso")
    prod.pesos_muestra_json = json.dumps(data.pesos)
    prod.peso_tapa_cruda_promedio_g = round(sum(data.pesos) / len(data.pesos), 2)
    prod.etapa_tapas = "pesaje_cruda"
    db.commit()
    return {"ok": True, "promedio_g": prod.peso_tapa_cruda_promedio_g}


@router.post("/api/{produccion_id}/guardar-conteo-crudo")
def guardar_conteo_crudo(produccion_id: int, data: ConteoCrudoBody, db: Session = Depends(get_db)):
    prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not prod:
        raise HTTPException(404, "Producción no encontrada")
    if prod.estado == "finalizada":
        raise HTTPException(400, "La producción ya fue finalizada")
    prod.tapas_crudas_contadas = data.tapas_crudas
    prod.masa_desperdiciada_g = data.masa_sobrante_g
    prod.etapa_tapas = "conteo_crudo"
    db.commit()
    return {"ok": True}


@router.post("/api/{produccion_id}/registrar-tapas", status_code=201)
def registrar_tapas(produccion_id: int, data: RegistrarTapasBody, db: Session = Depends(get_db)):
    prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not prod:
        raise HTTPException(404, "Producción no encontrada")
    if prod.estado == "finalizada":
        raise HTTPException(400, "La producción ya fue finalizada")

    from app.models.producto import LoteProductoTerminado
    lote = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id == data.lote_producto_id).first()
    if not lote:
        raise HTTPException(404, "Lote de tapas no encontrado")
    if lote.cantidad_libre < data.cantidad_tapas:
        raise HTTPException(400, f"Stock insuficiente: disponible {lote.cantidad_libre:.0f} tapas")

    tacho = ProduccionTacho(
        produccion_id=produccion_id,
        tipo="tapas",
        lote_producto_id=data.lote_producto_id,
        cantidad_tapas=data.cantidad_tapas,
        notas=data.notas,
    )
    db.add(tacho)

    # Si es el primer lote de tapas registrado, heredar número de lote desde la masa
    tapas_previas = db.query(ProduccionTacho).filter(
        ProduccionTacho.produccion_id == produccion_id,
        ProduccionTacho.tipo == "tapas",
    ).count()
    if tapas_previas == 0 and lote.produccion and lote.produccion.lote_origen_id:
        from app.services.produccion_service import _numero_lote_armado, _julian, _yymmdd
        from app.models.producto import LoteProductoTerminado as LPT
        lote_masa = db.query(LPT).filter(LPT.id == lote.produccion.lote_origen_id).first()
        if lote_masa and lote_masa.produccion:
            from datetime import datetime as dt
            prod.numero_lote_produccion = _numero_lote_armado(
                prod.receta_version.producto.nombre,
                dt.utcnow(),
                _julian(lote_masa.produccion.fecha_inicio),
            )

    db.commit()
    return {"ok": True, "id": tacho.id}


@router.post("/api/{produccion_id}/registrar-insumo", status_code=201)
def registrar_insumo(produccion_id: int, data: RegistrarInsumoBody, db: Session = Depends(get_db)):
    prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not prod:
        raise HTTPException(404, "Producción no encontrada")
    if prod.estado == "finalizada":
        raise HTTPException(400, "La producción ya fue finalizada")

    count = db.query(ProduccionTacho).filter(
        ProduccionTacho.produccion_id == produccion_id,
        ProduccionTacho.tipo == "insumo",
        ProduccionTacho.insumo_id == data.insumo_id,
    ).count()

    tacho = ProduccionTacho(
        produccion_id=produccion_id,
        tipo="insumo",
        insumo_id=data.insumo_id,
        lote_insumo_id=data.lote_insumo_id,
        gramos_usados=data.gramos_usados,
        numero_apertura=count + 1,
        notas=data.notas,
    )
    db.add(tacho)
    db.commit()
    return {"ok": True, "id": tacho.id}


@router.delete("/api/{produccion_id}/tacho/{tacho_id}")
def eliminar_tacho(produccion_id: int, tacho_id: int, db: Session = Depends(get_db)):
    tacho = db.query(ProduccionTacho).filter(
        ProduccionTacho.id == tacho_id,
        ProduccionTacho.produccion_id == produccion_id,
    ).first()
    if not tacho:
        raise HTTPException(404, "Registro no encontrado")
    db.delete(tacho)
    db.commit()
    return {"ok": True}


class PesajeArmadoBody(BaseModel):
    pesos: list[float]
    etapa: str  # "sin_bano" | "con_bano"


@router.post("/api/{produccion_id}/guardar-pesaje-armado")
def guardar_pesaje_armado(produccion_id: int, data: PesajeArmadoBody, db: Session = Depends(get_db)):
    import json
    prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not prod:
        raise HTTPException(404, "Producción no encontrada")
    if prod.estado == "finalizada":
        raise HTTPException(400, "La producción ya fue finalizada")
    if not data.pesos:
        raise HTTPException(400, "Ingresá al menos un peso")
    promedio = round(sum(data.pesos) / len(data.pesos), 2)
    if data.etapa == "sin_bano":
        prod.pesos_sin_bano_json = json.dumps(data.pesos)
        prod.peso_alfajor_sin_bano_g = promedio
        prod.etapa_armado = "pesaje_sin_bano"
    else:
        prod.pesos_con_bano_json = json.dumps(data.pesos)
        prod.peso_alfajor_con_bano_g = promedio
        prod.etapa_armado = "pesaje_con_bano"
    db.commit()
    return {"ok": True, "promedio_g": promedio, "etapa": data.etapa}


class EnvasadoFinalizarBody(BaseModel):
    unidades: int
    notas: str | None = None
    dias_vencimiento: int | None = None
    # Envoltorio
    insumo_envoltorio_id: int | None = None
    # Etiquetas
    tipo_etiqueta: str = "simple"
    insumo_etiqueta_id: int | None = None
    unidades_etiqueta_simple: int = 0
    unidades_etiqueta_doble: int = 0
    # Dulce de leche
    insumo_dulce_id: int | None = None
    dulce_gramos: float | None = None
    # Chocolate / baño
    insumo_chocolate_id: int | None = None
    chocolate_gramos: float | None = None
    # Costos extra y desperdicios
    horas_mano_obra: float | None = None
    alfajores_rotos_bano: int | None = None
    alfajores_rotos_empaque: int | None = None
    chocolate_no_recuperado_g: float | None = None


@router.post("/api/{produccion_id}/envasar-y-finalizar", response_model=ProduccionOut)
def envasar_y_finalizar(produccion_id: int, data: EnvasadoFinalizarBody, db: Session = Depends(get_db)):
    from app.services.stock_service import consumir_stock_fefo
    prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not prod:
        raise HTTPException(404, "Producción no encontrada")
    if prod.estado == "finalizada":
        raise HTTPException(400, "La producción ya fue finalizada")
    if data.unidades <= 0:
        raise HTTPException(400, "La cantidad de unidades debe ser mayor a 0")

    # ── Auto-crear tacho de tapas si no existe ──────────────────────────
    tapas_tachos = db.query(ProduccionTacho).filter(
        ProduccionTacho.produccion_id == produccion_id,
        ProduccionTacho.tipo == "tapas",
    ).count()
    if tapas_tachos == 0 and prod.lote_origen_id:
        tapas_por_alf = (prod.receta_version.tapas_por_alfajor or 2) if prod.receta_version else 2
        tacho_tapas = ProduccionTacho(
            produccion_id=produccion_id,
            tipo="tapas",
            lote_producto_id=prod.lote_origen_id,
            cantidad_tapas=float(data.unidades * tapas_por_alf),
        )
        db.add(tacho_tapas)
        db.flush()

    # ── Crear tachos de dulce y chocolate desde inputs inline ───────────
    if data.insumo_dulce_id and data.dulce_gramos and data.dulce_gramos > 0:
        db.add(ProduccionTacho(
            produccion_id=produccion_id,
            tipo="insumo",
            insumo_id=data.insumo_dulce_id,
            gramos_usados=data.dulce_gramos,
        ))
    if data.insumo_chocolate_id and data.chocolate_gramos and data.chocolate_gramos > 0:
        db.add(ProduccionTacho(
            produccion_id=produccion_id,
            tipo="insumo",
            insumo_id=data.insumo_chocolate_id,
            gramos_usados=data.chocolate_gramos,
        ))
    db.flush()

    # ── Calcular total etiquetas ────────────────────────────────────────
    if data.tipo_etiqueta == "simple":
        total_etiquetas = data.unidades
    elif data.tipo_etiqueta == "doble":
        total_etiquetas = data.unidades * 2
    else:
        total_etiquetas = data.unidades_etiqueta_simple + (data.unidades_etiqueta_doble * 2)

    # ── Descontar envoltorio (si hay stock) ────────────────────────────
    if data.insumo_envoltorio_id:
        try:
            consumir_stock_fefo(db, data.insumo_envoltorio_id, data.unidades)
        except Exception:
            pass  # stock ficticio — continúa sin deducir

    # ── Descontar etiquetas (si hay stock) ─────────────────────────────
    if data.insumo_etiqueta_id and total_etiquetas > 0:
        try:
            consumir_stock_fefo(db, data.insumo_etiqueta_id, total_etiquetas)
        except Exception:
            pass  # stock ficticio

    # ── Guardar datos de envasado ───────────────────────────────────────
    prod.unidades_envasadas = data.unidades
    prod.etapa_armado = "envasado"
    db.flush()

    # ── Finalizar → crea lote de alfajores en stock ─────────────────────
    try:
        finalizar_armado(
            db, produccion_id, data.unidades, data.notas, data.dias_vencimiento,
            horas_mano_obra=data.horas_mano_obra,
            alfajores_rotos_bano=data.alfajores_rotos_bano,
            alfajores_rotos_empaque=data.alfajores_rotos_empaque,
            chocolate_no_recuperado_g=data.chocolate_no_recuperado_g,
        )
        db.commit()
        db.refresh(prod)
        return ProduccionOut.model_validate(prod)
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))
    except Exception as e:
        db.rollback()
        import traceback
        raise HTTPException(500, f"Error interno: {type(e).__name__}: {e}\n{traceback.format_exc()}")


@router.post("/api/{produccion_id}/finalizar-armado", response_model=ProduccionOut)
def finalizar_armado_endpoint(produccion_id: int, data: ProduccionFinalizar, db: Session = Depends(get_db)):
    try:
        finalizar_armado(db, produccion_id, data.cantidad_producida, data.notas)
        db.commit()
        prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
        db.refresh(prod)
        return ProduccionOut.model_validate(prod)
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))


@router.delete("/api/{produccion_id}")
def eliminar_produccion(produccion_id: int, db: Session = Depends(get_db)):
    from app.models.producto import LoteProductoTerminado
    prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not prod:
        raise HTTPException(404, "Producción no encontrada")

    # Restore consumed insumo/producto stock if production hadn't finalized yet
    if prod.estado == "en_proceso":
        for pi in prod.insumos_usados:
            if pi.lote_insumo_id:
                lote = db.query(LoteInsumo).filter(LoteInsumo.id == pi.lote_insumo_id).first()
                if lote:
                    lote.cantidad_actual += pi.cantidad_usada
            elif pi.lote_producto_id:
                lote = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id == pi.lote_producto_id).first()
                if lote:
                    lote.cantidad_actual += pi.cantidad_usada

    # Zero-out and deactivate any product lots this production created
    lotes = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.produccion_id == produccion_id).all()
    for lote in lotes:
        lote.activo = False
        lote.cantidad_actual = 0

    # Remove tachos (no cascade on this relation)
    db.query(ProduccionTacho).filter(ProduccionTacho.produccion_id == produccion_id).delete()

    db.delete(prod)  # insumos_usados cascade-deleted automatically
    db.commit()
    return {"ok": True}


# ── Registros parciales de tapas ──────────────────────────────────────────────

class RegistroTapasBody(BaseModel):
    tapas_ok: int
    tapas_rotas: int = 0
    peso_tapa_cocida_g: float | None = None   # promedio peso tapa cocida
    tiempo_coccion_min: int | None = None      # minutos de cocción esta sesión
    masa_desperdiciada_g: float | None = None
    notas: str | None = None
    fecha: str | None = None  # ISO date, default hoy


@router.get("/api/{produccion_id}/registros-tapas")
def listar_registros_tapas(produccion_id: int, db: Session = Depends(get_db)):
    prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not prod:
        raise HTTPException(404, "Producción no encontrada")
    regs = db.query(RegistroTapas).filter(
        RegistroTapas.produccion_id == produccion_id
    ).order_by(RegistroTapas.fecha).all()

    total_ok    = sum(r.tapas_ok for r in regs)
    total_rotas = sum(r.tapas_rotas for r in regs)
    total_desp  = sum(r.masa_desperdiciada_g for r in regs if r.masa_desperdiciada_g)

    return {
        "registros": [
            {
                "id": r.id,
                "fecha": r.fecha.strftime("%d/%m/%Y"),
                "tapas_ok": r.tapas_ok,
                "tapas_rotas": r.tapas_rotas,
                "peso_tapa_cocida_g": r.peso_tapa_cocida_g,
                "tiempo_coccion_min": r.tiempo_coccion_min,
                "masa_desperdiciada_g": r.masa_desperdiciada_g,
                "notas": r.notas,
            }
            for r in regs
        ],
        "totales": {
            "tapas_ok": total_ok,
            "tapas_rotas": total_rotas,
            "masa_desperdiciada_g": round(total_desp, 1),
            "tiempo_coccion_min": sum(r.tiempo_coccion_min for r in regs if r.tiempo_coccion_min),
        },
    }


@router.post("/api/{produccion_id}/agregar-registro-tapas")
def agregar_registro_tapas(produccion_id: int, data: RegistroTapasBody, db: Session = Depends(get_db)):
    from datetime import datetime, date
    prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not prod:
        raise HTTPException(404, "Producción no encontrada")
    if prod.tipo_produccion != "tapas":
        raise HTTPException(400, "Solo se pueden agregar registros a producciones de tapas")
    if prod.estado == "finalizada":
        raise HTTPException(400, "La producción ya está finalizada")
    if data.tapas_ok < 0:
        raise HTTPException(400, "Las tapas deben ser ≥ 0")

    fecha = datetime.combine(date.fromisoformat(data.fecha), datetime.min.time()) if data.fecha else datetime.utcnow()

    reg = RegistroTapas(
        produccion_id=produccion_id,
        fecha=fecha,
        tapas_ok=data.tapas_ok,
        tapas_rotas=data.tapas_rotas,
        peso_tapa_cocida_g=data.peso_tapa_cocida_g,
        tiempo_coccion_min=data.tiempo_coccion_min,
        masa_desperdiciada_g=data.masa_desperdiciada_g,
        notas=data.notas,
    )
    db.add(reg)

    # Recalcular totales acumulados incluido el nuevo registro
    all_regs = db.query(RegistroTapas).filter(RegistroTapas.produccion_id == produccion_id).all()
    prod.tapas_reales = sum(r.tapas_ok for r in all_regs) + data.tapas_ok
    prod.tapas_rotas  = sum(r.tapas_rotas for r in all_regs) + data.tapas_rotas

    desp_total = sum(r.masa_desperdiciada_g for r in all_regs if r.masa_desperdiciada_g)
    if data.masa_desperdiciada_g:
        desp_total += data.masa_desperdiciada_g
    prod.masa_desperdiciada_g = desp_total if desp_total > 0 else None

    # Horno: sumar tiempo total
    min_total = sum(r.tiempo_coccion_min for r in all_regs if r.tiempo_coccion_min)
    if data.tiempo_coccion_min:
        min_total += data.tiempo_coccion_min
    prod.horas_horno_total = round(min_total / 60, 2) if min_total else None

    # Peso cocida: promedio ponderado por tapas
    pesos = [(r.peso_tapa_cocida_g, r.tapas_ok) for r in all_regs if r.peso_tapa_cocida_g and r.tapas_ok]
    if data.peso_tapa_cocida_g and data.tapas_ok:
        pesos.append((data.peso_tapa_cocida_g, data.tapas_ok))
    if pesos:
        total_tapas_peso = sum(p[1] for p in pesos)
        prod.peso_tapa_cocida_promedio_g = round(sum(p[0] * p[1] for p in pesos) / total_tapas_peso, 1) if total_tapas_peso else None

    # ── Crear/actualizar lote de tapas en stock inmediatamente ────────
    from app.models.producto import LoteProductoTerminado
    lote_tapas = db.query(LoteProductoTerminado).filter(
        LoteProductoTerminado.produccion_id == produccion_id,
        LoteProductoTerminado.tipo == "tapas",
    ).first()
    if not lote_tapas:
        from datetime import timedelta
        producto = prod.receta_version.producto
        lote_tapas = LoteProductoTerminado(
            produccion_id=produccion_id,
            producto_id=producto.id,
            numero_lote=prod.numero_lote_produccion,
            cantidad_inicial=float(data.tapas_ok),
            cantidad_actual=float(data.tapas_ok),
            tipo="tapas",
            fecha_produccion=fecha,
            fecha_vencimiento=fecha + timedelta(days=90),
            activo=True,
        )
        db.add(lote_tapas)
    else:
        lote_tapas.cantidad_inicial = (lote_tapas.cantidad_inicial or 0) + data.tapas_ok
        lote_tapas.cantidad_actual  = (lote_tapas.cantidad_actual  or 0) + data.tapas_ok

    # ── Descontar masa usada del lote de masa origen ──────────────────
    if prod.lote_origen_id and prod.peso_tapa_objetivo_g and data.tapas_ok > 0:
        lote_masa = db.query(LoteProductoTerminado).filter(
            LoteProductoTerminado.id == prod.lote_origen_id
        ).first()
        if lote_masa:
            masa_usada_kg = (data.tapas_ok * prod.peso_tapa_objetivo_g + (data.masa_desperdiciada_g or 0)) / 1000
            lote_masa.cantidad_actual = round(max(0.0, lote_masa.cantidad_actual - masa_usada_kg), 4)

    db.commit()
    db.refresh(reg)
    return {"ok": True, "registro_id": reg.id, "tapas_ok": reg.tapas_ok}


class AvanzarEtapaMobileBody(BaseModel):
    cantidad: float | None = None
    # Masa
    masa_real_g: float | None = None
    # Tapas
    tapas_reales: int | None = None
    tapas_rotas: int | None = None
    masa_desperdiciada_g: float | None = None
    peso_tapa_cruda_promedio_g: float | None = None
    horas_horno_total: float | None = None
    # Armado
    dias_vencimiento: int | None = None
    # Común
    notas: str | None = None


@router.post("/api/{produccion_id}/avanzar-etapa-mobile")
def avanzar_etapa_mobile(
    produccion_id: int,
    body: AvanzarEtapaMobileBody = None,
    db: Session = Depends(get_db),
):
    """Avance rápido desde la app móvil. Marca la producción como finalizada y crea el lote correspondiente."""
    from datetime import datetime, timedelta
    from sqlalchemy.orm import joinedload as _jl
    prod = db.query(Produccion).filter(
        Produccion.id == produccion_id,
        Produccion.estado == "en_proceso",
    ).first()
    if not prod:
        raise HTTPException(404, "Producción no encontrada o ya finalizada")

    prod.estado = "finalizada"
    prod.fecha_fin = datetime.utcnow()
    if body and body.notas:
        prod.notas = body.notas

    # ── Masa ──────────────────────────────────────────────────────────────────
    if prod.tipo_produccion == "masa":
        if body and body.masa_real_g:
            prod.masa_real_g = body.masa_real_g

        if prod.receta_version_id:
            prod_full = db.query(Produccion).options(
                _jl(Produccion.receta_version).joinedload(RecetaVersion.producto)
            ).filter(Produccion.id == produccion_id).first()
            if prod_full and prod_full.receta_version and prod_full.receta_version.producto:
                cant = (body.cantidad if body and body.cantidad and body.cantidad > 0 else None) \
                    or float(prod_full.cantidad_producida or 0)
                if cant > 0:
                    lote_exist = db.query(LoteProductoTerminado).filter(
                        LoteProductoTerminado.produccion_id == produccion_id,
                        LoteProductoTerminado.tipo == "masa",
                    ).first()
                    if not lote_exist:
                        lote = LoteProductoTerminado(
                            producto_id=prod_full.receta_version.producto.id,
                            produccion_id=prod_full.id,
                            numero_lote=prod_full.numero_lote_produccion or f"MASA-MOB-{produccion_id}",
                            cantidad_inicial=cant,
                            cantidad_actual=cant,
                            fecha_produccion=datetime.utcnow(),
                            fecha_vencimiento=datetime.utcnow() + timedelta(days=7),
                            tipo="masa",
                            activo=True,
                        )
                        db.add(lote)
                        prod.cantidad_producida = cant

    # ── Tapas ─────────────────────────────────────────────────────────────────
    elif prod.tipo_produccion == "tapas":
        if body:
            if body.tapas_reales is not None: prod.tapas_reales = body.tapas_reales
            if body.tapas_rotas is not None:  prod.tapas_rotas = body.tapas_rotas
            if body.masa_desperdiciada_g is not None: prod.masa_desperdiciada_g = body.masa_desperdiciada_g
            if body.peso_tapa_cruda_promedio_g is not None: prod.peso_tapa_cruda_promedio_g = body.peso_tapa_cruda_promedio_g
            if body.horas_horno_total is not None: prod.horas_horno_total = body.horas_horno_total

        if prod.receta_version_id:
            prod_full = db.query(Produccion).options(
                _jl(Produccion.receta_version).joinedload(RecetaVersion.producto)
            ).filter(Produccion.id == produccion_id).first()
            if prod_full and prod_full.receta_version and prod_full.receta_version.producto:
                tapas_cant = float(
                    (body.tapas_reales if body and body.tapas_reales and body.tapas_reales > 0 else None)
                    or prod_full.cantidad_producida or 0
                ) or 1.0
                lote_exist = db.query(LoteProductoTerminado).filter(
                    LoteProductoTerminado.produccion_id == produccion_id,
                    LoteProductoTerminado.tipo == "tapas",
                ).first()
                if not lote_exist:
                    lote = LoteProductoTerminado(
                        producto_id=prod_full.receta_version.producto.id,
                        produccion_id=prod_full.id,
                        numero_lote=prod_full.numero_lote_produccion or f"TAPAS-MOB-{produccion_id}",
                        cantidad_inicial=tapas_cant,
                        cantidad_actual=tapas_cant,
                        cantidad_libre=tapas_cant,
                        fecha_produccion=datetime.utcnow(),
                        fecha_vencimiento=datetime.utcnow() + timedelta(days=5),
                        tipo="tapas",
                        activo=True,
                    )
                    db.add(lote)
                    prod.cantidad_producida = tapas_cant
                    # BUG 2 FIX: Reducir lote de masa origen (toda la masa fue convertida en tapas)
                    if prod_full.lote_origen_id:
                        lote_masa = db.query(LoteProductoTerminado).filter(
                            LoteProductoTerminado.id == prod_full.lote_origen_id,
                            LoteProductoTerminado.tipo == "masa",
                        ).first()
                        if lote_masa and lote_masa.cantidad_actual > 0:
                            lote_masa.cantidad_actual = 0

    # ── Armado ────────────────────────────────────────────────────────────────
    elif prod.tipo_produccion == "armado" and prod.receta_version_id:
        prod_full = db.query(Produccion).options(
            _jl(Produccion.receta_version).joinedload(RecetaVersion.producto)
        ).filter(Produccion.id == produccion_id).first()
        if prod_full and prod_full.receta_version and prod_full.receta_version.producto:
            cant = body.cantidad if body and body.cantidad and body.cantidad > 0 else None
            if not cant:
                cant = float(prod_full.cantidad_producida or 0)
            if not cant and prod_full.lote_origen_id:
                lote_tapas = db.query(LoteProductoTerminado).filter(
                    LoteProductoTerminado.id == prod_full.lote_origen_id
                ).first()
                if lote_tapas:
                    cant = float(prod_full.tapas_teoricas or lote_tapas.cantidad_actual or 0)
            cant = cant or 1.0
            dias_venc = (body.dias_vencimiento if body and body.dias_vencimiento and body.dias_vencimiento > 0 else None) or 30
            numero = prod_full.numero_lote_produccion or f"ALF-MOB-{produccion_id}"
            lote_exist = db.query(LoteProductoTerminado).filter(
                LoteProductoTerminado.produccion_id == produccion_id,
                LoteProductoTerminado.tipo == "alfajor",
            ).first()
            if not lote_exist:
                lote = LoteProductoTerminado(
                    producto_id=prod_full.receta_version.producto.id,
                    produccion_id=prod_full.id,
                    numero_lote=numero,
                    cantidad_inicial=cant,
                    cantidad_actual=cant,
                    fecha_produccion=datetime.utcnow(),
                    fecha_vencimiento=datetime.utcnow() + timedelta(days=dias_venc),
                    tipo="alfajor",
                    activo=True,
                )
                db.add(lote)
                prod.cantidad_producida = cant
                # BUG 3 FIX: Reducir lote de tapas origen
                if prod_full.lote_origen_id:
                    lote_tapas = db.query(LoteProductoTerminado).filter(
                        LoteProductoTerminado.id == prod_full.lote_origen_id,
                        LoteProductoTerminado.tipo == "tapas",
                    ).first()
                    if lote_tapas:
                        tapas_usadas = float(prod_full.tapas_teoricas or cant or 0)
                        if tapas_usadas > 0:
                            lote_tapas.cantidad_actual = max(0.0, lote_tapas.cantidad_actual - tapas_usadas)
                        else:
                            lote_tapas.cantidad_actual = 0
            else:
                if body and body.cantidad and body.cantidad > 0:
                    lote_exist.cantidad_actual = body.cantidad
                    lote_exist.cantidad_inicial = body.cantidad
                    prod.cantidad_producida = body.cantidad

    db.commit()
    return {"ok": True, "mensaje": f"Producción #{produccion_id} finalizada"}


# ── Configuración de producción (horno + mano de obra) ───────────────────────

class ConfigProduccionBody(BaseModel):
    precio_hora_mano_obra: float | None = None
    horno_nombre: str | None = None
    horno_potencia_kw: float | None = None
    horno_precio_kwh: float | None = None


@router.put("/api/config")
def set_config(data: ConfigProduccionBody, db: Session = Depends(get_db)):
    """Actualiza configuración de producción."""
    cfg = db.query(ConfiguracionProduccion).filter(ConfiguracionProduccion.id == 1).first()
    if not cfg:
        cfg = ConfiguracionProduccion(id=1, precio_hora_mano_obra=0.0)
        db.add(cfg)
        db.flush()

    if data.precio_hora_mano_obra is not None:
        cfg.precio_hora_mano_obra = data.precio_hora_mano_obra

    # Crear o actualizar horno si se pasaron datos
    if data.horno_nombre or data.horno_potencia_kw is not None:
        horno = db.query(Horno).filter(Horno.id == cfg.horno_activo_id).first() if cfg.horno_activo_id else None
        if not horno:
            horno = Horno(nombre=data.horno_nombre or "Horno", activo=True)
            db.add(horno)
            db.flush()
            cfg.horno_activo_id = horno.id
        if data.horno_nombre:
            horno.nombre = data.horno_nombre
        if data.horno_potencia_kw is not None:
            horno.potencia_kw = data.horno_potencia_kw
        if data.horno_precio_kwh is not None:
            horno.precio_kwh = data.horno_precio_kwh

    db.commit()
    return {"ok": True}


# ── Resumen de costos por producción ─────────────────────────────────────────

@router.get("/api/{produccion_id}/costo-resumen")
def costo_resumen(produccion_id: int, db: Session = Depends(get_db)):
    """Desglose completo de costos: MP, electricidad, mano de obra, por unidad y docena."""
    prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not prod:
        raise HTTPException(404, "Producción no encontrada")

    unidades = prod.unidades_envasadas or prod.cantidad_producida or 0
    docenas = unidades / 12 if unidades else 0

    # Desglose de MP
    usos = db.query(ProduccionInsumo).filter(ProduccionInsumo.produccion_id == produccion_id).all()
    desglose_mp = []
    for u in usos:
        nombre = costo_comp = None
        if u.lote_insumo:
            nombre = u.lote_insumo.insumo.nombre
        elif u.lote_producto:
            nombre = u.lote_producto.producto.nombre
        if nombre:
            subtotal = round(u.cantidad_usada * u.costo_unitario, 2)
            desglose_mp.append({"nombre": nombre, "costo": subtotal})

    # Calcular electricidad teórica si hay horno configurado
    electricidad_teorica = None
    cfg = db.query(ConfiguracionProduccion).filter(ConfiguracionProduccion.id == 1).first()
    if cfg and cfg.horno_activo_id and prod.horas_horno_total:
        horno = db.query(Horno).filter(Horno.id == cfg.horno_activo_id).first()
        if horno and horno.potencia_kw and horno.precio_kwh:
            electricidad_teorica = round(prod.horas_horno_total * horno.potencia_kw * horno.precio_kwh, 2)

    costo_mp = round(prod.costo_total_insumos or 0, 2)
    costo_elec = round(prod.costo_electricidad or electricidad_teorica or 0, 2)
    costo_mo = round(prod.costo_mano_obra or 0, 2)
    costo_total = round(costo_mp + costo_elec + costo_mo, 2)

    costo_por_unidad = round(costo_total / unidades, 4) if unidades else 0
    costo_por_docena = round(costo_total / docenas, 2) if docenas else 0

    # Margen vs precio de venta del producto
    precio_venta = None
    margen_pct = None
    if prod.receta_version and prod.receta_version.producto:
        p = prod.receta_version.producto
        precio_venta = getattr(p, "precio_venta", None)
        if precio_venta and costo_por_unidad:
            margen_pct = round((1 - costo_por_unidad / precio_venta) * 100, 1)

    # Desperdicios
    desperdicios = {
        "masa_desperdiciada_g": prod.masa_desperdiciada_g,
        "tapas_crudas_rotas": prod.tapas_crudas_rotas,
        "tapas_rotas": prod.tapas_rotas,
        "alfajores_rotos_bano": prod.alfajores_rotos_bano,
        "alfajores_rotos_empaque": prod.alfajores_rotos_empaque,
        "chocolate_no_recuperado_g": prod.chocolate_no_recuperado_g,
    }

    return {
        "lote": prod.numero_lote_produccion,
        "tipo": prod.tipo_produccion,
        "estado": prod.estado,
        "unidades": unidades,
        "costo_mp": costo_mp,
        "costo_electricidad": costo_elec,
        "electricidad_teorica": electricidad_teorica,
        "costo_mano_obra": costo_mo,
        "costo_total": costo_total,
        "costo_por_unidad": costo_por_unidad,
        "costo_por_docena": costo_por_docena,
        "precio_venta": precio_venta,
        "margen_pct": margen_pct,
        "desglose_mp": desglose_mp,
        "horas_horno": prod.horas_horno_total,
        "horas_mano_obra": prod.horas_mano_obra,
        "desperdicios": desperdicios,
    }


@router.delete("/api/{produccion_id}/registros-tapas/{registro_id}")
def eliminar_registro_tapas(produccion_id: int, registro_id: int, db: Session = Depends(get_db)):
    prod = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not prod or prod.estado == "finalizada":
        raise HTTPException(400, "No se puede modificar")
    reg = db.query(RegistroTapas).filter(
        RegistroTapas.id == registro_id,
        RegistroTapas.produccion_id == produccion_id,
    ).first()
    if not reg:
        raise HTTPException(404, "Registro no encontrado")
    db.delete(reg)

    # Recalcular totales
    remaining = db.query(RegistroTapas).filter(
        RegistroTapas.produccion_id == produccion_id,
        RegistroTapas.id != registro_id,
    ).all()
    prod.tapas_reales = sum(r.tapas_ok for r in remaining)
    prod.tapas_rotas  = sum(r.tapas_rotas for r in remaining)
    desp = sum(r.masa_desperdiciada_g for r in remaining if r.masa_desperdiciada_g)
    prod.masa_desperdiciada_g = desp if desp > 0 else None

    db.commit()
    return {"ok": True}


