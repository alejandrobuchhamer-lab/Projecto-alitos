/* ===================== ALITO'S · Notificaciones (resto → admin) ===================== */
const { useState: nUseState } = React;

/* Store en memoria — se llena desde SSE en tiempo real */
let _NOTIFS = [];
let _nid = 1;
const NOTIF_LISTENERS = new Set();
function getNotifs() { return _NOTIFS; }
function notifUnread() { return _NOTIFS.filter(n => !n.read).length; }
function pushNotif(n) {
  const d = new Date();
  _NOTIFS = [{ id: _nid++, time: String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"), read: false, ...n }, ..._NOTIFS];
  NOTIF_LISTENERS.forEach(fn => fn());
}
function markNotifsRead() { _NOTIFS = _NOTIFS.map(n => ({ ...n, read: true })); NOTIF_LISTENERS.forEach(fn => fn()); }

const NOTIF_META = {
  venta:   { icon: "cart",     color: "var(--green)",        soft: "var(--green-soft)" },
  cobro:   { icon: "cash",     color: "var(--green)",        soft: "var(--green-soft)" },
  pedido:  { icon: "list",     color: "var(--amber-bright)", soft: "var(--amber-soft)" },
  prod:    { icon: "factory",  color: "var(--blue)",         soft: "var(--blue-soft)" },
  negocio: { icon: "store",    color: "var(--purple)",       soft: "var(--purple-soft)" },
};

/* Hook: re-render cuando llegan notificaciones */
function useNotifs() {
  const [, bump] = nUseState(0);
  React.useEffect(() => {
    const fn = () => bump(x => x + 1);
    NOTIF_LISTENERS.add(fn);
    return () => NOTIF_LISTENERS.delete(fn);
  }, []);
  return { notifs: getNotifs(), unread: notifUnread() };
}

/* Campana para el AppBar */
function NotifBell({ unread, onClick }) {
  return (
    <button className="ab-action" onClick={onClick}>
      <Icon name="bell" size={19} />
      {unread > 0 && <span className="ab-count">{unread > 9 ? "9+" : unread}</span>}
    </button>
  );
}

/* Sheet de notificaciones */
function NotifSheet({ open, onClose }) {
  const notifs = getNotifs();
  return (
    <Sheet open={open} onClose={onClose} icon="bell" title="Notificaciones" sub="Movimientos del equipo en tiempo real">
      <div className="stack gap-8">
        {notifs.length === 0 && <div className="empty"><Icon name="bell" size={40} /><div>Sin novedades</div></div>}
        {notifs.map(n => {
          const m = NOTIF_META[n.kind] || NOTIF_META.venta;
          return (
            <div key={n.id} className="notif" style={{ opacity: n.read ? 0.62 : 1 }}>
              {!n.read && <span className="notif-unread" />}
              <div className="notif-ico" style={{ background: m.soft, color: m.color }}><Icon name={m.icon} size={17} /></div>
              <div className="grow">
                <div className="notif-title">{n.title}</div>
                <div className="notif-sub">{n.sub}</div>
                <div className="notif-meta"><span className="ava" style={{ background: n.color, width: 15, height: 15, fontSize: 8, borderRadius: "50%", display: "inline-grid" }}>{n.who.split(" ").map(w => w[0]).join("").slice(0, 2)}</span>{n.who} · {n.time} hs</div>
              </div>
              {n.amount ? <div className={"notif-amt " + (n.dir === "in" ? "in" : "")}>{n.dir === "in" ? "+" : ""}{ARS(n.amount)}</div> : null}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

/* Convierte un evento SSE del backend en una notificación */
function sseEventToNotif(e) {
  const now = new Date();
  const time = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  const who = e.vendedor_nombre || "Sistema";
  const color = "#c47820";

  if (e.tipo === "venta") {
    return {
      kind: "venta", who, color, dir: "in",
      title: `${who} registró una venta`,
      sub: `${e.cliente || "CF"} · ${e.cantidad || ""} u.`,
      amount: e.monto || 0, time,
    };
  }
  if (e.tipo === "pago") {
    return {
      kind: "cobro", who, color, dir: "in",
      title: `${who} completó un cobro`,
      sub: `${e.cliente || "CF"} · ${e.forma_pago || "efectivo"}`,
      amount: e.monto || 0, time,
    };
  }
  if (e.tipo === "pedido") {
    return {
      kind: "pedido", who, color, dir: "info",
      title: `${who} tomó un pedido`,
      sub: `${e.cliente || e.lugar || "CF"} · ${e.unidades || 0} u.`,
      amount: e.monto || 0, time,
    };
  }
  if (e.tipo === "stock") {
    return {
      kind: "prod", who, color: "#46b97a", dir: "info",
      title: "Stock asignado",
      sub: `Actualización de inventario`, time,
    };
  }
  return null;
}

Object.assign(window, { getNotifs, notifUnread, pushNotif, markNotifsRead, NOTIF_META, useNotifs, NotifBell, NotifSheet, sseEventToNotif });
