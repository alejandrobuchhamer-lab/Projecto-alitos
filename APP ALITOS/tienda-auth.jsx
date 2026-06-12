/* ===================== ALITO'S Tienda · Auth ===================== */
const { useState: aUseState } = React;

const GoogleG = () =>
<svg viewBox="0 0 24 24" width="19" height="19">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
  </svg>;


/* Frases tentadoras en el panel lateral */
const AUTH_PERKS = [
{ ic: "truck", t: "Envío a domicilio el mismo día" },
{ ic: "leaf", t: "Recién horneados, sin conservantes" },
{ ic: "tag", t: "Precios especiales para comercios" }];


function Auth({ onAuth, initialTab }) {
  const [tab, setTab] = aUseState(initialTab || "register"); // register | login
  const [type, setType] = aUseState("particular"); // particular | comercio
  const [form, setForm] = aUseState({ name: "", email: "", pass: "", biz: "", cuit: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e) {
    e && e.preventDefault();
    const name = type === "comercio" ? form.biz || "Tu comercio" : form.name || "Invitado";
    onAuth({
      name,
      email: form.email || "cliente@alitos.com",
      type,
      tier: type === "comercio" ? "mayorista" : "minorista",
      avatar: name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    });
  }
  function google() {
    onAuth({
      name: type === "comercio" ? "Kiosco Don Pedro" : "Sofía Martínez",
      email: type === "comercio" ? "donpedro@gmail.com" : "sofia.martinez@gmail.com",
      type,
      tier: type === "comercio" ? "mayorista" : "minorista",
      avatar: type === "comercio" ? "DP" : "SM",
      google: true
    });
  }

  return (
    <div className="auth-wrap simple">
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="ab-word">Alito's</span>
            <span className="ab-line">De lo nuestro, lo mejor.</span>
          </div>
          <div className="ac-title">{tab === "register" ? "Creá tu cuenta" : "Bienvenido de nuevo"}</div>
          <div className="ac-sub">{tab === "register" ? "Pocos datos y entrás a la tienda." : "Ingresá para seguir pidiendo."}</div>

          <button className="google-btn" onClick={google}><GoogleG />Continuar con Google</button>
          <div className="auth-or">o con tu email</div>

          <div className="auth-tabs">
            <button className={tab === "register" ? "active" : ""} onClick={() => setTab("register")}>Registrarme</button>
            <button className={tab === "login" ? "active" : ""} onClick={() => setTab("login")}>Ingresar</button>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {tab === "register" &&
            <React.Fragment>
                <div className="field">
                  <label className="lab">Quiero comprar como</label>
                  <div className="type-pick">
                    <button type="button" className={"type-opt" + (type === "particular" ? " sel" : "")} onClick={() => setType("particular")}>
                      <div className="to-ico"><TIcon name="star" size={18} /></div>
                      <div className="to-t">Particular</div>
                      <div className="to-s">Para mí / regalo</div>
                    </button>
                    <button type="button" className={"type-opt" + (type === "comercio" ? " sel" : "")} onClick={() => setType("comercio")}>
                      <div className="to-ico"><TIcon name="store" size={18} /></div>
                      <div className="to-t">Comercio</div>
                      <div className="to-s">Precios mayoristas</div>
                    </button>
                  </div>
                </div>
                {type === "comercio" ?
              <div className="field">
                      <label className="lab">Nombre del comercio</label>
                      <input className="input" placeholder="Kiosco Don Pedro" value={form.biz} onChange={(e) => set("biz", e.target.value)} />
                    </div> :
              <div className="field">
                      <label className="lab">Nombre y apellido</label>
                      <input className="input" placeholder="Sofía Martínez" value={form.name} onChange={(e) => set("name", e.target.value)} />
                    </div>}
                {type === "comercio" &&
              <div className="field">
                    <label className="lab">CUIT</label>
                    <input className="input" placeholder="30-12345678-9" value={form.cuit} onChange={(e) => set("cuit", e.target.value)} />
                  </div>
              }
              </React.Fragment>
            }
            <div className="field">
              <label className="lab">Email</label>
              <input className="input" type="email" placeholder="vos@email.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="field">
              <label className="lab">Contraseña</label>
              <input className="input" type="password" placeholder="••••••••" value={form.pass} onChange={(e) => set("pass", e.target.value)} />
            </div>
            {tab === "register" && type === "comercio" &&
            <div style={{ fontSize: 12, color: "var(--txt-3)", lineHeight: 1.5, background: "var(--amber-soft)", border: "1px solid var(--border-2)", borderRadius: 11, padding: "11px 13px" }}>
                <TIcon name="shield" size={14} sw={2} /> &nbsp;Tu cuenta mayorista se aprueba en minutos. Los precios especiales los define Alito's.
              </div>
            }
            <button className="btn btn-primary btn-block btn-lg" type="submit" style={{ marginTop: 4 }}>
              {tab === "register" ? "Crear cuenta y entrar" : "Ingresar"}
            </button>
          </form>

          <div className="auth-foot">
            {tab === "register" ?
            <React.Fragment>¿Ya tenés cuenta? <a onClick={() => setTab("login")}>Ingresá</a></React.Fragment> :
            <React.Fragment>¿Sos nuevo? <a onClick={() => setTab("register")}>Creá tu cuenta</a></React.Fragment>}
          </div>
        </div>
      </main>
    </div>);

}

Object.assign(window, { Auth, GoogleG });