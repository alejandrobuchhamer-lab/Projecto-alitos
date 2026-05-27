"""
Servicio de chat con IA (Claude) con memoria persistente en BD.
Usa httpx para llamar a la API de Anthropic directamente.
"""
import httpx
from datetime import datetime
from sqlalchemy.orm import Session
from app.config import settings
from app.models.conversacion_ia import MensajeIA
from app.services.analytics_service import get_contexto_negocio, contexto_a_texto

_SYSTEM_BASE = """Sos ALITO, el asistente de inteligencia artificial del sistema operativo de ALITOS Alfajores Premium.
Tu trabajo es ayudar al equipo de ALITOS con:
- Análisis de costos, márgenes y precios de venta
- Recomendaciones de producción basadas en stock y demanda
- Alertas sobre insumos, vencimientos y rentabilidad
- Consultas sobre el negocio, recetas y operaciones

Reglas:
- Respondé siempre en español rioplatense (Argentina), de forma clara y directa.
- Sé conciso: max 3-4 párrafos por respuesta salvo que pidan detalle.
- Cuando des recomendaciones de precios, usá ARS.
- Si no tenés datos suficientes para responder algo, decilo y pedí más info.
- Sos un asistente de negocio, no un chatbot genérico. Mantené foco en ALITOS.

{contexto}
"""

_HISTORIA_MAX = 20  # máx mensajes de historial que se envían a Claude


def _system_prompt(db: Session) -> str:
    ctx = get_contexto_negocio(db)
    return _SYSTEM_BASE.format(contexto=contexto_a_texto(ctx))


def get_historial(db: Session, session_id: str) -> list[dict]:
    mensajes = (
        db.query(MensajeIA)
        .filter(MensajeIA.session_id == session_id, MensajeIA.rol.in_(["user", "assistant"]))
        .order_by(MensajeIA.created_at.asc())
        .limit(_HISTORIA_MAX)
        .all()
    )
    return [{"role": m.rol, "content": m.contenido} for m in mensajes]


def _guardar_mensaje(db: Session, session_id: str, rol: str, contenido: str):
    db.add(MensajeIA(session_id=session_id, rol=rol, contenido=contenido))
    db.commit()


def chat(db: Session, session_id: str, mensaje_usuario: str) -> dict:
    """
    Procesa un mensaje, llama a Claude (si hay API key) y persiste la conversación.
    Retorna {"respuesta": str, "usa_ia": bool}.
    """
    _guardar_mensaje(db, session_id, "user", mensaje_usuario)

    historial = get_historial(db, session_id)
    # Quitar el último mensaje del usuario del historial para no duplicar
    messages_for_api = historial[:-1] if historial else []
    messages_for_api.append({"role": "user", "content": mensaje_usuario})

    if settings.anthropic_api_key:
        respuesta = _llamar_claude(db, session_id, messages_for_api)
        usa_ia = True
    else:
        respuesta = _respuesta_sin_clave(db, mensaje_usuario)
        usa_ia = False

    _guardar_mensaje(db, session_id, "assistant", respuesta)
    return {"respuesta": respuesta, "usa_ia": usa_ia}


def _llamar_claude(db: Session, session_id: str, messages: list[dict]) -> str:
    system = _system_prompt(db)
    try:
        resp = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-opus-4-7",
                "max_tokens": 1024,
                "system": system,
                "messages": messages,
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["content"][0]["text"]
    except httpx.HTTPStatusError as e:
        return f"Error al conectar con la IA: {e.response.status_code}. Verificá tu API key en el archivo .env"
    except Exception as e:
        return f"Error de conexión con la IA: {str(e)}"


def _respuesta_sin_clave(db: Session, mensaje: str) -> str:
    """Respuesta inteligente cuando no hay API key — usa datos reales del negocio."""
    from app.services.analytics_service import get_analisis_precios_insumos, get_lista_compras
    msg_lower = mensaje.lower()

    # ── Lista de compras ──────────────────────────────────────────────────────
    if any(w in msg_lower for w in ["compra", "comprar", "lista", "necesito", "pedir", "pedido", "reposicion", "reponer"]):
        lista = get_lista_compras(db)
        if not lista["urgentes"] and not lista["recomendados"]:
            return "✅ No hay insumos que requieran reposición urgente por ahora."
        lines = []
        if lista["urgentes"]:
            lines.append("🔴 **URGENTE — Comprar ahora:**")
            for it in lista["urgentes"]:
                prov = f" (proveedor: {it['ultimo_proveedor']})" if it["ultimo_proveedor"] else ""
                dias = f", quedan ~{it['dias_restantes']}d" if it["dias_restantes"] else ""
                precio = f" · ${it['ultimo_precio']:,.2f}/{it['unidad']}" if it["ultimo_precio"] else ""
                lines.append(f"• {it['nombre']}: stock {it['stock_actual']} / mín {it['stock_minimo']} {it['unidad']}{dias}{precio}{prov}")
                if it.get("cantidad_sugerida") and it["cantidad_sugerida"] > 0:
                    lines.append(f"  → Sugerido comprar: **{it['cantidad_sugerida']} {it['unidad']}** (~${it['costo_estimado']:,.0f})")
        if lista["recomendados"]:
            lines.append("\n🟡 **PRÓXIMAS 2 semanas:**")
            for it in lista["recomendados"]:
                dias = f"~{it['dias_restantes']}d" if it["dias_restantes"] else "sin datos"
                lines.append(f"• {it['nombre']}: quedan {dias} de stock — sugerido {it['cantidad_sugerida']} {it['unidad']}")
        if lista["total_estimado"] > 0:
            lines.append(f"\n💰 **Inversión estimada total: ${lista['total_estimado']:,.0f}**")
        return "\n".join(lines)

    # ── Comparar precios ──────────────────────────────────────────────────────
    if any(w in msg_lower for w in ["precio", "costo", "caro", "subi", "subio", "barato", "comparar", "proveedor"]):
        analisis = get_analisis_precios_insumos(db)
        lines = []
        subiendo = [a for a in analisis if a["tendencia"] == "sube"]
        bajando  = [a for a in analisis if a["tendencia"] == "baja"]
        if subiendo:
            lines.append("📈 **Insumos que subieron de precio:**")
            for a in subiendo[:5]:
                lines.append(f"• {a['insumo_nombre']}: ${a['precio_anterior']:,.2f} → ${a['precio_actual']:,.2f} (+{a['variacion_pct']:.1f}%)")
                if a.get("precios_por_proveedor"):
                    pass  # Could add provider comparison here
                lines.append(f"  ↳ {a['recomendacion']}")
        if bajando:
            lines.append("\n📉 **Insumos que bajaron:**")
            for a in bajando[:3]:
                lines.append(f"• {a['insumo_nombre']}: -{abs(a['variacion_pct']):.1f}% — {a['recomendacion']}")
        if not lines:
            lines.append("📊 Precios estables — sin variaciones significativas en los últimos lotes.")
        return "\n".join(lines)

    # ── Stock e inventario ────────────────────────────────────────────────────
    if any(w in msg_lower for w in ["stock", "falta", "queda", "inventario", "disponib"]):
        ctx = get_contexto_negocio(db)
        if ctx["insumos_criticos"]:
            items = "\n".join(f"• {i['nombre']}: {i['stock']:.1f} de {i['minimo']:.1f} mín" for i in ctx["insumos_criticos"])
            return f"⚠️ **Insumos bajo stock mínimo:**\n{items}\n\nUsá 'lista de compras' para ver qué pedir."
        return "✅ Todos los insumos están sobre el stock mínimo."

    # ── Ventas y márgenes ─────────────────────────────────────────────────────
    if any(w in msg_lower for w in ["venta", "vendio", "factur", "margen", "gananci"]):
        ctx = get_contexto_negocio(db)
        v = ctx["ventas_mes"]
        lines = [f"📊 **Últimos 30 días:**",
                 f"• Ventas: {v['cantidad']} transacciones",
                 f"• Facturado: ARS {v['total_ars']:,.0f}",
                 f"• Margen: {v['margen_pct']:.1f}%"]
        if ctx["top_productos"]:
            top = ", ".join(f"{p['nombre']} ({p['unidades']:.0f} u.)" for p in ctx["top_productos"])
            lines.append(f"• Top productos: {top}")
        return "\n".join(lines)

    # ── Producción ────────────────────────────────────────────────────────────
    if any(w in msg_lower for w in ["produc", "tapa", "hornada", "receta", "elabor"]):
        ctx = get_contexto_negocio(db)
        lista = get_lista_compras(db)
        lines = [f"🏭 **Producción del mes:** {ctx['producciones_mes']} lotes"]
        if lista["urgentes"]:
            lines.append(f"⚠️ Hay {len(lista['urgentes'])} insumo(s) bajo mínimo — revisá la lista de compras antes de producir.")
        else:
            lines.append("✅ Stock disponible para producir.")
        return "\n".join(lines)

    return (
        "¡Hola! Soy ALITO. Podés preguntarme:\n"
        "• **Lista de compras** — qué insumos necesitás reponer\n"
        "• **Precios** — qué subió, qué bajó, comparar proveedores\n"
        "• **Stock** — qué tenés disponible\n"
        "• **Ventas** — facturación y márgenes del mes\n"
        "• **Producción** — qué podés producir hoy\n\n"
        "⚙️ Para análisis IA avanzado, agregá `ANTHROPIC_API_KEY` en `backend/.env`"
    )


def limpiar_historial(db: Session, session_id: str) -> int:
    deleted = db.query(MensajeIA).filter(MensajeIA.session_id == session_id).delete()
    db.commit()
    return deleted
