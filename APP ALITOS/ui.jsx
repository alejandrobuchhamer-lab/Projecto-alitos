/* ===================== ALITO'S · UI primitives ===================== */
const { useState, useEffect, useRef, useCallback } = React;

/* ---------- Phone frame (dark) ---------- */
function Phone({ children }) {
  const W = 390,H = 844;
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      const s = Math.min((window.innerWidth - 48) / W, (window.innerHeight - 48) / H, 1);
      setScale(s);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}>
      <div style={{
        width: W, height: H, borderRadius: 52, background: "#1a1a1a",
        padding: 11, boxShadow: "0 50px 110px -30px rgba(0,0,0,0.85), 0 0 0 1px #2a2a2a, inset 0 0 0 2px #0a0a0a",
        position: "relative"
      }}>
        <div style={{
          width: "100%", height: "100%", borderRadius: 42, overflow: "hidden",
          position: "relative", background: "var(--bg)"
        }}>
          {/* status bar */}
          <div style={{
            height: 44, display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 26px 0 30px", position: "absolute", top: 0, left: 0, right: 0, zIndex: 50,
            color: "var(--txt)", fontSize: 14, fontWeight: 650, pointerEvents: "none"
          }}>
            <span className="tabular">9:41</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1" /><rect x="4.5" y="4.5" width="3" height="7.5" rx="1" /><rect x="9" y="2" width="3" height="10" rx="1" /><rect x="13.5" y="0" width="3" height="12" rx="1" opacity="0.4" /></svg>
              <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.5c2 0 3.8.8 5.2 2.1l1.2-1.3A9.4 9.4 0 0 0 8 .7 9.4 9.4 0 0 0 1.6 3.3l1.2 1.3A7.4 7.4 0 0 1 8 2.5Z" /><path d="M8 6c1 0 2 .4 2.7 1.1l1.3-1.3A5.6 5.6 0 0 0 8 4a5.6 5.6 0 0 0-4 1.8l1.3 1.3A3.8 3.8 0 0 1 8 6Z" opacity="0.9" /><circle cx="8" cy="9.7" r="1.6" /></svg>
              <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" opacity="0.5" /><rect x="2" y="2" width="16" height="8" rx="1.5" fill="currentColor" /><rect x="23" y="4" width="1.5" height="4" rx="0.7" fill="currentColor" opacity="0.5" /></svg>
            </div>
          </div>
          {/* dynamic island */}
          <div style={{
            position: "absolute", top: 11, left: "50%", transform: "translateX(-50%)",
            width: 110, height: 30, borderRadius: 18, background: "#000", zIndex: 60
          }} />
          {/* screen content */}
          <div style={{ position: "absolute", inset: 0, paddingTop: 44, display: "flex", flexDirection: "column" }}>
            {children}
          </div>
        </div>
      </div>
    </div>);

}

/* ---------- App bar ---------- */
function AppBar({ title, sub, onBack, leftLogo, right, avatar, userName }) {
  return (
    <div className="appbar" style={{ padding: "52px 16px 12px" }}>
      {onBack &&
      <button className="ab-action" onClick={onBack}><Icon name="back" size={18} /></button>
      }

      <div className="grow" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
        <div className="ab-word" style={{ fontSize: 40, lineHeight: 0.7, height: 38, display: "flex", alignItems: "center" }}>Alito's</div>
      </div>
      {avatar &&
      <div className="ab-avatar" style={{ background: avatar.color }} onClick={avatar.onClick} title={avatar.onClick ? "Tocá para salir" : undefined}>{avatar.txt}</div>
      }
      {right}
    </div>);

}

/* ---------- Bottom nav ---------- */
function BotNav({ items, value, onChange }) {
  return (
    <div className="botnav">
      {items.map((it) =>
      <button key={it.id} className={"botnav-item" + (value === it.id ? " active" : "")}
      onClick={() => onChange(it.id)}>
          <div className="ni-ico">
            <Icon name={it.icon} size={22} sw={value === it.id ? 2.3 : 2} />
            {it.badge ? <span className="ni-badge">{it.badge}</span> : null}
          </div>
          <span className="ni-label">{it.label}</span>
        </button>
      )}
    </div>);

}

/* ---------- Bottom sheet ---------- */
function Sheet({ open, onClose, icon, title, sub, children, foot }) {
  return (
    <React.Fragment>
      <div className={"sheet-scrim" + (open ? " open" : "")} onClick={onClose} />
      <div className={"sheet" + (open ? " open" : "")}>
        <div className="sheet-grab" />
        {title &&
        <div className="sheet-head">
            {icon && <div className="sh-ico"><Icon name={icon} size={20} /></div>}
            <div className="grow">
              <div className="sheet-title">{title}</div>
              {sub && <div className="sheet-sub">{sub}</div>}
            </div>
            <button className="sheet-x" onClick={onClose}>✕</button>
          </div>
        }
        <div className="sheet-body">{children}</div>
        {foot && <div className="sheet-foot">{foot}</div>}
      </div>
    </React.Fragment>);

}

/* ---------- Toast ---------- */
const ToastCtx = React.createContext(() => {});
function ToastHost({ apiRef }) {
  const [list, setList] = useState([]);
  const push = useCallback((msg, kind = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setList((l) => [...l, { id, msg, kind }]);
    setTimeout(() => setList((l) => l.map((t) => t.id === id ? { ...t, out: true } : t)), 2400);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 2750);
  }, []);
  useEffect(() => {if (apiRef) apiRef.current = push;}, [apiRef, push]);
  const C = { ok: "var(--green)", info: "var(--blue)", warn: "var(--amber-bright)", err: "var(--red)" };
  const I = { ok: "check", info: "info", warn: "alert", err: "alert" };
  const SOFT = { ok: "var(--green-soft)", info: "var(--blue-soft)", warn: "var(--amber-soft)", err: "var(--red-soft)" };
  return (
    <div className="toast-host">
      {list.map((t) =>
      <div key={t.id} className={"toast" + (t.out ? " out" : "")} style={{ borderLeftColor: C[t.kind] }}>
          <div className="t-ico" style={{ background: SOFT[t.kind], color: C[t.kind] }}>
            <Icon name={I[t.kind]} size={14} sw={2.6} />
          </div>
          <span>{t.msg}</span>
        </div>
      )}
    </div>);

}

/* ---------- Mobile map ---------- */
function streetGrid() {
  let lines = "";
  for (let i = 1; i < 9; i++) lines += `<line x1="0" y1="${i * 11.5}" x2="100" y2="${i * 11.5}" />`;
  for (let i = 1; i < 9; i++) lines += `<line x1="${i * 11.5}" y1="0" x2="${i * 11.5}" y2="100" />`;
  return `
  <svg class="mmap-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
    <defs><linearGradient id="mb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#11140f"/><stop offset="1" stop-color="#0a0c08"/></linearGradient></defs>
    <rect width="100" height="100" fill="url(#mb)"/>
    <rect x="6" y="56" width="20" height="16" rx="1.5" fill="#13180f"/>
    <rect x="66" y="10" width="22" height="14" rx="1.5" fill="#13180f"/>
    <g stroke="#1c1d16" stroke-width="0.5">${lines}</g>
    <g stroke="#24251c" stroke-width="1.6" stroke-linecap="round"><line x1="0" y1="34" x2="100" y2="46"/><line x1="38" y1="0" x2="50" y2="100"/></g>
    <path d="M0,82 Q30,74 55,86 T100,80" stroke="#1a2433" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.7"/>
  </svg>`;
}
function MiniMap({ places, drivers, selected, onSelect, onSelectDriver, legend = true }) {
  return (
    <div className="mmap">
      <div dangerouslySetInnerHTML={{ __html: streetGrid() }} />
      {legend &&
      <div className="mlegend">
          <div className="li"><span className="sw" style={{ background: "var(--green)" }} /> Vigente</div>
          <div className="li"><span className="sw" style={{ background: "var(--red)" }} /> Por vencer</div>
          <div className="li"><span className="sw" style={{ background: "var(--blue)" }} /> Repartidor</div>
        </div>
      }
      {places.map((p) =>
      <div key={p.id} className={"mk" + (selected === p.id ? " sel" : "")}
      style={{ left: p.x + "%", top: p.y + "%" }}
      onClick={() => onSelect && onSelect(p)}>
          <div className={"mk-dot " + (p.type === "ok" ? "green" : "red")}><Icon name="store" size={13} /></div>
        </div>
      )}
      {(drivers || []).map((d, i) =>
      <div key={"d" + i} className="mk" style={{ left: d.x + "%", top: d.y + "%" }}
      onClick={() => onSelectDriver && onSelectDriver(d)}>
          <div className="mk-driver" />
        </div>
      )}
    </div>);

}

/* ---------- Money input hook helper ---------- */
function fmtMoney(v) {
  const digits = String(v).replace(/\D/g, "");
  return digits ? (+digits).toLocaleString("es-AR") : "";
}
function parseMoney(v) {return +String(v).replace(/\D/g, "") || 0;}

/* ---------- Avatar ---------- */
function Ava({ v, size = 42, circ = true, badge }) {
  return (
    <div className="l-ava" style={{
      background: v.color, width: size, height: size,
      borderRadius: circ ? "50%" : 13, fontSize: size * 0.32
    }}>
      {v.avatar}
      {badge}
    </div>);

}

Object.assign(window, { Phone, AppBar, BotNav, Sheet, ToastHost, ToastCtx, MiniMap, fmtMoney, parseMoney, Ava });