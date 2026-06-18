from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.receta import RecetaVersion
from app.models.produccion import Produccion, ProduccionInsumo, EstadoProduccion
from app.models.producto import LoteProductoTerminado
from app.services.stock_service import consumir_stock_fefo, consumir_stock_producto_fefo


def _extraer_iniciales(nombre: str) -> str:
    omitir = {"alfajor", "de", "con", "al", "a", "y", "el", "la", "los", "las"}
    palabras = nombre.split()
    iniciales = [p[0].upper() for p in palabras if p.lower() not in omitir and p]
    return "".join(iniciales) or "XX"


# ── Numeración de lotes legible ─────────────────────────────────────────────
# Formato: MASA-2026-001 → TAPAS-2026-001 → ALF-2026-001
# El número secuencial se hereda a lo largo de la cadena masa→tapas→alfajor
# para mantener trazabilidad inmediata leyendo el código.

def _yymmdd(fecha: datetime) -> str:
    return fecha.strftime("%y%m%d")

def _julian(fecha: datetime) -> int:
    return fecha.timetuple().tm_yday

def _sabor(producto_nombre: str) -> str:
    """Extrae el sabor del nombre del producto eliminando la palabra 'alfajor'."""
    nombre = producto_nombre.strip()
    if nombre.lower().startswith("alfajor"):
        nombre = nombre[7:].strip()
    return nombre.upper().replace(" ", "_") if nombre else "CLASICO"


# ── Numeración de lotes legible ─────────────────────────────────────────────
# Formato: {Julian}-{yymmdd}-MASA-{SABOR}
# Ejemplo: 169-260618-MASA-CHOCOLATE
# Tapas y alfajor heredan la misma raíz para trazabilidad inmediata.

def _numero_lote_masa(db: Session, producto_nombre: str, fecha: datetime) -> str:
    return f"{_julian(fecha)}-{_yymmdd(fecha)}-MASA-{_sabor(producto_nombre)}"

def _numero_lote_tapas(numero_masa: str) -> str:
    """169-260618-MASA-CHOCOLATE → 169-260618-TAPAS-CHOCOLATE"""
    return numero_masa.replace("-MASA-", "-TAPAS-", 1)

def _numero_lote_armado(numero_tapas: str) -> str:
    """169-260618-TAPAS-CHOCOLATE → 169-260618-ALF-CHOCOLATE"""
    return numero_tapas.replace("-TAPAS-", "-ALF-", 1)

def _seq_produccion(db: Session, tipo: str, año: int) -> int:
    return db.query(Produccion).filter(
        Produccion.tipo_produccion == tipo,
        Produccion.fecha_inicio >= datetime(año, 1, 1),
        Produccion.fecha_inicio < datetime(año + 1, 1, 1),
    ).count() + 1


def generar_numero_lote_producto(db: Session, producto_id: int) -> str:
    count = db.query(LoteProductoTerminado).filter(
        LoteProductoTerminado.producto_id == producto_id
    ).count() + 1
    fecha = datetime.utcnow().strftime("%Y%m%d")
    return f"LP-{producto_id:03d}-{fecha}-{count:04d}"


def calcular_tapas_teoricas(receta, masa_kg: float | None = None) -> float | None:
    """Estima tapas teóricas desde rendimiento_esperado de la receta."""
    return receta.rendimiento_esperado


def _gramos_a_unidad(gramos: float, unidad: str) -> float:
    """Convierte gramos a la unidad nativa del insumo."""
    u = (unidad or "").lower()
    if u == "kg":
        return gramos / 1000.0
    elif u == "g":
        return gramos
    elif u in ("litro", "l"):
        return gramos / 1000.0
    elif u == "ml":
        return gramos
    return gramos / 1000.0


def iniciar_produccion(
    db: Session,
    receta_version_id: int,
    operario: str | None = None,
    notas: str | None = None,
    tipo_produccion: str = "general",
    peso_masa_total_g: float | None = None,
    peso_tapa_objetivo_g: float | None = None,
    peso_tapa_min_g: float | None = None,
    peso_tapa_max_g: float | None = None,
    lote_origen_id: int | None = None,
    cantidad_recetas: float = 1.0,
    cantidad_tapas_a_usar: int | None = None,
) -> Produccion:
    receta = db.query(RecetaVersion).filter(RecetaVersion.id == receta_version_id).first()
    if not receta:
        raise ValueError(f"Receta versión {receta_version_id} no encontrada")
    if not receta.activo:
        raise ValueError("La receta seleccionada no está activa")

    if tipo_produccion == "tapas" and not lote_origen_id:
        raise ValueError("Las tapas requieren un lote de masa de origen. Creá un lote de masa primero.")

    # Armado: descontamos tapas del lote origen inmediatamente
    if tipo_produccion == "armado":
        ahora = datetime.utcnow()
        julian = _julian(ahora)

        if lote_origen_id:
            lote_tapas = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id == lote_origen_id).first()
            if not lote_tapas:
                raise ValueError("Lote de tapas no encontrado")
            if cantidad_tapas_a_usar and cantidad_tapas_a_usar > 0:
                if lote_tapas.cantidad_actual < cantidad_tapas_a_usar:
                    raise ValueError(f"Stock insuficiente: hay {int(lote_tapas.cantidad_actual)} tapas disponibles")
                lote_tapas.cantidad_actual -= cantidad_tapas_a_usar
            # Heredar julian del lote de masa origen de las tapas
            tapas_prod = lote_tapas.produccion
            if tapas_prod and tapas_prod.lote_origen_id:
                lote_masa = db.query(LoteProductoTerminado).filter(
                    LoteProductoTerminado.id == tapas_prod.lote_origen_id
                ).first()
                if lote_masa and lote_masa.produccion:
                    julian = _julian(lote_masa.produccion.fecha_inicio)

        # Número de lote: hereda de tapas → 169-260618-ALF-CHOCOLATE
        numero_tapas = None
        if lote_origen_id:
            lt = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id == lote_origen_id).first()
            if lt and lt.produccion:
                numero_tapas = lt.produccion.numero_lote_produccion
        if numero_tapas and "-TAPAS-" in numero_tapas:
            numero_lote_arm = _numero_lote_armado(numero_tapas)
        else:
            numero_lote_arm = f"{_julian(ahora)}-{_yymmdd(ahora)}-ALF-{_sabor(receta.producto.nombre)}"

        produccion = Produccion(
            receta_version_id=receta_version_id,
            numero_lote_produccion=numero_lote_arm,
            estado=EstadoProduccion.en_proceso,
            operario=operario,
            notas=notas,
            tipo_produccion="armado",
            lote_origen_id=lote_origen_id,
            tapas_teoricas=float(cantidad_tapas_a_usar) if cantidad_tapas_a_usar else None,
        )
        db.add(produccion)
        db.flush()
        return produccion

    escala = max(cantidad_recetas, 0.01)

    # Verificar stock disponible antes de consumir.
    # Para tapas: solo se verifica el lote de masa (producto_terminado); los insumos crudos
    # ya fueron consumidos en la etapa de masa, no se vuelven a verificar ni consumir.
    for ingrediente in receta.ingredientes:
        if tipo_produccion == "tapas" and ingrediente.tipo_ingrediente != "producto_terminado":
            continue
        cantidad_necesaria = ingrediente.cantidad * escala
        if ingrediente.tipo_ingrediente == "producto_terminado":
            from app.models.producto import ProductoTerminado
            lotes = db.query(LoteProductoTerminado).filter(
                LoteProductoTerminado.producto_id == ingrediente.producto_terminado_id,
                LoteProductoTerminado.activo == True,
                LoteProductoTerminado.cantidad_actual > 0,
            ).all()
            stock_disponible = sum(l.cantidad_actual for l in lotes)
            if stock_disponible < cantidad_necesaria:
                pt = db.query(ProductoTerminado).filter(ProductoTerminado.id == ingrediente.producto_terminado_id).first()
                nombre = pt.nombre if pt else f"Producto #{ingrediente.producto_terminado_id}"
                raise ValueError(
                    f"Stock insuficiente de '{nombre}': "
                    f"necesario {cantidad_necesaria:.2f} {ingrediente.unidad_medida}, "
                    f"disponible {stock_disponible:.2f}"
                )
        else:
            from app.models.insumo import LoteInsumo
            lotes = db.query(LoteInsumo).filter(
                LoteInsumo.insumo_id == ingrediente.insumo_id,
                LoteInsumo.activo == True,
                LoteInsumo.cantidad_actual > 0,
            ).all()
            stock_disponible = sum(l.cantidad_actual for l in lotes)
            if stock_disponible < cantidad_necesaria:
                raise ValueError(
                    f"Stock insuficiente para '{ingrediente.insumo.nombre}': "
                    f"necesario {cantidad_necesaria:.2f} {ingrediente.unidad_medida}, "
                    f"disponible {stock_disponible:.2f}"
                )

    tapas_teoricas = None
    if tipo_produccion in ("tapas", "masa"):
        if peso_masa_total_g and peso_tapa_objetivo_g and peso_tapa_objetivo_g > 0:
            tapas_teoricas = round(peso_masa_total_g / peso_tapa_objetivo_g, 1)
        else:
            tapas_teoricas = calcular_tapas_teoricas(receta)

    # Número de lote: {Julian}-{yymmdd}-{TIPO}-{SABOR}, herencia en cadena
    ahora = datetime.utcnow()
    if tipo_produccion == "masa":
        numero_lote = _numero_lote_masa(db, receta.producto.nombre, ahora)
    elif tipo_produccion == "tapas" and lote_origen_id:
        lote_masa = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id == lote_origen_id).first()
        numero_masa = lote_masa.produccion.numero_lote_produccion if lote_masa and lote_masa.produccion else None
        if numero_masa and "-MASA-" in numero_masa:
            numero_lote = _numero_lote_tapas(numero_masa)
        else:
            numero_lote = f"{_julian(ahora)}-{_yymmdd(ahora)}-TAPAS-{_sabor(receta.producto.nombre)}"
    else:
        numero_lote = f"{_julian(ahora)}-{_yymmdd(ahora)}-PROD-{_sabor(receta.producto.nombre)}"

    produccion = Produccion(
        receta_version_id=receta_version_id,
        numero_lote_produccion=numero_lote,
        estado=EstadoProduccion.en_proceso,
        operario=operario,
        notas=notas,
        tipo_produccion=tipo_produccion,
        peso_masa_total_g=peso_masa_total_g,
        peso_tapa_objetivo_g=peso_tapa_objetivo_g,
        peso_tapa_min_g=peso_tapa_min_g,
        peso_tapa_max_g=peso_tapa_max_g,
        tapas_teoricas=tapas_teoricas,
        tapas_por_hornada=80,
        minutos_por_hornada=6,
        lote_origen_id=lote_origen_id,
        cantidad_recetas=escala,
    )
    db.add(produccion)
    db.flush()

    # Para tapas: solo consumir el lote de masa (producto_terminado); los insumos crudos
    # ya fueron descontados en la producción de masa.
    costo_total = 0.0
    for ingrediente in receta.ingredientes:
        if tipo_produccion == "tapas" and ingrediente.tipo_ingrediente != "producto_terminado":
            continue
        cantidad_necesaria = ingrediente.cantidad * escala
        if ingrediente.tipo_ingrediente == "producto_terminado":
            consumos = consumir_stock_producto_fefo(db, ingrediente.producto_terminado_id, cantidad_necesaria)
            for consumo in consumos:
                uso = ProduccionInsumo(
                    produccion_id=produccion.id,
                    lote_producto_id=consumo["lote"].id,
                    cantidad_usada=consumo["cantidad_consumida"],
                    costo_unitario=consumo["costo_unitario"],
                )
                db.add(uso)
                costo_total += consumo["cantidad_consumida"] * consumo["costo_unitario"]
        else:
            consumos = consumir_stock_fefo(db, ingrediente.insumo_id, cantidad_necesaria)
            for consumo in consumos:
                uso = ProduccionInsumo(
                    produccion_id=produccion.id,
                    lote_insumo_id=consumo["lote"].id,
                    cantidad_usada=consumo["cantidad_consumida"],
                    costo_unitario=consumo["costo_unitario"],
                )
                db.add(uso)
                costo_total += consumo["cantidad_consumida"] * consumo["costo_unitario"]

    produccion.costo_total_insumos = costo_total
    db.flush()
    return produccion


def finalizar_armado(
    db: Session,
    produccion_id: int,
    cantidad_producida: float,
    notas: str | None = None,
    dias_vencimiento: int | None = None,
    horas_mano_obra: float | None = None,
    alfajores_rotos_bano: int | None = None,
    alfajores_rotos_empaque: int | None = None,
    chocolate_no_recuperado_g: float | None = None,
) -> LoteProductoTerminado:
    """Consume insumos y tapas registrados, cierra la producción y crea el lote de alfajores."""
    from app.models.produccion import ProduccionTacho
    from app.models.insumo import Insumo, LoteInsumo

    produccion = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not produccion:
        raise ValueError(f"Producción {produccion_id} no encontrada")
    if produccion.tipo_produccion != "armado":
        raise ValueError("Esta función solo aplica a producciones de tipo armado")
    if produccion.estado == EstadoProduccion.finalizada:
        raise ValueError("Esta producción ya fue finalizada")

    tachos = db.query(ProduccionTacho).filter(ProduccionTacho.produccion_id == produccion_id).all()
    if not tachos:
        raise ValueError("No hay componentes registrados. Registrá las tapas e insumos antes de finalizar.")
    tapas_registradas = [t for t in tachos if t.tipo == "tapas" and t.cantidad_tapas]
    if not tapas_registradas:
        raise ValueError("No hay tapas registradas. Sin tapas no se pueden armar alfajores — agregá al menos un lote de tapas.")

    costo_total = 0.0

    # --- Tapas (producto terminado) ---
    for t in [x for x in tachos if x.tipo == "tapas"]:
        if not t.lote_producto_id or not t.cantidad_tapas:
            continue
        from app.models.producto import LoteProductoTerminado
        lote = db.query(LoteProductoTerminado).filter(LoteProductoTerminado.id == t.lote_producto_id).first()
        if not lote:
            continue
        consumir = min(lote.cantidad_actual, t.cantidad_tapas)
        lote.cantidad_actual -= consumir
        if lote.cantidad_actual <= 0:
            lote.activo = False
        uso = ProduccionInsumo(
            produccion_id=produccion.id,
            lote_producto_id=lote.id,
            cantidad_usada=consumir,
            costo_unitario=lote.costo_unitario_calculado or 0.0,
        )
        db.add(uso)
        costo_total += consumir * (lote.costo_unitario_calculado or 0.0)

    db.flush()

    # --- Insumos (dulce, chocolate, etc.) ---
    for t in [x for x in tachos if x.tipo == "insumo"]:
        if not t.insumo_id or not t.gramos_usados:
            continue
        insumo = db.query(Insumo).filter(Insumo.id == t.insumo_id).first()
        if not insumo:
            continue
        cantidad_en_unidad = _gramos_a_unidad(t.gramos_usados, insumo.unidad_medida)

        if t.lote_insumo_id:
            lote = db.query(LoteInsumo).filter(LoteInsumo.id == t.lote_insumo_id).first()
            if lote:
                consumir = min(lote.cantidad_actual, cantidad_en_unidad)
                lote.cantidad_actual -= consumir
                if lote.cantidad_actual <= 0:
                    lote.activo = False
                uso = ProduccionInsumo(
                    produccion_id=produccion.id,
                    lote_insumo_id=lote.id,
                    cantidad_usada=consumir,
                    costo_unitario=lote.costo_unitario,
                )
                db.add(uso)
                costo_total += consumir * lote.costo_unitario
                db.flush()
        else:
            try:
                consumos = consumir_stock_fefo(db, t.insumo_id, cantidad_en_unidad)
                for c in consumos:
                    uso = ProduccionInsumo(
                        produccion_id=produccion.id,
                        lote_insumo_id=c["lote"].id,
                        cantidad_usada=c["cantidad_consumida"],
                        costo_unitario=c["costo_unitario"],
                    )
                    db.add(uso)
                    costo_total += c["cantidad_consumida"] * c["costo_unitario"]
            except ValueError:
                # Stock insuficiente — registrar sin deducción (stock ficticio)
                uso = ProduccionInsumo(
                    produccion_id=produccion.id,
                    lote_insumo_id=None,
                    cantidad_usada=cantidad_en_unidad,
                    costo_unitario=0.0,
                )
                db.add(uso)

    db.flush()

    # --- Cerrar producción ---
    produccion.cantidad_producida = cantidad_producida
    produccion.costo_total_insumos = costo_total
    produccion.fecha_fin = datetime.utcnow()
    produccion.estado = EstadoProduccion.finalizada
    if notas:
        produccion.notas = notas
    if horas_mano_obra is not None:
        produccion.horas_mano_obra = horas_mano_obra
    if alfajores_rotos_bano is not None:
        produccion.alfajores_rotos_bano = alfajores_rotos_bano
    if alfajores_rotos_empaque is not None:
        produccion.alfajores_rotos_empaque = alfajores_rotos_empaque
    if chocolate_no_recuperado_g is not None:
        produccion.chocolate_no_recuperado_g = chocolate_no_recuperado_g

    # Costos extra (mano de obra; electricidad no aplica en armado normalmente)
    _, costo_mo = _calcular_costos_extra(db, produccion, horas_mano_obra)
    produccion.costo_mano_obra = costo_mo
    produccion.costo_total_real = round(costo_total + costo_mo, 4)

    db.flush()

    # --- Crear lote de alfajores ---
    costo_unit = costo_total / cantidad_producida if cantidad_producida > 0 else 0.0
    producto = produccion.receta_version.producto
    dias = dias_vencimiento or producto.dias_vida_util
    fecha_venc = datetime.utcnow() + timedelta(days=dias) if dias else None

    lote_alfajor = LoteProductoTerminado(
        produccion_id=produccion.id,
        producto_id=producto.id,
        numero_lote=generar_numero_lote_producto(db, producto.id),
        cantidad_inicial=cantidad_producida,
        cantidad_actual=cantidad_producida,
        costo_unitario_calculado=costo_unit,
        fecha_produccion=datetime.utcnow(),
        fecha_vencimiento=fecha_venc,
        tipo="alfajor",
    )
    db.add(lote_alfajor)
    db.flush()
    return lote_alfajor


def _calcular_costos_extra(db: Session, produccion: "Produccion", horas_mano_obra: float | None) -> tuple[float, float]:
    """Calcula costo electricidad y mano de obra. Retorna (elec, mo)."""
    from app.models.produccion import ConfiguracionProduccion, Horno
    cfg = db.query(ConfiguracionProduccion).filter(ConfiguracionProduccion.id == 1).first()
    costo_elec = 0.0
    costo_mo = 0.0
    if cfg:
        # Electricidad: solo si hay horno asignado y horas de horno registradas
        if cfg.horno_activo_id and produccion.horas_horno_total:
            horno = db.query(Horno).filter(Horno.id == cfg.horno_activo_id).first()
            if horno and horno.potencia_kw and horno.precio_kwh:
                costo_elec = round(produccion.horas_horno_total * horno.potencia_kw * horno.precio_kwh, 4)
        # Mano de obra
        horas = horas_mano_obra or produccion.horas_mano_obra or 0
        if horas and cfg.precio_hora_mano_obra:
            costo_mo = round(horas * cfg.precio_hora_mano_obra, 4)
    return costo_elec, costo_mo


def finalizar_produccion(
    db: Session,
    produccion_id: int,
    cantidad_producida: float,
    notas: str | None = None,
    masa_real_g: float | None = None,
    pesos_muestra_json: str | None = None,
    tapas_reales: int | None = None,
    tapas_rotas: int | None = None,
    peso_tapa_cruda_promedio_g: float | None = None,
    peso_tapa_cocida_promedio_g: float | None = None,
    masa_desperdiciada_g: float | None = None,
    tapas_por_hornada: int | None = None,
    minutos_por_hornada: int | None = None,
    horas_horno_total: float | None = None,
    horas_mano_obra: float | None = None,
    tapas_crudas_rotas: int | None = None,
) -> LoteProductoTerminado:
    produccion = db.query(Produccion).filter(Produccion.id == produccion_id).first()
    if not produccion:
        raise ValueError(f"Producción {produccion_id} no encontrada")
    if produccion.estado == EstadoProduccion.finalizada:
        raise ValueError("Esta producción ya fue finalizada")

    # Para tapas finalizadas desde el flujo de registros parciales, usar tapas_reales acumuladas
    if not cantidad_producida and produccion.tapas_reales:
        cantidad_producida = float(produccion.tapas_reales)

    produccion.cantidad_producida = cantidad_producida
    produccion.fecha_fin = datetime.utcnow()
    produccion.estado = EstadoProduccion.finalizada
    if notas:
        produccion.notas = notas
    # Datos masa
    if masa_real_g is not None: produccion.masa_real_g = masa_real_g
    if pesos_muestra_json is not None: produccion.pesos_muestra_json = pesos_muestra_json
    # Datos tapa
    if tapas_reales is not None: produccion.tapas_reales = tapas_reales
    if tapas_rotas is not None: produccion.tapas_rotas = tapas_rotas
    if peso_tapa_cruda_promedio_g is not None: produccion.peso_tapa_cruda_promedio_g = peso_tapa_cruda_promedio_g
    if peso_tapa_cocida_promedio_g is not None: produccion.peso_tapa_cocida_promedio_g = peso_tapa_cocida_promedio_g
    if masa_desperdiciada_g is not None: produccion.masa_desperdiciada_g = masa_desperdiciada_g
    if tapas_por_hornada is not None: produccion.tapas_por_hornada = tapas_por_hornada
    if minutos_por_hornada is not None: produccion.minutos_por_hornada = minutos_por_hornada
    if horas_horno_total is not None: produccion.horas_horno_total = horas_horno_total
    if horas_mano_obra is not None: produccion.horas_mano_obra = horas_mano_obra
    if tapas_crudas_rotas is not None: produccion.tapas_crudas_rotas = tapas_crudas_rotas

    # Calcular costos extra (electricidad y mano de obra)
    costo_elec, costo_mo = _calcular_costos_extra(db, produccion, horas_mano_obra)
    produccion.costo_electricidad = costo_elec
    produccion.costo_mano_obra = costo_mo
    produccion.costo_total_real = round((produccion.costo_total_insumos or 0) + costo_elec + costo_mo, 4)

    costo_unitario = produccion.costo_unitario
    producto = produccion.receta_version.producto

    fecha_vencimiento = None
    if producto.dias_vida_util:
        fecha_vencimiento = datetime.utcnow() + timedelta(days=producto.dias_vida_util)

    tipo_lote_map = {"masa": "masa", "tapas": "tapas", "armado": "alfajor", "general": "alfajor"}
    tipo_lote = tipo_lote_map.get(produccion.tipo_produccion, "alfajor")
    numero_lote = produccion.numero_lote_produccion

    # Para tapas: el lote puede existir ya (creado sesión a sesión) — no duplicar
    lote_producto = db.query(LoteProductoTerminado).filter(
        LoteProductoTerminado.produccion_id == produccion.id,
    ).first()

    if lote_producto:
        # Actualizar costo unitario calculado al cerrar
        lote_producto.costo_unitario_calculado = costo_unitario
        if fecha_vencimiento:
            lote_producto.fecha_vencimiento = fecha_vencimiento
    else:
        lote_producto = LoteProductoTerminado(
            produccion_id=produccion.id,
            producto_id=producto.id,
            numero_lote=numero_lote,
            cantidad_inicial=cantidad_producida,
            cantidad_actual=cantidad_producida,
            costo_unitario_calculado=costo_unitario,
            fecha_produccion=datetime.utcnow(),
            fecha_vencimiento=fecha_vencimiento,
            tipo=tipo_lote,
        )
        db.add(lote_producto)

    db.flush()
    return lote_producto
