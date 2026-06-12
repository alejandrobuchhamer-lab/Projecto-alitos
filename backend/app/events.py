"""
SSE broadcaster — tiempo real para la app móvil.
Los route handlers llaman broadcast_event("tipo") de forma síncrona.
El endpoint /api/events empuja los eventos a los clientes conectados.
"""
import time
import json
import asyncio
from collections import deque
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

router = APIRouter(tags=["events"])

# Deque thread-safe: append es atómico en CPython
_EVENTS: deque = deque(maxlen=200)


def broadcast_event(tipo: str, data: dict | None = None) -> None:
    """Llamar desde cualquier route handler sync para notificar a los clientes SSE."""
    _EVENTS.appendleft({"t": time.time(), "tipo": tipo, **(data or {})})


@router.get("/api/events")
async def sse_stream(request: Request, since: float = 0):
    """
    Server-Sent Events — la app se conecta aquí y recibe push cuando hay cambios.
    since=<timestamp unix> para recibir solo eventos posteriores a esa marca.
    """
    async def stream():
        last_t = since if since else time.time()
        # Evento de conexión confirmada
        yield f"data: {json.dumps({'tipo': 'connected'})}\n\n"
        while True:
            if await request.is_disconnected():
                break
            nuevos = [e for e in _EVENTS if e["t"] > last_t]
            if nuevos:
                last_t = nuevos[0]["t"]
                for e in nuevos:
                    yield f"data: {json.dumps(e)}\n\n"
            await asyncio.sleep(0.3)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
