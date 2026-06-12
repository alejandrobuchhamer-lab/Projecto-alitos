/* ===================== ALITO'S · App PRODUCCIÓN ===================== */
const { useState: oUseState, useContext: oUseContext, useEffect: oUseEffect } = React;

function ProduccionApp({ onLogout, user }) {
  const toast = oUseContext(ToastCtx);
  const [tab, setTab] = oUseState("hoy");
  const [batches, setBatches] = oUseState(() => BATCH_SEED.map(b => ({ ...b })));

  oUseEffect(() => {
    fetchEtapasProduccion().then(data => { if (data.length) setBatches(data); }).catch(() => {});
  }, []);

  async function advance(id) {
    const batch = batches.find(b => b.id === id);
    try {
      await avanzarEtapaProduccion(id);
      // Recargar desde el backend
      fetchEtapasProduccion().then(data => { if (data.length) setBatches(data); }).catch(() => {});
      if (batch) {
        pushNotif({ kind: "prod", who: "Producción", color: "var(--green)", title: "Lote finalizado", sub: `${batch.etapa || "Producción"} · ${batch.qty} u.`, dir: "info" });
      }
      toast("Lote marcado como finalizado", "ok");
    } catch(e) {
      // fallback visual si el backend falla
      setBatches(bs => bs.map(b => {
        if (b.id !== id) return b;
        const nextIdx = typeof b.stage === "number" ? Math.min(b.stage + 1, 3) : 3;
        return { ...b, stage: nextIdx, progress: nextIdx >= 3 ? 100 : Math.min(100, (b.progress || 0) + 34) };
      }));
      toast("Etapa avanzada (pendiente de sincronizar)", "warn");
    }
  }
  const nav = [
    { id: "hoy", icon: "factory", label: "Producción" },
    { id: "stock", icon: "box", label: "Stock fábrica" },
  ];
  return (
    <div className="screen-wrap">
      <AppBar leftLogo title="Producción · fábrica" userName={(user && user.name) || "Carlos Sosa"}
        right={<NotifBell unread={0} onClick={() => toast("2 productos con stock bajo", "warn")} />}
        avatar={{ color: "var(--green)", txt: (user && user.avatar) || "CS", onClick: onLogout }} />
      <div className="scroll" key={tab}>
        {tab === "hoy" && <ProdHoy batches={batches} onAdvance={advance} />}
        {tab === "stock" && <ProdStock />}
      </div>
      <BotNav items={nav} value={tab} onChange={setTab} />
    </div>
  );
}
const BATCH_SEED = [
  { id: 1, prod: "maicena", qty: 240, stage: "horno", progress: 30 },
  { id: 2, prod: "dulce", qty: 180, stage: "armado", progress: 60 },
  { id: 3, prod: "choco", qty: 200, stage: "empaque", progress: 85 },
  { id: 4, prod: "triple", qty: 120, stage: "listo", progress: 100 },
];
// Claves string (mock local)
const STAGE = { horno: { l: "En horno", c: "var(--red)", soft: "var(--red-soft)" }, armado: { l: "Armado", c: "var(--amber-bright)", soft: "var(--amber-soft)" }, empaque: { l: "Empaque", c: "var(--blue)", soft: "var(--blue-soft)" }, listo: { l: "Listo", c: "var(--green)", soft: "var(--green-soft)" } };
// Índices numéricos (datos del sistema: 0=masa, 1=tapas, 2=armado)
const STAGE_API = [
  { l: "Amasado", c: "var(--red)",          soft: "var(--red-soft)"   },
  { l: "Tapas",   c: "var(--amber-bright)",  soft: "var(--amber-soft)" },
  { l: "Armado",  c: "var(--blue)",          soft: "var(--blue-soft)"  },
];
function ProdHoy({ batches, onAdvance }) {
  const done = batches.filter(b => b.stage === "listo").reduce((a, b) => a + b.qty, 0);
  const wip = batches.filter(b => b.stage !== "listo").reduce((a, b) => a + b.qty, 0);
  return (
    <div className="anim-in">
      <div className="hero"><div className="hero-hi">Turno mañana 🔥</div><div className="hero-name">Producción de hoy</div></div>
      <div className="pad-x stack gap-14">
        <div className="metric-grid">
          <div className="metric"><div className="m-ico" style={{ background: "var(--green-soft)", color: "var(--green)" }}><Icon name="check" size={17} /></div><div className="m-label">Terminados</div><div className="m-val">{done} <span className="cur">u.</span></div></div>
          <div className="metric"><div className="m-ico" style={{ background: "var(--amber-soft)", color: "var(--amber-bright)" }}><Icon name="flame" size={17} /></div><div className="m-label">En proceso</div><div className="m-val">{wip} <span className="cur">u.</span></div></div>
        </div>
        <div>
          <div className="section-title">Lotes en curso</div>
          <div className="stack gap-10">
            {batches.map(b => {
              const p = PROD_BY_ID[b.prod] || { name: b.prod || b.etapa || "Lote", img: "assets/alfajor-maicena.png", price: 0 };
              const st = (typeof b.stage === "number" ? STAGE_API[b.stage] : STAGE[b.stage])
                       || { l: b.etapa || "En proceso", c: "var(--txt-3)", soft: "var(--card)" };
              const isListo = b.stage === "listo" || b.stage === 3 || b.progress >= 100;
              return (
                <div className="card card-pad" key={b.id}>
                  <div className="row gap-12">
                    <div className="l-ava" style={{ borderRadius: 12, overflow: "hidden", background: "#1a140c", width: 44, height: 44 }}><img src={p.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /></div>
                    <div className="grow">
                      <div style={{ fontSize: 13.5, fontWeight: 650 }}>{p.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--txt-3)", marginTop: 2 }}>Lote #{b.id} · {b.qty} {b.unidad || "und"}{b.operario ? ` · ${b.operario}` : ""}</div>
                    </div>
                    <span className="badge" style={{ background: st.soft, color: st.c }}><span className="bd" />{st.l}</span>
                  </div>
                  <div className="pbar" style={{ marginTop: 12 }}><span style={{ width: (b.progress || 0) + "%", background: isListo ? "var(--green)" : undefined }} /></div>
                  {!isListo && <button className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 12 }} onClick={() => onAdvance(b.id)}><Icon name="arrowRight" size={16} />Avanzar etapa</button>}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
function ProdStock() {
  const [productos, setProductos] = oUseState([]);
  oUseEffect(() => {
    apiGet("/productos/api").then(data => setProductos(data)).catch(() => {});
  }, []);
  const lista = productos.length ? productos : PRODUCTS.map(p => ({ id: p.id, nombre: p.name, precio_venta_base: p.price, stock_actual: 0, stock_minimo: 50 }));
  return (
    <div className="anim-in pad stack gap-12">
      <div className="section-title" style={{ marginBottom: 0 }}>Stock disponible en fábrica</div>
      <div className="card">
        {lista.map((p, i) => {
          const mock = PROD_BY_ID[p.id] || { img: "assets/alfajor-maicena.png" };
          const n = Math.round(p.stock_actual || 0);
          const low = n < (p.stock_minimo || 50);
          return (
            <div key={p.id}>
              <div className="lrow">
                <div className="l-ava" style={{ borderRadius: 12, overflow: "hidden", background: "#1a140c" }}>
                  <img src={mock.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                </div>
                <div className="grow">
                  <div className="l-name" style={{ fontSize: 13.5 }}>{p.nombre}</div>
                  <div className="l-sub">{ARS(p.precio_venta_base || 0)} c/u</div>
                </div>
                <div className="l-right">
                  <div style={{ fontSize: 19, fontWeight: 750, color: low ? "var(--red)" : "var(--txt)" }}>{n}</div>
                  {low ? <span className="badge red" style={{ marginTop: 3 }}>Stock bajo</span> : <div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>unidades</div>}
                </div>
              </div>
              {i < lista.length - 1 && <div className="divider" style={{ marginLeft: 69 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { ProduccionApp });
