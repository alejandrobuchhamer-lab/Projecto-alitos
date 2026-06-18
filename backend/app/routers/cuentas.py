from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.cuenta import Cuenta, MovimientoCuenta
from app.models.usuario import Usuario
from app.routers.auth import permiso, require_user
from app.templates import templates

router = APIRouter(prefix="/cuentas", tags=["cuentas"])


# ── Página principal ──────────────────────────────────────────────────────────

@router.get("/", response_class=HTMLResponse)
def cuentas_index(request: Request, db: Session = Depends(get_db), _u: Usuario = Depends(permiso("finanzas"))):
    return templates.TemplateResponse("cuentas/index.html", {"request": request})


# ── API ───────────────────────────────────────────────────────────────────────

@router.get("/api/cuentas")
def listar_cuentas(db: Session = Depends(get_db)):
    cuentas = db.query(Cuenta).filter(Cuenta.activo == True).all()
    result = []
    for c in cuentas:
        entradas = db.query(func.coalesce(func.sum(MovimientoCuenta.monto), 0)).filter(
            MovimientoCuenta.cuenta_id == c.id,
            MovimientoCuenta.tipo == "entrada"
        ).scalar() or 0
        salidas = db.query(func.coalesce(func.sum(MovimientoCuenta.monto), 0)).filter(
            MovimientoCuenta.cuenta_id == c.id,
            MovimientoCuenta.tipo == "salida"
        ).scalar() or 0
        transferencias_out = db.query(func.coalesce(func.sum(MovimientoCuenta.monto), 0)).filter(
            MovimientoCuenta.cuenta_id == c.id,
            MovimientoCuenta.tipo == "transferencia"
        ).scalar() or 0
        transferencias_in = db.query(func.coalesce(func.sum(MovimientoCuenta.monto), 0)).filter(
            MovimientoCuenta.cuenta_destino_id == c.id,
            MovimientoCuenta.tipo == "transferencia"
        ).scalar() or 0
        saldo = c.saldo_inicial + entradas - salidas - transferencias_out + transferencias_in
        movimientos = db.query(MovimientoCuenta).filter(
            MovimientoCuenta.cuenta_id == c.id
        ).order_by(MovimientoCuenta.fecha.desc()).limit(50).all()
        result.append({
            "id": c.id, "nombre": c.nombre, "tipo": c.tipo,
            "color": c.color, "saldo": round(saldo, 2),
            "saldo_inicial": c.saldo_inicial,
            "movimientos": [{
                "id":        m.id,
                "fecha":     m.fecha.strftime("%d/%m/%Y %H:%M"),
                "tipo":      m.tipo,
                "monto":     m.monto,
                "concepto":  m.concepto,
                "descripcion": m.referencia or "",
            } for m in movimientos],
        })
    return result


@router.post("/api/cuentas", status_code=201)
def crear_cuenta(data: dict, db: Session = Depends(get_db), _u: Usuario = Depends(permiso("finanzas"))):
    c = Cuenta(
        nombre=data["nombre"], tipo=data.get("tipo", "efectivo"),
        saldo_inicial=data.get("saldo_inicial", 0),
        color=data.get("color", "#c47820"),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "nombre": c.nombre}


@router.get("/api/movimientos")
def listar_movimientos(
    cuenta_id: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    q = db.query(MovimientoCuenta).order_by(MovimientoCuenta.fecha.desc())
    if cuenta_id:
        q = q.filter(
            (MovimientoCuenta.cuenta_id == cuenta_id) |
            (MovimientoCuenta.cuenta_destino_id == cuenta_id)
        )
    movs = q.limit(limit).all()
    cuentas = {c.id: c for c in db.query(Cuenta).all()}
    return [{
        "id":             m.id,
        "fecha":          m.fecha.strftime("%d/%m/%Y %H:%M"),
        "tipo":           m.tipo,
        "monto":          m.monto,
        "concepto":       m.concepto,
        "referencia":     m.referencia,
        "cuenta":         cuentas[m.cuenta_id].nombre if m.cuenta_id in cuentas else "—",
        "cuenta_destino": cuentas[m.cuenta_destino_id].nombre if m.cuenta_destino_id and m.cuenta_destino_id in cuentas else None,
        "notas":          m.notas,
    } for m in movs]


@router.post("/api/movimientos", status_code=201)
def registrar_movimiento(data: dict, db: Session = Depends(get_db), user: Usuario = Depends(require_user)):
    cuenta_id = data.get("cuenta_id")
    if not cuenta_id:
        raise HTTPException(400, "cuenta_id requerido")
    cuenta = db.query(Cuenta).filter(Cuenta.id == cuenta_id).first()
    if not cuenta:
        raise HTTPException(404, "Cuenta no encontrada")
    tipo = data.get("tipo", "entrada")
    monto = data.get("monto")
    if monto is None:
        raise HTTPException(400, "monto requerido")
    if tipo == "transferencia" and not data.get("cuenta_destino_id"):
        raise HTTPException(400, "Transferencia requiere cuenta destino")
    m = MovimientoCuenta(
        fecha=datetime.fromisoformat(data["fecha"]) if data.get("fecha") else datetime.utcnow(),
        cuenta_id=cuenta_id,
        tipo=tipo,
        monto=float(monto),
        concepto=data.get("concepto") or "Sin concepto",
        referencia=data.get("referencia"),
        cuenta_destino_id=data.get("cuenta_destino_id"),
        creado_por_id=user.id,
        notas=data.get("notas"),
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"id": m.id, "ok": True}


@router.delete("/api/movimientos/{mov_id}")
def eliminar_movimiento(mov_id: int, db: Session = Depends(get_db), _u: Usuario = Depends(permiso("finanzas"))):
    m = db.query(MovimientoCuenta).filter(MovimientoCuenta.id == mov_id).first()
    if not m:
        raise HTTPException(404, "Movimiento no encontrado")
    db.delete(m)
    db.commit()
    return {"ok": True}
