import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.push_subscription import PushSubscription
from app.models.usuario import Usuario
from app.routers.auth import require_user
from app.config import settings

router = APIRouter(prefix="/api/push", tags=["push"])


@router.get("/vapid-key")
def get_vapid_key():
    return {"publicKey": settings.vapid_public_key}


@router.post("/subscribe")
def subscribe(data: dict, db: Session = Depends(get_db), user: Usuario = Depends(require_user)):
    endpoint = data.get("endpoint")
    keys     = data.get("keys", {})
    p256dh   = keys.get("p256dh")
    auth     = keys.get("auth")
    if not all([endpoint, p256dh, auth]):
        raise HTTPException(400, "Suscripción inválida")
    # Evitar duplicados por endpoint
    existing = db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).first()
    if existing:
        existing.activo = True
        existing.usuario_id = user.id
    else:
        db.add(PushSubscription(usuario_id=user.id, endpoint=endpoint, p256dh=p256dh, auth=auth))
    db.commit()
    return {"ok": True}


@router.delete("/unsubscribe")
def unsubscribe(data: dict, db: Session = Depends(get_db), user: Usuario = Depends(require_user)):
    endpoint = data.get("endpoint")
    sub = db.query(PushSubscription).filter(
        PushSubscription.endpoint == endpoint,
        PushSubscription.usuario_id == user.id,
    ).first()
    if sub:
        sub.activo = False
        db.commit()
    return {"ok": True}


# ── Función utilitaria para enviar push (usada desde otros módulos) ───────────

def enviar_push(db: Session, usuario_id: int | None, payload: dict, a_todos_admins: bool = False):
    """Envía push notification. Si usuario_id es None y a_todos_admins=True, envía a todos los admin."""
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        return  # pywebpush no instalado, skip silencioso

    if not settings.vapid_private_key or not settings.vapid_public_key:
        return

    query = db.query(PushSubscription).filter(PushSubscription.activo == True)
    if usuario_id:
        query = query.filter(PushSubscription.usuario_id == usuario_id)
    elif a_todos_admins:
        from app.models.usuario import Usuario
        admin_ids = [u.id for u in db.query(Usuario).filter(Usuario.rol == "admin", Usuario.activo == True).all()]
        query = query.filter(PushSubscription.usuario_id.in_(admin_ids))

    for sub in query.all():
        try:
            webpush(
                subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                data=json.dumps(payload),
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": f"mailto:{settings.vapid_email}"},
            )
        except Exception:
            pass
