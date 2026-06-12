/* ===================== ALITO'S Tienda · app ===================== */
const { useState, useEffect, useMemo, useRef } = React;

const GOOGLE_USER = { name: "Sofía Martínez", email: "sofia.martinez@gmail.com", type: "particular", tier: "minorista", avatar: "SM", google: true };

function Store() {
  const [intro, setIntro] = useState(true);
  const [authTab, setAuthTab] = useState("register");
  const [user, setUser] = useState(null);
  const [cat, setCat] = useState("all");
  const [cart, setCart] = useState({}); // id -> qty
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  // efectos visuales: reveal-on-scroll + header compacto + parallax (hero y franjas)
  useEffect(() => {
    if (!user) return;
    const reveals = [].slice.call(document.querySelectorAll("[data-reveal]:not(.in)"));
    let io;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver((ents) => ents.forEach((en) => {
        if (en.isIntersecting) {const el = en.target;setTimeout(() => el.classList.add("in"), +(el.dataset.revealDelay || 0));io.unobserve(el);}
      }), { threshold: 0.12, rootMargin: "0px 0px -7% 0px" });
      reveals.forEach((e) => io.observe(e));
    } else reveals.forEach((e) => e.classList.add("in"));
    const band = document.querySelector(".band");
    let bio;
    if (band && "IntersectionObserver" in window) {
      bio = new IntersectionObserver((e) => {if (e[0].isIntersecting) {band.classList.add("in");bio.disconnect();}}, { threshold: 0.3 });
      bio.observe(band);
    }
    const hdr = document.querySelector(".hdr");
    const heroVis = document.querySelector(".hero-visual");
    const bands = [].slice.call(document.querySelectorAll("[data-pband-bg]"));
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        if (hdr) hdr.classList.toggle("scrolled", y > 24);
        if (heroVis && y < 900) heroVis.style.transform = "translateY(" + y * 0.08 + "px)";
        const vh = window.innerHeight;
        bands.forEach((bg) => {
          const r = bg.parentElement.getBoundingClientRect();
          if (r.bottom > 0 && r.top < vh) {
            const prog = (r.top + r.height / 2 - vh / 2) / vh;
            bg.style.transform = "translateY(" + prog * 14 + "%)";
          }
        });
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {window.removeEventListener("scroll", onScroll);if (io) io.disconnect();if (bio) bio.disconnect();if (raf) cancelAnimationFrame(raf);};
  }, [cat, user]);

  if (intro) return <IntroSplash
    onGoogle={() => {setUser(GOOGLE_USER);setIntro(false);}}
    onCreate={() => {setAuthTab("register");setIntro(false);}}
    onLogin={() => {setAuthTab("login");setIntro(false);}} />;

  if (!user) return <Auth onAuth={setUser} initialTab={authTab} />;

  const mode = user.tier; // minorista | mayorista (definido por tipo de cuenta)
  const priceOf = (item) => mode === "mayorista" ? item.may : item.unit;

  function toast(msg) {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.map((x) => x.id === id ? { ...x, out: true } : x)), 2200);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2550);
  }
  function add(item) {
    setCart((c) => ({ ...c, [item.id]: (c[item.id] || 0) + 1 }));
    toast(`${item.name} agregado`);
    const cb = document.querySelector(".cart-btn");
    if (cb) {cb.classList.remove("bump");void cb.offsetWidth;cb.classList.add("bump");}
  }
  function setQty(id, q) {
    setCart((c) => {const n = { ...c };if (q <= 0) delete n[id];else n[id] = q;return n;});
  }
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const items = Object.entries(cart).map(([id, q]) => ({ item: ITEM_BY_ID[id], qty: q }));
  const subtotal = items.reduce((a, { item, qty }) => a + priceOf(item) * qty, 0);

  const shown = cat === "all" ? PRODUCTS : cat === "cajas" ? [] : PRODUCTS.filter((p) => p.cat === cat);
  const showBoxes = cat === "all" || cat === "cajas";

  return (
    <React.Fragment>
      <Header user={user} count={count} onCart={() => setCartOpen(true)}
      menuOpen={menuOpen} setMenuOpen={setMenuOpen} onLogout={() => {setUser(null);setCart({});}} />
      <Hero onShop={() => document.getElementById("catalogo").scrollIntoView()} mode={mode} />

      {/* FRANJA SENSORIAL 1 */}
      <ParallaxBand img="assets/band-mate.jpg" align="left"
      kicker="El primer mordisco"
      title="Tapa que se deshace.<br/><span class='it'>Dulce que se estira.</span>"
      sub="Cada alfajor se rompe como tiene que romperse: la masa cede, el dulce de leche asoma. Una sola mordida y entendés por qué no podés parar."
      cta="Quiero probarlos" onCta={() => document.getElementById("catalogo").scrollIntoView()} />

      {/* MANIFIESTO */}
      <Manifesto />

      {/* PRESENTACIÓN: envoltorio + alfajor real */}
      <Presentacion />

      {/* ASISTENTE ANTOJO (Claude) */}
      <AntojoAssistant priceOf={priceOf} onAdd={add} />

      {/* CATÁLOGO */}
      <section className="section" id="catalogo">
        <div className="wrap">
          <div className="section-head" data-reveal>
            <div>
              <div className="eyebrow">Nuestros alfajores</div>
              <h2>Catálogo</h2>
              <p>Elaboración artesanal, todos los días. {mode === "mayorista" ? "Precios mayoristas por caja." : "Precio por unidad."}</p>
            </div>
            <div className="spacer"></div>
          </div>
          <div className="cats" style={{ marginBottom: 28 }} data-reveal>
            {CATS.map((c) =>
            <button key={c.id} className={"cat" + (cat === c.id ? " active" : "")} onClick={() => setCat(c.id)}>{c.name}</button>
            )}
          </div>
          {shown.length > 0 &&
          <div className="grid">
              {shown.map((p, i) => <div data-reveal="scale" data-reveal-delay={i * 70} key={p.id}><ProductCard item={p} mode={mode} price={priceOf(p)} qty={cart[p.id] || 0} onAdd={() => add(p)} onQty={(q) => setQty(p.id, q)} /></div>)}
            </div>
          }
          {showBoxes &&
          <React.Fragment>
              <div className="section-head" style={{ marginTop: shown.length ? 48 : 0 }} data-reveal>
                <div>
                  <div className="eyebrow">Para compartir</div>
                  <h2>Cajas y combos</h2>
                </div>
              </div>
              <div className="grid boxes">
                {BOXES.map((b, i) => <div data-reveal="scale" data-reveal-delay={i * 70} key={b.id}><BoxCard item={b} mode={mode} price={priceOf(b)} qty={cart[b.id] || 0} onAdd={() => add(b)} onQty={(q) => setQty(b.id, q)} /></div>)}
              </div>
            </React.Fragment>
          }
        </div>
      </section>

      {/* FRANJA CITA */}
      <QuoteBand img="assets/band-stacks.jpg"
      quote="“El que prueba uno,<br/>vuelve por la caja.”" />

      {/* MAYORISTA */}
      <section className="section" id="mayorista" style={{ paddingTop: 0 }}>
        <div className="wrap" data-reveal="scale"><MayoristaBand mode={mode} /></div>
      </section>

      <Footer />

      {/* CART DRAWER */}
      <div className={"scrim" + (cartOpen ? " open" : "")} onClick={() => setCartOpen(false)}></div>
      <CartDrawer open={cartOpen} items={items} mode={mode} priceOf={priceOf} subtotal={subtotal}
      onClose={() => setCartOpen(false)} onQty={setQty}
      onCheckout={() => {setCartOpen(false);setCheckout(true);}} onShop={() => {setCartOpen(false);document.getElementById("catalogo").scrollIntoView();}} />

      {/* CHECKOUT */}
      <Checkout open={checkout} items={items} mode={mode} priceOf={priceOf} subtotal={subtotal}
      onClose={() => setCheckout(false)} onDone={() => {setCart({});}} />

      {/* TOASTS */}
      <div className="toasts">
        {toasts.map((t) =>
        <div key={t.id} className={"toast" + (t.out ? " out" : "")}>
            <div className="t-ico"><TIcon name="check" size={14} sw={2.6} /></div>{t.msg}
          </div>
        )}
      </div>
    </React.Fragment>);

}

/* ---------- Header ---------- */
function Header({ user, count, onCart, menuOpen, setMenuOpen, onLogout }) {
  const isMay = user.tier === "mayorista";
  return (
    <header className="hdr">
      <div className="wrap hdr-inner">
        <a href="#" className="brand">
          <span className="b-word">Alito's</span>
          <span className="b-sub">Alfajores artesanales</span>
        </a>
        <nav className="hdr-nav">
          <a href="#catalogo">Tienda</a>
          <a href="#catalogo">Cajas</a>
          <a href="#mayorista">Mayorista</a>
          <a href="#contacto">Contacto</a>
        </nav>
        <div className="hdr-spacer"></div>
        <div style={{ position: "relative" }}>
          <div className="user-chip" onClick={() => setMenuOpen((o) => !o)}>
            <div className="uc-av" style={{ background: isMay ? "var(--amber)" : "var(--purple)" }}>{user.avatar}</div>
            <div>
              <div className="uc-n">{user.name.length > 16 ? user.name.slice(0, 15) + "…" : user.name}</div>
              <div className={"uc-tier " + (isMay ? "may" : "min")}>{isMay ? "Cuenta mayorista" : "Cuenta particular"}</div>
            </div>
          </div>
          {menuOpen &&
          <React.Fragment>
              <div style={{ position: "fixed", inset: 0, zIndex: 55 }} onClick={() => setMenuOpen(false)}></div>
              <div className="menu">
                <div className="menu-head">
                  <div className="mh-n">{user.name}</div>
                  <div className="mh-e">{user.email}</div>
                  <div style={{ marginTop: 9 }}><span className={"tier-badge " + (isMay ? "may" : "min")}><TIcon name={isMay ? "store" : "star"} size={12} sw={2.2} />{isMay ? "Precios mayoristas" : "Particular"}</span></div>
                </div>
                <button className="menu-item"><TIcon name="box" size={17} />Mis pedidos</button>
                <button className="menu-item"><TIcon name="pin" size={17} />Direcciones</button>
                <button className="menu-item"><TIcon name="phone" size={17} />Ayuda</button>
                <button className="menu-item" onClick={onLogout}><TIcon name="x" size={17} />Cerrar sesión</button>
              </div>
            </React.Fragment>
          }
        </div>
        <button className="cart-btn" onClick={onCart}>
          <TIcon name="cart" size={21} />
          {count > 0 && <span className="cart-count">{count}</span>}
        </button>
      </div>
    </header>);

}

/* ---------- Hero ---------- */
function Hero({ onShop, mode }) {
  return (
    <section className="hero">
      <div className="hero-bg"></div>
      <div className="hero-crumbs" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, i) => {
          const sz = 4 + i % 4 * 2;
          return <span key={i} style={{ left: 8 + i * 10 + "%", width: sz, height: sz,
            animationDuration: 7 + i % 5 + "s", animationDelay: i * 0.9 + "s",
            "--dx": (i % 2 ? 1 : -1) * (15 + i * 4) + "px" }} />;
        })}
      </div>
      <div className="wrap hero-inner centered">
        <div className="hero-text">
          <div className="hero-eyebrow"><span className="pd"></span>Elaboración del día · Zona Oeste, GBA</div>
          <h1 style={{ fontSize: "67px", fontFamily: "\"Dancing Script\"", letterSpacing: "0.7px" }}>Alfajores artesanales,<br /><span className="em" style={{ fontFamily: "Righteous", letterSpacing: "1px", fontSize: "50px" }}>directo de fábrica</span></h1>
          <p>Pedí online y recibilos frescos en tu casa o retiralos en el local. Atendemos a particulares y comercios mayoristas.</p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-lg" onClick={onShop}><TIcon name="cart" size={18} />Ver catálogo</button>
            <a className="btn btn-ghost btn-lg" href="#mayorista"><TIcon name="store" size={18} />Soy comercio</a>
          </div>
          <div className="hero-trust">
            <div className="t"><TIcon name="truck" size={18} />Envío a domicilio</div>
            <div className="t"><TIcon name="store" size={18} />Retiro en fábrica</div>
            <div className="t"><TIcon name="leaf" size={18} />Sin conservantes</div>
          </div>
        </div>
      </div>
    </section>);

}

/* ---------- Parallax band: franja full-bleed con copy sensorial ---------- */
function ParallaxBand({ img, kicker, title, sub, align, cta, onCta }) {
  return (
    <section className={"pband " + (align || "left")} data-pband>
      <div className="pband-bg" data-pband-bg style={{ backgroundImage: "url(" + img + ")" }}></div>
      <div className="pband-grain"></div>
      <div className="pband-inner">
        <div className="pband-copy" data-reveal={align === "right" ? "right" : "left"}>
          {kicker && <div className="pband-kicker">{kicker}</div>}
          <h2 className="pband-title" dangerouslySetInnerHTML={{ __html: title }}></h2>
          {sub && <p className="pband-sub">{sub}</p>}
          {cta && <div className="pband-cta"><button className="btn btn-primary btn-lg" onClick={onCta}>{cta}</button></div>}
        </div>
      </div>
    </section>);
}

/* ---------- Banda de cita (quote) centrada ---------- */
function QuoteBand({ img, quote }) {
  return (
    <section className="pband center" data-pband>
      <div className="pband-bg" data-pband-bg style={{ backgroundImage: "url(" + img + ")", backgroundPosition: "center top" }}></div>
      <div className="pband-inner">
        <div className="pband-copy" data-reveal="scale">
          <div className="pband-quote" dangerouslySetInnerHTML={{ __html: quote }}></div>
        </div>
      </div>
    </section>);
}

/* ---------- Manifiesto sensorial ---------- */
function Manifesto() {
  const items = [
  { n: "i", ic: "leaf", t: "Recién hechos", p: "Horneamos cada tanda el mismo día. Sin conservantes, sin atajos. El dulce de leche es de verdad." },
  { n: "ii", ic: "spark", t: "El primer mordisco", p: "Tapa que se deshace, relleno que se estira. Esa primera mordida que te hace cerrar los ojos." },
  { n: "iii", ic: "shield", t: "Hecho a mano", p: "Receta de familia desde 1998. Cada alfajor pasa por nuestras manos, uno por uno." }];

  return (
    <section className="manifesto">
      <div className="wrap">
        <div className="manifesto-head" data-reveal>
          <div className="eyebrow">Por qué Alito's</div>
          <div className="manifesto-q">No vendemos alfajores.<br /><span className="it">Vendemos ese momento</span> en que todo mejora.</div>
        </div>
        <div className="manifesto-grid">
          {items.map((it, i) =>
          <div className="manifesto-item" key={i} data-reveal="scale" data-reveal-delay={i * 110}>
              <div className="mi-ico"><TIcon name={it.ic} size={26} /></div>
              <div className="manifesto-num">{it.n}</div>
              <h4>{it.t}</h4>
              <p>{it.p}</p>
            </div>
          )}
        </div>
      </div>
    </section>);
}

/* ---------- Presentación: envoltorio + alfajor real ---------- */
function Presentacion() {
  return (
    <section className="present">
      <div className="wrap present-grid">
        <div className="present-copy" data-reveal="left">
          <div className="eyebrow">Cacao intenso</div>
          <h2>Del envoltorio<br /><span className="it">al último bocado.</span></h2>
          <p>Cada alfajor sale envuelto a mano, listo para acompañar tu mate o tu café. Bañado en chocolate, relleno generoso de dulce de leche. Así, tal cual lo ves.</p>
        </div>
        <div className="present-pics" data-reveal="right">
          <div className="present-pic">
            <img src="assets/shot-wrapper.jpg" alt="Alfajor Alito's envuelto" />
            <div className="cap">Edición Cacao Intenso</div>
          </div>
          <div className="present-pic">
            <img src="assets/shot-whole.jpg" alt="Alfajor Alito's bañado en chocolate" />
            <div className="cap">Baño de chocolate</div>
          </div>
        </div>
      </div>
    </section>);
}

/* ---------- Asistente Antojo (Claude / Anthropic) ---------- */
function AntojoAssistant({ priceOf, onAdd }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null); // { pitch, ids: [] }
  const [err, setErr] = useState("");

  const sugerencias = ["Algo con chocolate para regalar", "Para acompañar el mate", "El más clásico", "Una caja para la oficina", "Lo más goloso que tengan"];

  function catalogoTxt() {
    return ALL_ITEMS.map((i) => `${i.id} — ${i.name} (${i.catLabel}): ${i.desc} [${ARS(priceOf(i))}]`).join("\n");
  }

  async function pedir(texto) {
    const query = (texto != null ? texto : q).trim();
    if (!query) return;
    setQ(query);setLoading(true);setErr("");setRes(null);
    const prompt = `Sos el asistente de Alito's, una tienda argentina de alfajores artesanales. Este es el catálogo (id — nombre (categoría): descripción [precio]):

${catalogoTxt()}

El cliente dice: "${query}"

Elegí 1 o 2 productos del catálogo que mejor le calcen. Escribí un mensaje corto, cálido y tentador en tono argentino rioplatense (máximo 2 oraciones) explicando por qué se va a tentar. Respondé SOLO con un objeto JSON válido, sin texto extra, con esta forma exacta:
{"ids": ["id1"], "pitch": "tu mensaje tentador"}
Usá únicamente ids que existan en el catálogo.`;
    try {
      if (!(window.claude && window.claude.complete)) throw new Error("sin-conexion");
      const raw = await window.claude.complete({ messages: [{ role: "user", content: prompt }] });
      const m = String(raw).match(/\{[\s\S]*\}/);
      const data = JSON.parse(m ? m[0] : raw);
      const ids = (data.ids || []).filter((id) => ITEM_BY_ID[id]).slice(0, 2);
      if (!ids.length) throw new Error("sin-match");
      setRes({ pitch: data.pitch || "Esto es lo que te recomiendo:", ids });
    } catch (e) {
      // fallback simple por palabras clave si no hay API
      const t = query.toLowerCase();
      let ids = [];
      if (/choco|cacao/.test(t)) ids = ["cacao"];else
      if (/regal|caja|oficina|combo/.test(t)) ids = ["box-regalo", "box-surtida"];else
      if (/mate|clasic|clásic|maicena|coco/.test(t)) ids = ["maicena"];else
      if (/golos|premium|nuez|vainilla/.test(t)) ids = ["vainilla", "triple"].filter((x) => ITEM_BY_ID[x]);else
      ids = ["maicena", "box-surtida"];
      ids = ids.filter((id) => ITEM_BY_ID[id]).slice(0, 2);
      setRes({ pitch: "Por lo que buscás, te van a encantar estos. ¡Date el gusto!", ids });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="antojo" id="antojo">
      <div className="wrap">
        <div className="antojo-card" data-reveal="scale">
          <div className="glow"></div>
          <div className="antojo-inner">
            <div className="antojo-eyebrow"><TIcon name="spark" size={16} />Asistente de antojos</div>
            <h2>¿No sabés cuál elegir?<br /><span className="it">Contanos qué se te antoja.</span></h2>
            <p className="lead">Decinos para qué ocasión, qué sabor o qué se te cantó, y te recomendamos el alfajor perfecto en segundos.</p>
            <div className="antojo-form">
              <input className="antojo-input" value={q} placeholder="Ej: algo con dulce de leche para regalar…"
              onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => {if (e.key === "Enter") pedir();}} />
              <button className="btn btn-primary btn-lg" onClick={() => pedir()} disabled={loading}>
                {loading ? "Pensando…" : <React.Fragment><TIcon name="spark" size={18} />Recomendame</React.Fragment>}
              </button>
            </div>
            <div className="antojo-chips">
              {sugerencias.map((s) => <button className="antojo-chip" key={s} onClick={() => pedir(s)}>{s}</button>)}
            </div>

            {loading &&
            <div className="antojo-thinking">
                <span className="antojo-dots"><i></i><i></i><i></i></span> Buscando tu antojo ideal…
              </div>}

            {res && !loading &&
            <div className="antojo-result">
                <div className="antojo-pitch">“{res.pitch}”</div>
                <div className="antojo-recs">
                  {res.ids.map((id) => {
                  const it = ITEM_BY_ID[id];
                  return (
                    <div className="antojo-rec" key={id}>
                        <div className="ar-img"><img src={it.img} alt={it.name} /></div>
                        <div>
                          <div className="ar-name">{it.name}</div>
                          <div className="ar-price">{ARS(priceOf(it))}</div>
                        </div>
                        <button className="btn btn-primary btn-sm ar-add" onClick={() => onAdd(it)}><TIcon name="plus" size={16} />Agregar</button>
                      </div>);
                })}
                </div>
              </div>}

            <div className="antojo-ai"><span className="pulse"></span> Recomendaciones con IA · al instante</div>
          </div>
        </div>
      </div>
    </section>);
}

/* ---------- INTRO cinematográfico con mini-formulario in-page ---------- */
function IntroSplash({ onGoogle, onCreate, onLogin }) {
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {const t = setTimeout(() => setReady(true), 60);return () => clearTimeout(t);}, []);

  function leaveThen(fn) {
    if (leaving) return;
    setLeaving(true);
    setTimeout(fn, 760);
  }

  return (
    <div className={"intro" + (ready ? " go" : "") + (expanded ? " expanded" : "") + (leaving ? " leaving" : "")}>
      <div className="intro-bg" style={{ backgroundImage: "url(assets/intro-bg.jpg)" }}></div>
      <div className="intro-veil"></div>
      <div className="intro-glow"></div>

      {/* contenido central */}
      <div className="intro-content">
        <div className="intro-word" style={{ fontSize: "120px", opacity: "0.99", letterSpacing: "1.5px", margin: "0px", width: "558px", height: "154px", textAlign: "center" }}>Alito's</div>
        <div className="intro-sub" style={{ borderWidth: "0px", borderStyle: "solid", margin: "-46px", padding: "0px", borderRadius: "0px", opacity: "0.44", height: "60px" }}>De lo nuestro, lo mejor.</div>

        <div className="intro-cta">
          <button className="btn btn-primary btn-lg intro-begin" onClick={() => setExpanded(true)} style={{ backgroundColor: "rgb(160, 93, 24)", padding: "7px 6px", margin: "2px", borderWidth: "2px" }}>
            <TIcon name="spark" size={18} />Comenzar la experiencia
          </button>
        </div>

        {/* mini-formulario que se despliega */}
        <div className="intro-mini" aria-hidden={!expanded} style={{ width: "548px", height: "222px", margin: "26px 0px -36px" }}>
          <div className="intro-mini-inner" style={{ margin: "0px 115px -13px", backgroundColor: "rgba(17, 8, 5, 0.5)" }}>
            <button className="google-btn" onClick={() => leaveThen(onGoogle)} tabIndex={expanded ? 0 : -1}>
              <GoogleG />Continuar con Google
            </button>
            <div className="intro-mini-or">o</div>
            <button className="btn btn-glass btn-block btn-lg" onClick={() => leaveThen(onCreate)} tabIndex={expanded ? 0 : -1}>
              <TIcon name="mail" size={18} />Crear cuenta con email
            </button>
            <div className="intro-mini-foot">¿Ya tenés cuenta? <a onClick={() => leaveThen(onLogin)}>Ingresá</a></div>
          </div>
        </div>
      </div>

      {!expanded &&
      <div className="intro-scroll" onClick={() => setExpanded(true)}>
        <div className="mouse"></div>
        Comenzá acá
      </div>}
    </div>);
}

/* ---------- Product card ---------- */
function ProductCard({ item, mode, price, qty, onAdd, onQty }) {
  return (
    <div className="pcard">
      <div className="pcard-img">
        {item.tag && <span className={"pcard-tag" + (item.hot ? " hot" : "")}>{item.tag}</span>}
        <img className={item.photo ? "pcard-photo" : ""} src={item.img} alt={item.name} />
      </div>
      <div className="pcard-body">
        <div className="pcard-cat">{item.catLabel}</div>
        <div className="pcard-name">{item.name}</div>
        <div className="pcard-desc">{item.desc}</div>
        <div className="pcard-foot">
          <div className="price">
            <div className="p-now"><span className="cur">$</span>{price.toLocaleString("es-AR")}</div>
            {mode === "mayorista" ?
            <div className="p-may">Mayorista · caja x{item.minBox}</div> :
            <div className="p-unit">por unidad</div>}
          </div>
          {qty > 0 ?
          <div className="qty-inline">
                <button onClick={() => onQty(qty - 1)}><TIcon name="minus" size={16} /></button>
                <span>{qty}</span>
                <button onClick={() => onQty(qty + 1)}><TIcon name="plus" size={16} /></button>
              </div> :
          <button className="add-btn" onClick={onAdd}><TIcon name="plus" size={20} /></button>}
        </div>
      </div>
    </div>);

}

/* ---------- Box card ---------- */
function BoxCard({ item, mode, price, qty, onAdd, onQty }) {
  return (
    <div className="pcard">
      <div className="pcard-img">
        {item.tag && <span className={"pcard-tag" + (item.hot ? " hot" : "")}>{item.tag}</span>}
        <img className="pcard-photo" src={item.img} alt={item.name} />
      </div>
      <div className="pcard-body">
        <div className="pcard-cat">{item.catLabel} · {item.units} u.</div>
        <div className="pcard-name">{item.name}</div>
        <div className="pcard-desc">{item.desc}</div>
        <div className="pcard-foot">
          <div className="price">
            <div className="p-now"><span className="cur">$</span>{price.toLocaleString("es-AR")}</div>
            <div className="p-unit">{ARS(Math.round(price / item.units))} por unidad</div>
          </div>
          {qty > 0 ?
          <div className="qty-inline">
                <button onClick={() => onQty(qty - 1)}><TIcon name="minus" size={16} /></button>
                <span>{qty}</span>
                <button onClick={() => onQty(qty + 1)}><TIcon name="plus" size={16} /></button>
              </div> :
          <button className="add-btn" onClick={onAdd}><TIcon name="plus" size={20} /></button>}
        </div>
      </div>
    </div>);

}

/* ---------- Mayorista band ---------- */
function MayoristaBand({ mode }) {
  const isMay = mode === "mayorista";
  const bandRef = useRef(null);
  useEffect(() => {
    const el = bandRef.current;if (!el) return;
    const io = new IntersectionObserver((e) => {if (e[0].isIntersecting) {el.classList.add("in");io.disconnect();}}, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div className="band" ref={bandRef}>
      <div className="glow"></div>
      <div>
        <div className="eyebrow" style={{ color: "var(--amber-bright)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 10 }}>Para comercios</div>
        <h3>¿Tenés un kiosco, despensa o cafetería?</h3>
        <p>Comprá por caja con precios mayoristas, hasta 30% más baratos. Entregamos en tu local con reparto propio en Zona Oeste.</p>
        <div className="band-stats">
          <div className="s"><CountUp value="-30%" /><div className="k">vs. minorista</div></div>
          <div className="s"><CountUp value="24h" /><div className="k">entrega</div></div>
          <div className="s"><CountUp value="$0" /><div className="k">envío mayorista</div></div>
        </div>
        <button className="btn btn-primary btn-lg" style={{ marginTop: 26 }} onClick={() => document.getElementById("catalogo").scrollIntoView()}>
          <TIcon name="tag" size={18} />{isMay ? "Ver mi catálogo mayorista" : "Ver el catálogo"}
        </button>
      </div>
      <div className="band-feats">
        {[
        { ic: "box", t: "Pedido mínimo accesible", s: "Desde 1 caja por variedad" },
        { ic: "truck", t: "Reparto propio", s: "Coordinás día y horario" },
        { ic: "cash", t: "Pagás como quieras", s: "Efectivo, transferencia o MercadoPago" },
        { ic: "shield", t: "Mercadería fresca", s: "Elaboración del día, cambio garantizado" }].
        map((f, i) =>
        <div className="band-feat" key={i}>
            <div className="bf-ico"><TIcon name={f.ic} size={20} /></div>
            <div><div className="bf-t">{f.t}</div><div className="bf-s">{f.s}</div></div>
          </div>
        )}
      </div>
    </div>);

}

/* ---------- Cart drawer ---------- */
function CartDrawer({ open, items, mode, priceOf, subtotal, onClose, onQty, onCheckout, onShop }) {
  const shipping = mode === "mayorista" ? 0 : subtotal >= 12000 ? 0 : subtotal > 0 ? 1500 : 0;
  return (
    <aside className={"drawer" + (open ? " open" : "")}>
      <div className="drawer-head">
        <div><h3>Tu pedido</h3><div className="count">{items.reduce((a, i) => a + i.qty, 0)} productos</div></div>
        <button className="drawer-x" onClick={onClose}><TIcon name="x" size={18} /></button>
      </div>
      <div className="drawer-body">
        {items.length === 0 ?
        <div className="empty-cart"><TIcon name="cart" size={52} /><div style={{ fontSize: 15, fontWeight: 600, color: "var(--txt-2)", marginBottom: 6 }}>Tu carrito está vacío</div><div style={{ fontSize: 13 }}>Agregá alfajores para empezar</div><button className="btn btn-ghost btn-sm" style={{ marginTop: 18 }} onClick={onShop}>Ver catálogo</button></div> :
        items.map(({ item, qty }) =>
        <div className="cart-item" key={item.id}>
              <div className="ci-img"><img src={item.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ci-name">{item.name}</div>
                <div className="ci-meta">{ARS(priceOf(item))} {item.units ? "c/caja" : "c/u"}</div>
                <div className="ci-price">{ARS(priceOf(item) * qty)}</div>
              </div>
              <div className="ci-right">
                <div className="qty-inline">
                  <button onClick={() => onQty(item.id, qty - 1)}><TIcon name="minus" size={15} /></button>
                  <span>{qty}</span>
                  <button onClick={() => onQty(item.id, qty + 1)}><TIcon name="plus" size={15} /></button>
                </div>
                <button className="ci-remove" onClick={() => onQty(item.id, 0)}>Quitar</button>
              </div>
            </div>
        )}
      </div>
      {items.length > 0 &&
      <div className="drawer-foot">
          <div className="summary-row"><span>Subtotal</span><span className="tabular">{ARS(subtotal)}</span></div>
          <div className="summary-row"><span>Envío {mode === "mayorista" ? "(mayorista)" : ""}</span><span className="tabular">{shipping === 0 ? "Gratis" : ARS(shipping)}</span></div>
          <div className="summary-row total"><span>Total</span><span className="tabular"><span className="cur">$</span>{(subtotal + shipping).toLocaleString("es-AR")}</span></div>
          <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 16 }} onClick={onCheckout}>Finalizar pedido<TIcon name="check" size={18} /></button>
        </div>
      }
    </aside>);

}

/* ---------- Checkout ---------- */
function Checkout({ open, items, mode, priceOf, subtotal, onClose, onDone }) {
  const [step, setStep] = useState("form"); // form | done
  const [delivery, setDelivery] = useState("envio"); // envio | retiro
  const [pay, setPay] = useState("mp"); // efectivo | transfer | mp
  const [orderNo, setOrderNo] = useState("");
  const shipping = mode === "mayorista" || delivery === "retiro" ? 0 : subtotal >= 12000 ? 0 : 1500;
  const total = subtotal + shipping;

  function confirm() {
    setOrderNo("A" + Math.floor(1000 + Math.random() * 9000));
    setStep("done");
  }
  function close() {if (step === "done") onDone();setStep("form");setDelivery("envio");setPay("mp");onClose();}

  if (!open) return null;
  return (
    <div className="modal-scrim open" onClick={(e) => {if (e.target.classList.contains("modal-scrim")) close();}}>
      <div className="modal">
        {step === "form" ?
        <React.Fragment>
            <div className="modal-head">
              <div><h3>Finalizar pedido</h3><p>{items.reduce((a, i) => a + i.qty, 0)} productos · {ARS(total)}</p></div>
              <button className="modal-x" onClick={close}><TIcon name="x" size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="field-row">
                <div className="field"><label className="lab">Nombre</label><input className="input" placeholder="Tu nombre" /></div>
                <div className="field"><label className="lab">Teléfono</label><input className="input" placeholder="11 5555 5555" /></div>
              </div>

              <div className="field">
                <label className="lab">¿Cómo lo querés recibir?</label>
                <div className="opt-grid">
                  <button className={"opt" + (delivery === "envio" ? " sel" : "")} onClick={() => setDelivery("envio")}>
                    <div className="o-ico"><TIcon name="truck" size={18} /></div>
                    <div><div className="o-t">Envío a domicilio</div><div className="o-s">{mode === "mayorista" ? "Gratis" : subtotal >= 12000 ? "Gratis" : ARS(1500)} · 24-48h</div></div>
                  </button>
                  <button className={"opt" + (delivery === "retiro" ? " sel" : "")} onClick={() => setDelivery("retiro")}>
                    <div className="o-ico"><TIcon name="store" size={18} /></div>
                    <div><div className="o-t">Retiro en fábrica</div><div className="o-s">Gratis · Morón</div></div>
                  </button>
                </div>
              </div>

              {delivery === "envio" &&
            <div className="field"><label className="lab">Dirección de entrega</label><input className="input" placeholder="Calle, número, localidad" /></div>
            }

              <div className="field">
                <label className="lab">Medio de pago</label>
                <div className="pay-grid">
                  <button className={"pay" + (pay === "efectivo" ? " sel" : "")} onClick={() => setPay("efectivo")}>
                    <span className="pay-ico">💵</span><span className="pay-l">Efectivo</span></button>
                  <button className={"pay" + (pay === "transfer" ? " sel" : "")} onClick={() => setPay("transfer")}>
                    <span className="pay-ico">🏦</span><span className="pay-l">Transferencia</span></button>
                  <button className={"pay" + (pay === "mp" ? " sel" : "")} onClick={() => setPay("mp")}>
                    <span className="pay-ico">📱</span><span className="pay-l">MercadoPago</span></button>
                </div>
              </div>

              <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px" }}>
                <div className="summary-row"><span>Subtotal</span><span className="tabular">{ARS(subtotal)}</span></div>
                <div className="summary-row"><span>Envío</span><span className="tabular">{shipping === 0 ? "Gratis" : ARS(shipping)}</span></div>
                <div className="summary-row total"><span>Total</span><span className="tabular"><span className="cur">$</span>{total.toLocaleString("es-AR")}</span></div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={close} style={{ flex: "0 0 auto" }}>Volver</button>
              <button className="btn btn-primary btn-block" onClick={confirm}>Confirmar pedido · {ARS(total)}</button>
            </div>
          </React.Fragment> :

        <React.Fragment>
            <div className="modal-body" style={{ paddingTop: 36, paddingBottom: 30 }}>
              <div className="success">
                <div className="s-check"><TIcon name="check" size={42} sw={2.6} /></div>
                <h3>¡Pedido confirmado!</h3>
                <p>Gracias por tu compra. Te enviamos los detalles por email y te avisamos cuando esté en camino.</p>
                <div className="order-no">Pedido <b>#{orderNo}</b></div>
                <div style={{ display: "flex", gap: 12, marginTop: 14, justifyContent: "center", color: "var(--txt-3)", fontSize: 13 }}>
                  <span>{pay === "mp" ? "MercadoPago" : pay === "transfer" ? "Transferencia" : "Efectivo"}</span>·
                  <span>{delivery === "envio" ? "Envío a domicilio" : "Retiro en fábrica"}</span>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-primary btn-block btn-lg" onClick={close}>Seguir comprando</button>
            </div>
          </React.Fragment>
        }
      </div>
    </div>);

}

/* ---------- Footer ---------- */
function Footer() {
  return (
    <footer className="ftr" id="contacto">
      <div className="wrap">
        <div className="ftr-inner">
          <div>
            <div className="b-word">Alito's</div>
            <p style={{ marginTop: 14, maxWidth: 280 }}>Alfajores artesanales elaborados todos los días en nuestra fábrica de Morón, Zona Oeste. Del horno a tu casa.</p>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <a href="#" className="cart-btn" style={{ width: 40, height: 40 }}><TIcon name="ig" size={18} /></a>
              <a href="#" className="cart-btn" style={{ width: 40, height: 40 }}><TIcon name="wa" size={18} /></a>
              <a href="#" className="cart-btn" style={{ width: 40, height: 40 }}><TIcon name="mail" size={18} /></a>
            </div>
          </div>
          <div className="ftr-col">
            <h4>Tienda</h4>
            <a href="#catalogo">Alfajores</a><a href="#catalogo">Cajas y combos</a><a href="#mayorista">Mayorista</a>
          </div>
          <div className="ftr-col">
            <h4>Ayuda</h4>
            <a href="#">Cómo comprar</a><a href="#">Envíos y retiros</a><a href="#">Medios de pago</a>
          </div>
          <div className="ftr-col">
            <h4>Contacto</h4>
            <p>Av. Rivadavia 1820, Morón</p><p>11 5555-5555</p><p>hola@alitos.com</p>
          </div>
        </div>
        <div className="ftr-bottom">
          <span>© 2026 Alito's · Fábrica de alfajores artesanales</span>
          <span>Hecho con dulce de leche 🍯</span>
        </div>
      </div>
    </footer>);

}

Object.assign(window, { Store, Header, Hero, ProductCard, BoxCard, MayoristaBand, CartDrawer, Checkout, Footer });