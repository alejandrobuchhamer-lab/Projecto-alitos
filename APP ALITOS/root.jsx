/* ===================== ALITO'S · Root (login → huella → app) ===================== */
const { useState: rUseState, useRef: rUseRef, useEffect: rUseEffect } = React;

/* Entrada suave de la app */
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

/* ---------- Pantalla de login con usuario + contraseña + recordarme ---------- */
function LoginForm({ onAuthed, prefillUser }) {
  const [username, setUsername] = rUseState(prefillUser?.username || "");
  const [pass, setPass]         = rUseState("");
  const [remember, setRemember] = rUseState(false);
  const [state, setState]       = rUseState("idle"); // idle | loading | bio | ok | error
  const [errMsg, setErrMsg]     = rUseState("");
  const passRef = rUseRef(null);

  async function doLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!username.trim()) { setErrMsg("Ingresá tu usuario"); return; }
    if (!pass) { setErrMsg("Ingresá tu contraseña"); passRef.current?.focus(); return; }
    setState("loading");
    setErrMsg("");
    try {
      const data = await loginAndSetupPush(username.trim(), pass);

      if (remember) {
        setState("bio");
        try {
          await triggerBiometric("Registrá tu huella para ingresar más rápido la próxima vez");
          saveRememberedUser({
            id: data.user_id, username: data.username,
            nombre: data.nombre, rol: data.rol,
            view: data.rol === "admin" ? "admin" : data.rol === "produccion" ? "produccion" : "vendedor",
            color: "#c47820", avatar: data.nombre.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase(),
          });
        } catch(bioErr) {
          // Si rechaza la huella o no hay sensor, igual entra sin recordar
          clearRememberedUser();
        }
      }

      setState("ok");
      setTimeout(() => onAuthed({
        id: data.user_id, username: data.username, nombre: data.nombre, rol: data.rol,
        view: data.rol === "admin" ? "admin" : data.rol === "produccion" ? "produccion" : "vendedor",
        first: data.nombre.split(" ")[0],
        color: "#c47820",
        avatar: data.nombre.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase(),
        must_change_password: data.must_change_password,
      }), 600);
    } catch(err) {
      setState("error");
      setErrMsg("Usuario o contraseña incorrectos");
      setPass("");
      setTimeout(() => setState("idle"), 1800);
    }
  }

  const busy = state === "loading" || state === "bio" || state === "ok";
  const bioMsg = state === "bio" ? "Escaneá tu huella para recordarte…" : null;
  const okMsg  = state === "ok"  ? "Ingresando…" : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 28px" }}>
      <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: -3, color: "var(--amber-bright)", marginBottom: 4 }}>Alito's</div>
      <div style={{ fontSize: 12, color: "var(--txt-3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 40 }}>Sistema de Gestión</div>

      <form onSubmit={doLogin} style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--txt-3)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Usuario</label>
          <input
            type="text" autoComplete="username" autoCapitalize="none"
            value={username} onChange={e => { setUsername(e.target.value); setErrMsg(""); }}
            disabled={busy}
            style={{ width: "100%", padding: "13px 16px", background: "var(--c2,#1e1e1e)", border: "1px solid var(--brdr,#2e2e2e)", borderRadius: 12, color: "#fff", fontSize: "1rem", outline: "none", boxSizing: "border-box" }}
            placeholder="tu usuario"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--txt-3)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Contraseña / PIN</label>
          <input
            ref={passRef}
            type="password" autoComplete="current-password" inputMode="numeric"
            value={pass} onChange={e => { setPass(e.target.value); setErrMsg(""); }}
            disabled={busy}
            style={{ width: "100%", padding: "13px 16px", background: "var(--c2,#1e1e1e)", border: "1px solid var(--brdr,#2e2e2e)", borderRadius: 12, color: "#fff", fontSize: "1rem", outline: "none", boxSizing: "border-box", letterSpacing: 4 }}
            placeholder="••••••"
          />
        </div>

        {/* Recordarme */}
        <div
          onClick={() => !busy && setRemember(r => !r)}
          style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, cursor: "pointer", userSelect: "none" }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: remember ? "var(--amber-bright,#c47820)" : "transparent",
            border: `2px solid ${remember ? "var(--amber-bright,#c47820)" : "var(--brdr,#2e2e2e)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}>
            {remember && <Icon name="check" size={13} sw={3} style={{ color: "#000" }} />}
          </div>
          <span style={{ fontSize: 13, color: "var(--txt-2,#a3a3a3)" }}>Recordarme con huella dactilar</span>
        </div>

        {errMsg && (
          <div style={{ color: "#ef4444", fontSize: 13, textAlign: "center", marginBottom: 12 }}>{errMsg}</div>
        )}
        {bioMsg && (
          <div style={{ color: "var(--amber-bright)", fontSize: 13, textAlign: "center", marginBottom: 12 }}>{bioMsg}</div>
        )}
        {okMsg && (
          <div style={{ color: "#22c55e", fontSize: 13, textAlign: "center", marginBottom: 12 }}>{okMsg}</div>
        )}

        <button
          type="submit" disabled={busy}
          style={{
            width: "100%", padding: "14px", borderRadius: 12, border: "none",
            background: busy ? "var(--brdr,#2e2e2e)" : "var(--amber-bright,#c47820)",
            color: busy ? "var(--txt-3)" : "#000",
            fontWeight: 800, fontSize: "1rem", cursor: busy ? "default" : "pointer",
            transition: "all 0.15s",
          }}>
          {state === "loading" ? "Verificando…" : state === "bio" ? "Registrando huella…" : state === "ok" ? "¡Ingresando!" : "Ingresar"}
        </button>
      </form>
    </div>);
}

/* ---------- Pantalla de login con huella (usuario recordado) ---------- */
function BiometricLogin({ savedUser, onAuthed, onForgetUser }) {
  const [state, setState]   = rUseState("idle"); // idle | scanning | ok | error | fallback
  const [pass, setPass]     = rUseState("");
  const [errMsg, setErrMsg] = rUseState("");
  const passRef = rUseRef(null);

  rUseEffect(() => {
    // Intentar auto-scan al abrir la pantalla
    setTimeout(() => doScan(), 400);
  }, []);

  async function doScan() {
    if (state !== "idle" && state !== "error") return;
    setState("scanning");
    setErrMsg("");
    try {
      await triggerBiometric("Ingresá a Alito's");
      // Huella OK — verificar que el token siga válido
      if (isLoggedIn()) {
        setState("ok");
        setTimeout(() => onAuthed(savedUser), 600);
      } else {
        // Token expiró → pedir contraseña
        setState("fallback");
      }
    } catch(e) {
      setState("error");
      setErrMsg("No se pudo verificar la huella");
      setTimeout(() => setState("idle"), 1800);
    }
  }

  async function doPasswordFallback(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!pass) return;
    setState("scanning");
    setErrMsg("");
    try {
      const data = await loginAndSetupPush(savedUser.username, pass);
      setState("ok");
      setTimeout(() => onAuthed({
        ...savedUser,
        must_change_password: data.must_change_password,
      }), 600);
    } catch {
      setState("fallback");
      setErrMsg("Contraseña incorrecta");
      setPass("");
    }
  }

  const busy = state === "ok" || state === "scanning";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 28px" }}>
      <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: -3, color: "var(--amber-bright)", marginBottom: 40 }}>Alito's</div>

      {/* Avatar del usuario */}
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: savedUser.color || "#c47820",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24, fontWeight: 800, color: "#fff",
        marginBottom: 12,
      }}>{savedUser.avatar || savedUser.nombre?.[0] || "?"}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{savedUser.nombre}</div>
      <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 36, textTransform: "uppercase", letterSpacing: 1 }}>{savedUser.rol}</div>

      {state === "fallback" ? (
        <form onSubmit={doPasswordFallback} style={{ width: "100%", maxWidth: 300 }}>
          <div style={{ fontSize: 12, color: "var(--txt-3)", textAlign: "center", marginBottom: 14 }}>Ingresá tu contraseña para continuar</div>
          <input
            ref={passRef} type="password" inputMode="numeric"
            value={pass} onChange={e => { setPass(e.target.value); setErrMsg(""); }}
            style={{ width: "100%", padding: "13px 16px", background: "var(--c2,#1e1e1e)", border: "1px solid var(--brdr,#2e2e2e)", borderRadius: 12, color: "#fff", fontSize: "1rem", outline: "none", boxSizing: "border-box", letterSpacing: 4, marginBottom: 12 }}
            placeholder="••••••" autoFocus
          />
          {errMsg && <div style={{ color: "#ef4444", fontSize: 12, textAlign: "center", marginBottom: 10 }}>{errMsg}</div>}
          <button type="submit" style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: "var(--amber-bright,#c47820)", color: "#000", fontWeight: 800, fontSize: "1rem", cursor: "pointer" }}>
            Ingresar
          </button>
        </form>
      ) : (
        <>
          {/* Botón de huella */}
          <div
            className={"fp " + (state === "scanning" ? "scanning" : state === "ok" ? "ok" : state === "error" ? "error" : "")}
            onClick={doScan}
            style={{ cursor: busy ? "default" : "pointer", marginBottom: 16 }}
          >
            <div className="fp-ring" />
            <div className="fp-sweep" />
            {state === "ok" ? <Icon name="check" size={50} sw={2.4} /> : <Icon name="fingerprint" size={50} sw={1.8} />}
          </div>
          <div className={"fp-label " + (state === "scanning" ? "scanning" : state === "ok" ? "ok" : state === "error" ? "error" : "")}>
            {state === "scanning" ? "Escaneando…" : state === "ok" ? "¡Verificado!" : state === "error" ? errMsg || "Intentá de nuevo" : "Tocá para ingresar con huella"}
          </div>
          {!busy && (
            <div style={{ fontSize: 12, color: "var(--txt-3)", marginTop: 8, cursor: "pointer" }}
              onClick={() => setState("fallback")}>
              Usar contraseña
            </div>
          )}
        </>
      )}

      {!busy && (
        <div style={{ position: "absolute", bottom: 40, fontSize: 12, color: "var(--txt-3)", cursor: "pointer" }}
          onClick={onForgetUser}>
          No soy {savedUser.nombre.split(" ")[0]} · Cambiar usuario
        </div>
      )}
    </div>);
}

/* ---------- Pantalla de cambio de PIN obligatorio ---------- */
function CambiarPin({ user, onDone }) {
  const [pin, setPin]       = rUseState("");
  const [confirm, setConfirm] = rUseState("");
  const [state, setState]   = rUseState("idle");
  const [err, setErr]       = rUseState("");

  async function guardar() {
    if (!/^\d{6}$/.test(pin)) { setErr("El PIN debe tener 6 dígitos"); return; }
    if (pin !== confirm) { setErr("Los PINs no coinciden"); return; }
    setState("loading");
    setErr("");
    try {
      await apiPost("/api/mobile/cambiar_pin", { nuevo_pin: pin });
      setState("ok");
      setTimeout(onDone, 800);
    } catch(e) {
      setState("idle");
      setErr("Error al guardar. Intentá de nuevo.");
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 28px" }}>
      <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: -3, color: "var(--amber-bright)", marginBottom: 8 }}>Alito's</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Creá tu PIN personal</div>
      <div style={{ fontSize: 13, color: "var(--txt-3)", marginBottom: 32, textAlign: "center" }}>Elegí un PIN de 6 dígitos para acceder a la app</div>

      <div style={{ width: "100%", maxWidth: 300 }}>
        <input type="password" inputMode="numeric" maxLength={6}
          value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g,"")); setErr(""); }}
          style={{ width: "100%", padding: "14px", background: "var(--c2,#1e1e1e)", border: "1px solid var(--brdr,#2e2e2e)", borderRadius: 12, color: "#fff", fontSize: "1.4rem", textAlign: "center", letterSpacing: 8, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
          placeholder="Nuevo PIN" />
        <input type="password" inputMode="numeric" maxLength={6}
          value={confirm} onChange={e => { setConfirm(e.target.value.replace(/\D/g,"")); setErr(""); }}
          style={{ width: "100%", padding: "14px", background: "var(--c2,#1e1e1e)", border: "1px solid var(--brdr,#2e2e2e)", borderRadius: 12, color: "#fff", fontSize: "1.4rem", textAlign: "center", letterSpacing: 8, outline: "none", boxSizing: "border-box", marginBottom: 16 }}
          placeholder="Confirmá el PIN" />
        {err && <div style={{ color: "#ef4444", fontSize: 12, textAlign: "center", marginBottom: 12 }}>{err}</div>}
        <button onClick={guardar} disabled={state === "loading" || state === "ok"}
          style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "var(--amber-bright,#c47820)", color: "#000", fontWeight: 800, fontSize: "1rem", cursor: "pointer" }}>
          {state === "loading" ? "Guardando…" : state === "ok" ? "¡Listo!" : "Guardar PIN"}
        </button>
      </div>
    </div>);
}

/* Shared-element transition helper */
function withVT(fn) {
  if (document.startViewTransition) {
    document.startViewTransition(() => { ReactDOM.flushSync(fn); });
  } else { fn(); }
}

function Root() {
  // Detectar si hay usuario recordado
  const [phase, setPhase] = rUseState(() => getRememberedUser() ? "biometric" : "login");
  const [user, setUser]   = rUseState(null);
  const toastApi = rUseRef(() => {});
  const toast = (msg, kind) => toastApi.current(msg, kind);

  function enterApp(u) {
    setUser(u);
    if (u.must_change_password) {
      withVT(() => setPhase("cambiar_pin"));
    } else {
      withVT(() => setPhase("app"));
    }
  }

  function forgetUser() {
    clearRememberedUser();
    clearToken();
    withVT(() => setPhase("login"));
  }

  function logout() {
    logoutUser();
    setUser(null);
    withVT(() => setPhase("login"));
  }

  const savedUser = getRememberedUser();

  let app = null;
  if (user) {
    if (user.view === "admin") app = <AdminApp onLogout={logout} user={user} />;
    else if (user.view === "vendedor") app = <VendorApp onLogout={logout} user={user} />;
    else if (user.view === "produccion") app = <ProduccionApp onLogout={logout} user={user} />;
  }

  return (
    <ToastCtx.Provider value={toast}>
      <Phone>
        {phase === "login"    && <LoginForm onAuthed={enterApp} />}
        {phase === "biometric" && savedUser && (
          <BiometricLogin savedUser={savedUser} onAuthed={enterApp} onForgetUser={forgetUser} />
        )}
        {phase === "cambiar_pin" && user && (
          <CambiarPin user={user} onDone={() => withVT(() => setPhase("app"))} />
        )}
        {phase === "app" && <AppEnter>{app}</AppEnter>}
        <ToastHost apiRef={toastApi} />
      </Phone>
    </ToastCtx.Provider>);
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
