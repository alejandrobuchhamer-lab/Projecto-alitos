/* ===================== ALITO'S · Root (usuario → huella → su vista) ===================== */
const { useState: rUseState, useRef: rUseRef, useEffect: rUseEffect } = React;

/* Entrada suave de la app (robusta: termina visible aunque la transición no corra) */
function AppEnter({ children }) {
  const [shown, setShown] = rUseState(false);
  rUseEffect(() => { const id = setTimeout(() => setShown(true), 30); return () => clearTimeout(id); }, []);
  return (
    <div style={{ position: "absolute", inset: 0,
      opacity: shown ? 1 : 0,
      transform: shown ? "none" : "scale(1.06)",
      filter: shown ? "none" : "blur(10px)",
      transition: "opacity 0.6s ease, transform 0.6s cubic-bezier(0.2,0.7,0.3,1), filter 0.6s ease" }}>
      {children}
    </div>);
}

/* ---------- 1º · Elegí tu usuario (cuentas creadas por el admin) ---------- */
function UserPicker({ onPick }) {
  const [users, setUsers] = rUseState([]);
  const [loading, setLoading] = rUseState(true);
  const [error, setError] = rUseState(false);

  function cargar() {
    setLoading(true);
    setError(false);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch(API_BASE + "/api/mobile/usuarios", { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setUsers(data || []); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); })
      .finally(() => clearTimeout(timer));
  }

  rUseEffect(() => { cargar(); }, []);

  return (
    <div className="up">
      <div className="up-head">
        <div className="up-word">Alito's</div>
        <div className="up-tag">Gestión de fábrica</div>
      </div>
      <div className="up-prompt">Elegí tu usuario para ingresar</div>
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--txt-3)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div>Conectando…</div>
        </div>
      )}
      {!loading && error && (
        <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--txt-3)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
          <div style={{ marginBottom: 16 }}>No se pudo conectar al servidor</div>
          <button onClick={cargar} style={{ background: "var(--accent,#c47820)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: "0.9rem", cursor: "pointer" }}>Reintentar</button>
        </div>
      )}
      {!loading && !error && (
        <div className="up-list">
          {users.map((u) =>
            <div className="ucard" key={u.id} onClick={() => onPick(u)}>
              <div className="uc-ava" style={{
                background: u.foto ? `url(${u.foto}) center/cover no-repeat` : (u.color || "#c47820"),
              }}>
                {!u.foto && (u.avatar || u.first?.[0] || u.nombre?.[0] || "?")}
                <span className="uc-badge" style={{ background: u.iconColor || "#c47820" }}>
                  <Icon name={u.icon || "user"} size={11} sw={2.4} />
                </span>
              </div>
              <div className="grow">
                <div className="uc-name">{u.name || u.nombre}</div>
                <div className="uc-role">{u.roleLabel || u.rol}</div>
              </div>
              <Icon name="chevR" size={20} style={{ color: "var(--txt-3)" }} />
            </div>
          )}
        </div>
      )}
      <div className="up-note">Las cuentas y sus permisos se crean desde el panel del <b>Administrador</b>.<br />Cada usuario entra directo a su vista asignada.</div>
    </div>);
}

/* ---------- 2º · Ingreso con huella + contraseña ---------- */
function Fingerprint({ user, onAuthed, onBack }) {
  const [state, setState] = rUseState("idle"); // idle | scanning | ok | leaving | error
  const [pass, setPass]   = rUseState("");
  const [errMsg, setErrMsg] = rUseState("");
  const passRef = rUseRef(null);

  async function scan() {
    if (state !== "idle" && state !== "error") return;
    if (!pass) { passRef.current?.focus(); setErrMsg("Ingresá tu contraseña"); return; }
    setState("scanning");
    setErrMsg("");
    try {
      const username = user.username || user.name?.toLowerCase().replace(" ", "");
      await loginAndSetupPush(username, pass);
      setState("ok");
      setTimeout(() => setState("leaving"), 700);
      setTimeout(() => onAuthed(), 1600);
    } catch(e) {
      setState("error");
      setErrMsg("Contraseña incorrecta");
      setPass("");
      setTimeout(() => setState("idle"), 1500);
    }
  }

  function handleKey(e) { if (e.key === "Enter") scan(); }

  const busy  = state === "ok" || state === "leaving";
  const label = state === "scanning" ? "Verificando…"
              : state === "error"    ? "Contraseña incorrecta"
              : busy                 ? `¡Hola, ${user.first}!`
              :                        "Ingresá tu contraseña y tocá la huella";
  return (
    <div className={"fpscreen" + (state === "leaving" ? " leaving" : "")}>
      <div className="fps-hero">
        <div className={"fps-word" + (busy ? " zoom" : "")}>Alito's</div>
        <div className="fps-user">
          <div className="fu-ava" style={{ background: user.color || "#c47820" }}>
            {user.avatar || user.first?.[0] || "?"}
          </div>
          <div>
            <div className="fu-name">{user.name || user.nombre}</div>
            <div className="fu-role">{user.roleLabel || user.rol}</div>
          </div>
        </div>
      </div>
      <div className="fps-panel">
        {!busy && (
          <input
            ref={passRef}
            type="password"
            placeholder="Contraseña"
            value={pass}
            onChange={e => { setPass(e.target.value); setErrMsg(""); }}
            onKeyDown={handleKey}
            style={{
              background: "var(--c2,#1e1e1e)", border: "1px solid var(--brdr,#2e2e2e)",
              borderRadius: 10, color: "#fff", fontSize: "1rem", padding: "10px 14px",
              width: "100%", marginBottom: 12, textAlign: "center", outline: "none",
              boxSizing: "border-box",
            }}
          />
        )}
        <div
          className={"fp " + (state === "scanning" ? "scanning" : busy ? "ok" : state === "error" ? "error" : "")}
          onClick={scan}
          style={{ cursor: busy ? "default" : "pointer" }}
        >
          <div className="fp-ring" />
          <div className="fp-sweep" />
          {busy ? <Icon name="check" size={50} sw={2.4} /> : <Icon name="fingerprint" size={50} sw={1.8} />}
        </div>
        <div className={"fp-label " + (state === "scanning" ? "scanning" : busy ? "ok" : state === "error" ? "error" : "")}>
          {label}
        </div>
        {errMsg && !busy && (
          <div style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: 4 }}>{errMsg}</div>
        )}
        {!busy && <div className="auth-alt" onClick={onBack}>← Cambiar de usuario</div>}
      </div>
    </div>);
}

/* Ejecuta un cambio de fase con shared-element transition (si el navegador lo soporta) */
function withVT(fn) {
  if (document.startViewTransition) {
    document.startViewTransition(() => { ReactDOM.flushSync(fn); });
  } else { fn(); }
}

function Root() {
  const [phase, setPhase] = rUseState("users"); // users → fp → app
  const [user, setUser] = rUseState(null);
  const toastApi = rUseRef(() => {});
  const toast = (msg, kind) => toastApi.current(msg, kind);

  function pickUser(u) { withVT(() => { setUser(u); setPhase("fp"); }); }
  function enterApp() { setPhase("app"); }
  function backToUsers() { withVT(() => setPhase("users")); }
  function logout() { logoutUser(); setUser(null); setPhase("users"); }

  let app = null;
  if (user) {
    if (user.view === "admin") app = <AdminApp onLogout={logout} user={user} />;else
    if (user.view === "vendedor") app = <VendorApp onLogout={logout} user={user} />;else
    if (user.view === "produccion") app = <ProduccionApp onLogout={logout} user={user} />;
  }

  return (
    <ToastCtx.Provider value={toast}>
      <Phone>
        {phase === "users" && <UserPicker onPick={pickUser} />}
        {phase === "fp" && <Fingerprint user={user} onAuthed={enterApp} onBack={backToUsers} />}
        {phase === "app" && <AppEnter>{app}</AppEnter>}
        <ToastHost apiRef={toastApi} />
      </Phone>
    </ToastCtx.Provider>);
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
