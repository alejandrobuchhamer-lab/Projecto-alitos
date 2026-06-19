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

/* ---------- 0º · Splash de entrada ---------- */
function Intro({ onDone }) {
  rUseEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        @keyframes splash_rise {
          from { transform:translateY(14px); clip-path:inset(110% -10px -10px -10px); }
          to   { transform:translateY(0);    clip-path:inset(-30px -10px -10px -10px); }
        }
        @keyframes splash_fade {
          from { opacity:0; }
          to   { opacity:1; }
        }
        @keyframes dot_pulse {
          0%,100% { opacity:0.22; transform:translateY(0); }
          50%     { opacity:1;    transform:translateY(-3px); }
        }
        ::view-transition-old(alitos-word) { display: none; }
        ::view-transition-new(alitos-word) { animation: none; }
        ::view-transition-image-pair(alitos-word) {
          animation-duration: 0.52s;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      <div style={{
        position:"fixed", inset:0, zIndex:9999,
        background:"radial-gradient(110% 85% at 50% 40%, #2e2014 0%, #130c06 72%)",
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      }}>
        {/* Subtítulo */}
        <div style={{
          fontSize:"9.5px", letterSpacing:"0.5em", fontWeight:500,
          color:"#bca77f", textTransform:"uppercase", marginBottom:"14px",
          opacity:0, animation:"splash_fade 0.8s ease 0.45s forwards",
        }}>Alfajores Artesanales</div>

        {/* Alito's — wrapper con mismo padding que el up-word para que el morph sea exacto */}
        <div style={{ padding:"12px 0 4px", viewTransitionName:"alitos-word",
          animation:"splash_rise 1.1s cubic-bezier(.22,.61,.36,1) forwards",
        }}>
          <div style={{
            fontFamily:"'BoostPlayer', cursive",
            fontSize:"56px", lineHeight:1, color:"#dcc89f",
            textShadow:"0 2px 14px rgba(0,0,0,0.45)",
          }}>Alito's</div>
        </div>

        {/* Dots de carga */}
        <div style={{
          position:"absolute", bottom:"80px",
          display:"flex", gap:"8px",
          opacity:0, animation:"splash_fade 0.5s ease 0.85s forwards",
        }}>
          {[0, 0.15, 0.3].map((d, i) => (
            <div key={i} style={{
              width:7, height:7, borderRadius:"99px", background:"#dcc89f",
              animation:`dot_pulse 1.1s ease ${0.9 + d}s infinite`,
            }} />
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------- 1º · Elegí tu usuario (cuentas creadas por el admin) ---------- */
function UserPicker({ onPick }) {
  const [users, setUsers] = rUseState([]);
  const [loading, setLoading] = rUseState(true);
  const [error, setError] = rUseState(false);

  const [errMsg, setErrMsg] = rUseState("");
  function cargar() {
    setLoading(true);
    setError(false);
    setErrMsg("");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch(API_BASE + "/api/mobile/usuarios", { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(new Error("HTTP " + r.status + ": " + t.slice(0,80)))))
      .then(data => { setUsers(data || []); setLoading(false); })
      .catch(e => { setError(true); setErrMsg(e?.message || String(e)); setLoading(false); })
      .finally(() => clearTimeout(timer));
  }

  rUseEffect(() => { cargar(); }, []);

  return (
    <div className="up">
      <div className="up-head">
        <div style={{ padding:"12px 0 4px", viewTransitionName:"alitos-word" }}>
          <div className="up-word">Alito's</div>
        </div>
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
          <div style={{ marginBottom: 8 }}>No se pudo conectar al servidor</div>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 4, wordBreak: "break-all" }}>{API_BASE}</div>
          <div style={{ fontSize: 10, color: "#f66", marginBottom: 16, wordBreak: "break-all" }}>{errMsg}</div>
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
function Fingerprint({ user, onAuthed, onPasswordAuthed, onBack, onMustChange, remembered }) {
  const [state, setState]   = rUseState("idle"); // idle | scanning | ok | leaving | error
  const [pass, setPass]     = rUseState("");
  const [errMsg, setErrMsg] = rUseState("");
  const [recordar, setRecordar] = rUseState(true); // siempre recordar por defecto
  const [modoPass, setModoPass] = rUseState(!remembered);
  const [showPass, setShowPass] = rUseState(false);
  const passRef = rUseRef(null);

  // Si hay token guardado + usuario recordado, intenta biometría automáticamente al abrir
  rUseEffect(() => {
    if (remembered && isLoggedIn()) {
      setTimeout(() => scanBio(), 400);
    }
  }, []);

  async function scanBio() {
    if (state !== "idle" && state !== "error") return;
    setState("scanning");
    setErrMsg("");
    try {
      await triggerBiometric("Verificá tu identidad para ingresar a Alito's");
      // Biometría OK — verificar que el token siga vigente
      try {
        await fetchPerfil();
      } catch {
        // Token expirado — pedir contraseña
        setState("idle");
        setModoPass(true);
        setErrMsg("Sesión expirada, ingresá tu contraseña");
        return;
      }
      setState("ok");
      setTimeout(() => setState("leaving"), 700);
      setTimeout(() => onAuthed(), 1600);
    } catch(e) {
      const msg = (e?.message || e?.code || "").toString().toLowerCase();
      const noDisp = msg.includes("no-biometry") || msg.includes("no-plugin") ||
                     msg.includes("none") || msg.includes("not enrolled") ||
                     msg.includes("not available") || msg.includes("unavailable") ||
                     msg.includes("lockout") || msg === "";
      if (noDisp) {
        setState("idle");
        setModoPass(true);
      } else if (msg.includes("cancel") || msg.includes("user cancel")) {
        setState("idle");
      } else {
        setState("error");
        setErrMsg("Huella no reconocida");
        setTimeout(() => setState("idle"), 1500);
      }
    }
  }

  async function scanPass() {
    if (state !== "idle" && state !== "error") return;
    if (!pass) { passRef.current?.focus(); setErrMsg("Ingresá tu contraseña"); return; }
    setState("scanning");
    setErrMsg("");
    try {
      const username = user.username || user.name?.toLowerCase().replace(" ", "");
      const loginData = await loginAndSetupPush(username, pass);
      if (loginData?.must_change_password) {
        onMustChange && onMustChange(user, pass);
        return;
      }
      if (recordar) saveRememberedUser({ ...user, ...loginData });
      else clearRememberedUser();
      setState("ok");
      const finalUser = { ...user, ...loginData };
      setTimeout(() => setState("leaving"), 700);
      setTimeout(() => (onPasswordAuthed || onAuthed)(finalUser), 1600);
    } catch(e) {
      setState("error");
      setErrMsg("Contraseña incorrecta");
      setPass("");
      setTimeout(() => setState("idle"), 1500);
    }
  }

  function handleKey(e) { if (e.key === "Enter") scanPass(); }

  const busy  = state === "ok" || state === "leaving";
  const label = state === "scanning" ? "Verificando…"
              : state === "error"    ? (errMsg || "Error")
              : busy                 ? `¡Hola, ${user.first || user.nombre}!`
              : remembered && !modoPass ? "Tocá para usar tu huella"
              :                           "Ingresá tu contraseña";

  return (
    <div className={"fpscreen" + (state === "leaving" ? " leaving" : "")}>
      <div className="fps-hero">
        <div className={"fps-word" + (busy ? " zoom" : "")}>Alito's</div>
        <div className="fps-user">
          <div className="fu-ava" style={{ background: user.color || "#c47820" }}>
            {user.avatar || user.first?.[0] || user.nombre?.[0] || "?"}
          </div>
          <div>
            <div className="fu-name">{user.name || user.nombre}</div>
            <div className="fu-role">{user.roleLabel || user.rol}</div>
          </div>
        </div>
      </div>
      <div className="fps-panel">
        {!busy && modoPass && (
          <div style={{ position: "relative", width: "100%", marginBottom: 12 }}>
            <input
              ref={passRef}
              type={showPass ? "text" : "password"}
              placeholder="Contraseña"
              value={pass}
              onChange={e => { setPass(e.target.value); setErrMsg(""); }}
              onKeyDown={handleKey}
              style={{
                background: "var(--c2,#1e1e1e)", border: "1px solid var(--brdr,#2e2e2e)",
                borderRadius: 10, color: "#fff", fontSize: "1rem", padding: "10px 42px 10px 14px",
                width: "100%", textAlign: "center", outline: "none", boxSizing: "border-box",
              }}
            />
            <span onClick={() => setShowPass(s => !s)} style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              cursor: "pointer", color: "var(--txt-3)", fontSize: 18, lineHeight: 1,
            }}>
              {showPass ? "🙈" : "👁️"}
            </span>
          </div>
        )}
        <div
          className={"fp " + (state === "scanning" ? "scanning" : busy ? "ok" : state === "error" ? "error" : "")}
          onClick={modoPass ? scanPass : scanBio}
          style={{ cursor: busy ? "default" : "pointer" }}
        >
          <div className="fp-ring" />
          <div className="fp-sweep" />
          {busy ? <Icon name="check" size={50} sw={2.4} /> : <Icon name="fingerprint" size={50} sw={1.8} />}
        </div>
        <div className={"fp-label " + (state === "scanning" ? "scanning" : busy ? "ok" : state === "error" ? "error" : "")}>
          {label}
        </div>
        {errMsg && !busy && state !== "error" && (
          <div style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: 4 }}>{errMsg}</div>
        )}
        {/* Recordarme — solo cuando ingresa con contraseña */}
        {!busy && modoPass && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, cursor: "pointer", fontSize: "0.85rem", color: "var(--txt-3)" }}>
            <input type="checkbox" checked={recordar} onChange={e => setRecordar(e.target.checked)}
              style={{ accentColor: "var(--accent,#c47820)", width: 16, height: 16 }} />
            Recordarme en este dispositivo
          </label>
        )}
        {/* Cambiar entre huella y contraseña — siempre visible */}
        {!busy && (
          <div className="auth-alt" onClick={() => { setModoPass(!modoPass); setErrMsg(""); }}>
            {modoPass ? "← Usar huella" : "Ingresar con contraseña"}
          </div>
        )}
        {!busy && <div className="auth-alt" onClick={onBack}>← Cambiar de usuario</div>}
      </div>
    </div>);
}

/* ---------- 3º · Onboarding biométrico (primera vez) ---------- */
function BiometricEnroll({ user, onDone }) {
  const [step, setStep]   = rUseState("ask");   // ask | scanning | ok | denied | unavail
  const [err, setErr]     = rUseState("");

  async function activar() {
    setStep("scanning"); setErr("");
    try {
      await triggerBiometric("Registrá tu huella para ingresar a Alito's sin contraseña");
      localStorage.setItem("alitos_bio_asked", "yes");
      saveRememberedUser(user);
      setStep("ok");
      setTimeout(() => onDone(true), 1600);
    } catch(e) {
      const msg = e?.message || "";
      if (msg === "no-plugin" || msg === "no-biometry") {
        localStorage.setItem("alitos_bio_asked", "unavail");
        setStep("unavail");
        setTimeout(() => onDone(false), 2200);
      } else {
        setErr("No se pudo verificar. Intentá de nuevo.");
        setStep("ask");
      }
    }
  }

  function omitir() {
    localStorage.setItem("alitos_bio_asked", "later");
    onDone(false);
  }

  const BG = { position:"fixed", inset:0, zIndex:9999,
    background:"radial-gradient(110% 90% at 50% 100%, #1c1408 0%, #0b0a06 65%)",
    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
    padding:"0 32px", gap:0 };

  if (step === "ok") return (
    <div style={BG}>
      <div style={{ fontSize:64, marginBottom:16 }}>✅</div>
      <div style={{ fontFamily:"var(--script)", fontSize:28, color:"var(--cream)", marginBottom:8 }}>¡Listo!</div>
      <div style={{ color:"var(--txt-2)", textAlign:"center", fontSize:14 }}>
        La próxima vez entrás con tu huella
      </div>
    </div>
  );

  if (step === "unavail") return (
    <div style={BG}>
      <div style={{ fontSize:56, marginBottom:16 }}>☝️</div>
      <div style={{ color:"var(--txt)", textAlign:"center", fontSize:14, lineHeight:1.6 }}>
        Tu dispositivo no tiene huella configurada.<br/>
        Podés activarla desde <b>Ajustes → Seguridad</b> y luego entrar de nuevo.
      </div>
    </div>
  );

  return (
    <div style={BG}>
      {/* Ícono huella */}
      <div style={{
        width:88, height:88, borderRadius:"50%",
        background:"rgba(196,120,32,0.12)", border:"2px solid rgba(196,120,32,0.35)",
        display:"flex", alignItems:"center", justifyContent:"center",
        marginBottom:28, fontSize:44,
        animation: step === "scanning" ? "glow_bio 1s ease-in-out infinite" : "none",
      }}>☝️</div>

      <style>{`
        @keyframes glow_bio {
          0%,100% { box-shadow: 0 0 0 0 rgba(196,120,32,0); }
          50%      { box-shadow: 0 0 0 18px rgba(196,120,32,0.18); }
        }
      `}</style>

      <div style={{ fontFamily:"var(--script)", fontSize:32, color:"var(--cream)", marginBottom:12, lineHeight:1 }}>
        Usá tu huella
      </div>
      <div style={{ color:"var(--txt-2)", textAlign:"center", fontSize:13.5, lineHeight:1.65, marginBottom:32 }}>
        {step === "scanning"
          ? "Poné tu dedo en el sensor…"
          : "¿Querés activar el reconocimiento de huella para entrar sin contraseña?"}
      </div>

      {err && <div style={{ color:"#ef4444", fontSize:13, marginBottom:16, textAlign:"center" }}>{err}</div>}

      {step === "ask" && <>
        <button onClick={activar} style={{
          width:"100%", maxWidth:280, padding:"14px 0", borderRadius:14, border:"none",
          background:"linear-gradient(135deg, #c47820, #a85e10)", color:"#fff",
          fontFamily:"var(--font)", fontWeight:700, fontSize:15, cursor:"pointer", marginBottom:12,
        }}>
          Activar huella
        </button>
        <button onClick={omitir} style={{
          width:"100%", maxWidth:280, padding:"12px 0", borderRadius:14,
          background:"transparent", border:"1px solid var(--border-2)", color:"var(--txt-3)",
          fontFamily:"var(--font)", fontSize:14, cursor:"pointer",
        }}>
          Ahora no
        </button>
      </>}
    </div>
  );
}

/* ---------- 4º · Cambio de contraseña obligatorio ---------- */
function CambiarPassword({ user, onDone }) {
  const [pass1, setPass1] = rUseState("");
  const [pass2, setPass2] = rUseState("");
  const [show1, setShow1] = rUseState(false);
  const [show2, setShow2] = rUseState(false);
  const [loading, setLoading] = rUseState(false);
  const [err, setErr] = rUseState("");

  async function guardar() {
    if (pass1.length < 6) { setErr("Mínimo 6 caracteres"); return; }
    if (pass1 !== pass2)  { setErr("Las contraseñas no coinciden"); return; }
    setLoading(true); setErr("");
    try {
      await cambiarPassword(user.passwordActual || "", pass1);
      onDone();
    } catch(e) {
      setErr(e?.message || "Error al cambiar contraseña");
    } finally { setLoading(false); }
  }

  const inp = (val, set, show, setShow, placeholder) => (
    <div style={{ position: "relative", width: "100%", marginBottom: 12 }}>
      <input type={show ? "text" : "password"} placeholder={placeholder} value={val}
        onChange={e => { set(e.target.value); setErr(""); }}
        style={{ background: "var(--c2,#1e1e1e)", border: "1px solid var(--brdr,#2e2e2e)",
          borderRadius: 10, color: "#fff", fontSize: "1rem", padding: "10px 42px 10px 14px",
          width: "100%", boxSizing: "border-box", outline: "none", textAlign: "center" }} />
      <span onClick={() => setShow(s => !s)} style={{
        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
        cursor: "pointer", fontSize: 18, color: "var(--txt-3)" }}>
        {show ? "🙈" : "👁️"}
      </span>
    </div>
  );

  return (
    <div className="fpscreen">
      <div className="fps-hero">
        <div className="fps-word">Alito's</div>
        <div className="fps-user">
          <div className="fu-ava" style={{ background: user.color || "#c47820" }}>
            {user.avatar || user.first?.[0] || user.nombre?.[0] || "?"}
          </div>
          <div>
            <div className="fu-name">{user.name || user.nombre}</div>
            <div className="fu-role">{user.roleLabel || user.rol}</div>
          </div>
        </div>
      </div>
      <div className="fps-panel">
        <div style={{ fontSize: "0.9rem", color: "var(--txt-2)", marginBottom: 16, textAlign: "center" }}>
          🔐 Primera vez que ingresás.<br/>Elegí una contraseña nueva.
        </div>
        {inp(pass1, setPass1, show1, setShow1, "Nueva contraseña")}
        {inp(pass2, setPass2, show2, setShow2, "Repetir contraseña")}
        {err && <div style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: 8, textAlign: "center" }}>{err}</div>}
        <button onClick={guardar} disabled={loading} style={{
          width: "100%", padding: "12px", borderRadius: 10, border: "none",
          background: "var(--accent,#c47820)", color: "#fff", fontSize: "1rem",
          fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
        }}>
          {loading ? "Guardando…" : "Guardar contraseña"}
        </button>
      </div>
    </div>
  );
}

/* Ejecuta un cambio de fase con shared-element transition (si el navegador lo soporta) */
function withVT(fn) {
  if (document.startViewTransition) {
    document.startViewTransition(() => { ReactDOM.flushSync(fn); });
  } else { fn(); }
}

function Root() {
  const remembered = getRememberedUser();
  const [phase, setPhase] = rUseState("intro");
  const [user, setUser]   = rUseState(remembered && isLoggedIn() ? remembered : null);
  const toastApi = rUseRef(() => {});
  const toast = (msg, kind) => toastApi.current(msg, kind);

  function afterIntro() {
    const next = remembered && isLoggedIn() ? "fp" : "users";
    if (document.startViewTransition) {
      document.startViewTransition(() => { ReactDOM.flushSync(() => setPhase(next)); });
    } else { setPhase(next); }
  }
  function pickUser(u) { withVT(() => { setUser(u); setPhase("fp"); }); }
  function enterApp() { setPhase("app"); }
  function afterPasswordLogin(u) {
    setUser(u); // siempre actualizar con datos del login (view, rol, etc.)
    const asked = localStorage.getItem("alitos_bio_asked");
    if (!asked) setPhase("bioenroll");
    else        setPhase("app");
  }
  function needsPassChange(u, passActual) { setUser({ ...u, passwordActual: passActual }); setPhase("changepass"); }
  function backToUsers() { withVT(() => { setPhase("users"); setUser(null); }); }
  function logout() { logoutUser(); clearRememberedUser(); localStorage.removeItem("alitos_bio_asked"); setUser(null); setPhase("users"); }

  let app = null;
  if (user) {
    if (user.view === "admin") app = <AdminApp onLogout={logout} user={user} />;else
    if (user.view === "vendedor") app = <VendorApp onLogout={logout} user={user} />;else
    if (user.view === "produccion") app = <ProduccionApp onLogout={logout} user={user} />;
  }

  return (
    <ToastCtx.Provider value={toast}>
      <Phone>
        {phase === "intro" && <Intro onDone={afterIntro} />}
        {phase === "users" && <UserPicker onPick={pickUser} />}
        {phase === "fp" && <Fingerprint user={user} onAuthed={enterApp} onPasswordAuthed={afterPasswordLogin} onBack={backToUsers} onMustChange={needsPassChange} remembered={!!(remembered && isLoggedIn() && remembered.id === user?.id)} />}
        {phase === "bioenroll" && <BiometricEnroll user={user} onDone={() => setPhase("app")} />}
        {phase === "changepass" && <CambiarPassword user={user} onDone={enterApp} />}
        {phase === "app" && <AppEnter>{app}</AppEnter>}
        <ToastHost apiRef={toastApi} />
      </Phone>
    </ToastCtx.Provider>);
}

/* Espera que el storage seguro esté inicializado antes de renderizar Root.
   Así getRememberedUser() y isLoggedIn() devuelven valores correctos. */
function AppShell() {
  const [ready, rSetReady] = rUseState(false);
  rUseEffect(() => {
    (window._storageReady || Promise.resolve())
      .then(() => rSetReady(true))
      .catch(() => rSetReady(true));
  }, []);
  if (!ready) return null;
  return <Root />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<AppShell />);
