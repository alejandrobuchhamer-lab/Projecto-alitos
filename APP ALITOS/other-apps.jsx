/* ===================== ALITO'S · App PRODUCCIÓN ===================== */
const { useState: oUseState, useContext: oUseContext, useEffect: oUseEffect, useRef: oUseRef } = React;

/* ══════════════════════════════════════════════════════════════════════
   MODAL CANTIDAD ALFAJORES — aparece al finalizar producción de armado
══════════════════════════════════════════════════════════════════════ */
function ModalCantidadAlfajores({ batch, onConfirm, onCancel }) {
  const [qty, setQty] = oUseState("");
  const inp = oUseRef(null);
  oUseEffect(() => { setTimeout(() => inp.current?.focus(), 100); }, []);

  const est = typeof batch?.tapasTeoricas === "number" ? batch.tapasTeoricas : null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "flex-end",
    }} onClick={onCancel}>
      <div style={{
        background: "var(--card)", width: "100%", borderRadius: "20px 20px 0 0",
        padding: "24px 20px 36px",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: "var(--border)", borderRadius: 99, margin: "0 auto 20px" }} />
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Alfajores terminados</div>
        <div style={{ fontSize: 13, color: "var(--txt-3)", marginBottom: 20 }}>
          ¿Cuántos alfajores armados en este lote?
          {est ? ` (estimado: ${est})` : ""}
        </div>
        <input ref={inp} type="number" min="1" step="1"
          value={qty} onChange={e => setQty(e.target.value)}
          placeholder={est ? String(est) : "ej: 240"}
          style={{
            width: "100%", background: "var(--card-2)", border: "1px solid var(--border)",
            borderRadius: 12, color: "var(--txt)", fontSize: 18, fontWeight: 700,
            padding: "14px 16px", outline: "none", fontFamily: "var(--font)",
            textAlign: "center", marginBottom: 16,
          }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "14px", borderRadius: 14, border: "1px solid var(--border)",
            background: "var(--card-2)", color: "var(--txt-3)", fontSize: 15, fontWeight: 600, cursor: "pointer",
          }}>Cancelar</button>
          <button onClick={() => { const n = parseFloat(qty) || est || 1; onConfirm(n); }} style={{
            flex: 2, padding: "14px", borderRadius: 14, border: "none",
            background: "var(--amber-bright)", color: "#1a0f00", fontSize: 15, fontWeight: 700, cursor: "pointer",
          }}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════════════════════ */
function ProduccionApp({ onLogout, user }) {
  const toast = oUseContext(ToastCtx);
  const [tab, setTab] = oUseState("lotes");
  const [batches, setBatches] = oUseState(() => BATCH_SEED.map(b => ({ ...b })));
  const [refreshKey, setRefreshKey] = oUseState(0);
  const [cantModal, setCantModal] = oUseState(null);
  const [profileOpen, setProfileOpen] = oUseState(false);
  const { notifs, unread, markRead } = useNotifs ? useNotifs() : { notifs: [], unread: 0, markRead: () => {} };
  const [notifOpen, setNotifOpen] = oUseState(false);

  function recargarLotes() {
    return new Promise(resolve => {
      fetchEtapasProduccion()
        .then(data => { if (data.length) setBatches(data); resolve(); })
        .catch(() => resolve());
    });
  }

  oUseEffect(() => { recargarLotes(); }, []);

  async function onRefresh() {
    setRefreshKey(k => k + 1);
    if (tab === "lotes") await recargarLotes();
    else await new Promise(r => setTimeout(r, 500));
  }

  async function advance(batch) {
    // Si es armado (stage === 2), pedir cantidad de alfajores
    if (batch.stage === 2 || batch.etapa?.toLowerCase?.().includes("armado")) {
      setCantModal(batch);
      return;
    }
    await doAdvance(batch.id, null);
  }

  async function doAdvance(id, cantidad) {
    setCantModal(null);
    try {
      await avanzarEtapaProduccion(id, cantidad);
      recargarLotes();
      toast(cantidad ? `${cantidad} alfajores registrados ✓` : "Etapa avanzada", "ok");
    } catch(e) {
      setBatches(bs => bs.map(b => {
        if (b.id !== id) return b;
        const nextIdx = typeof b.stage === "number" ? Math.min(b.stage + 1, 3) : 3;
        return { ...b, stage: nextIdx, progress: nextIdx >= 3 ? 100 : Math.min(100, (b.progress || 0) + 34) };
      }));
      toast("Avanzado (sin conexión)", "warn");
    }
  }

  const nav = [
    { id: "lotes",   icon: "factory", label: "En curso" },
    { id: "stock",   icon: "box",     label: "Stock"    },
    { id: "nueva",   icon: "plus",    label: "Producir" },
    { id: "insumos", icon: "package", label: "Insumos"  },
    { id: "compras", icon: "cart",    label: "Compras"  },
  ];

  return (
    <div className="screen-wrap">
      <AppBar leftLogo title="Fábrica"
        right={<NotifBell unread={unread} onClick={() => { setNotifOpen(true); markRead(); }} />}
        avatar={{ color: "var(--green)", txt: user?.first?.[0] || "F", onClick: () => setProfileOpen(true) }} />
      <PullToRefresh key={tab} onRefresh={onRefresh}>
        {tab === "lotes"   && <ProdHoy batches={batches} onAdvance={advance} />}
        {tab === "stock"   && <StockTerminado key={refreshKey} />}
        {tab === "insumos" && <StockInsumos key={refreshKey} />}
        {tab === "nueva"   && <NuevaProduccion user={user} toast={toast} onDone={() => { setTab("lotes"); recargarLotes(); }} />}
        {tab === "compras" && <RegistrarCompra toast={toast} />}
      </PullToRefresh>
      <BotNav items={nav} value={tab} onChange={setTab} />
      {cantModal && (
        <ModalCantidadAlfajores
          batch={cantModal}
          onConfirm={n => doAdvance(cantModal.id, n)}
          onCancel={() => setCantModal(null)}
        />
      )}
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} onLogout={onLogout} user={user} />
      <NotifSheet open={notifOpen} notifs={notifs} onClose={() => setNotifOpen(false)} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TAB 1 — LOTES EN CURSO
══════════════════════════════════════════════════════════════════════ */
const BATCH_SEED = [
  { id: 1, prod: "maicena", qty: 240, stage: "horno",   progress: 30  },
  { id: 2, prod: "dulce",   qty: 180, stage: "armado",  progress: 60  },
  { id: 3, prod: "choco",   qty: 200, stage: "empaque", progress: 85  },
  { id: 4, prod: "triple",  qty: 120, stage: "listo",   progress: 100 },
];
const STAGE = {
  horno:   { l: "En horno", c: "var(--red)",          soft: "var(--red-soft)"   },
  armado:  { l: "Armado",   c: "var(--amber-bright)", soft: "var(--amber-soft)" },
  empaque: { l: "Empaque",  c: "var(--blue)",         soft: "var(--blue-soft)"  },
  listo:   { l: "Listo",    c: "var(--green)",        soft: "var(--green-soft)" },
};
const STAGE_API = [
  { l: "Amasado", c: "var(--red)",          soft: "var(--red-soft)"   },
  { l: "Tapas",   c: "var(--amber-bright)", soft: "var(--amber-soft)" },
  { l: "Armado",  c: "var(--blue)",         soft: "var(--blue-soft)"  },
];

/* ══════════════════════════════════════════════════════════════════════
   TAB STOCK TERMINADO — alfajores listos en fábrica
══════════════════════════════════════════════════════════════════════ */
function StockTerminado() {
  const [lotes, setLotes] = oUseState([]);
  const [loading, setLoading] = oUseState(true);

  oUseEffect(() => {
    setLoading(true);
    fetchStockTerminado()
      .then(data => { setLotes(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const total = lotes.reduce((a, l) => a + (l.cantidad_actual || 0), 0);
  const proxVencer = lotes.filter(l => l.dias_para_vencer !== null && l.dias_para_vencer <= 5).length;

  return (
    <div className="anim-in pad-x stack gap-14" style={{ paddingTop: 16, paddingBottom: 80 }}>
      <div className="metric-grid">
        <div className="metric">
          <div className="m-ico" style={{ background: "var(--amber-soft)", color: "var(--amber-bright)" }}>
            <Icon name="box" size={17} />
          </div>
          <div className="m-label">Alfajores listos</div>
          <div className="m-val">{Math.round(total)} <span className="cur">u.</span></div>
        </div>
        <div className="metric">
          <div className="m-ico" style={{ background: proxVencer ? "var(--red-soft)" : "var(--green-soft)", color: proxVencer ? "var(--red)" : "var(--green)" }}>
            <Icon name="clock" size={17} />
          </div>
          <div className="m-label">Por vencer</div>
          <div className="m-val" style={{ color: proxVencer ? "var(--red)" : undefined }}>
            {proxVencer} <span className="cur">lotes</span>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--txt-3)" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
          <div style={{ fontSize: 13 }}>Cargando stock…</div>
        </div>
      )}

      {!loading && lotes.length === 0 && (
        <div className="card card-pad" style={{ textAlign: "center", padding: "36px 16px", color: "var(--txt-3)" }}>
          <Icon name="box" size={40} style={{ opacity: 0.3, display: "block", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, marginBottom: 4 }}>Sin alfajores terminados</div>
          <div style={{ fontSize: 12 }}>Cuando se finalice una producción de armado aparece aquí</div>
        </div>
      )}

      {!loading && lotes.length > 0 && (
        <div className="card">
          {lotes.map((l, i) => {
            const pct = l.cantidad_inicial > 0 ? Math.round((l.cantidad_actual / l.cantidad_inicial) * 100) : 100;
            const warn = l.dias_para_vencer !== null && l.dias_para_vencer <= 5;
            return (
              <div key={l.id}>
                <div className="lrow" style={{ padding: "14px 16px", alignItems: "center" }}>
                  <img src={_guessImg(l.producto)} style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} alt="" />
                  <div className="grow" style={{ marginLeft: 12, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 650 }}>{l.producto}</div>
                    <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 2 }}>
                      Lote {l.numero_lote}{l.operario ? ` · ${l.operario}` : ""} · {l.fecha_produccion}
                    </div>
                    <div style={{ height: 3, background: "var(--border)", borderRadius: 99, overflow: "hidden", marginTop: 5 }}>
                      <div style={{ height: "100%", width: pct + "%", borderRadius: 99, background: warn ? "var(--red)" : "var(--green)", transition: "width 0.4s" }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", marginLeft: 12, flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 750, color: warn ? "var(--red)" : "var(--txt)" }}>
                      {Math.round(l.cantidad_actual)}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--txt-3)" }}>unid.</div>
                    {warn && <div style={{ fontSize: 9.5, color: "var(--red)", fontWeight: 700 }}>⚠ {l.dias_para_vencer}d</div>}
                  </div>
                </div>
                {l.costo_unitario > 0 && (
                  <div style={{ fontSize: 11, color: "var(--txt-3)", padding: "0 16px 10px 72px" }}>
                    Costo unit: ${l.costo_unitario.toFixed(2)} · Total: ${(l.costo_unitario * l.cantidad_actual).toFixed(0)}
                  </div>
                )}
                {i < lotes.length - 1 && <div className="divider" style={{ marginLeft: 72 }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProdHoy({ batches, onAdvance }) {
  const done = batches.filter(b => b.stage === "listo" || b.progress >= 100).reduce((a, b) => a + b.qty, 0);
  const wip  = batches.filter(b => b.stage !== "listo" && b.progress < 100).reduce((a, b) => a + b.qty, 0);

  return (
    <div className="anim-in">
      <div className="hero">
        <div className="hero-hi">Turno activo 🔥</div>
        <div className="hero-name">Lotes en producción</div>
      </div>
      <div className="pad-x stack gap-14">
        <div className="metric-grid">
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--green-soft)", color: "var(--green)" }}><Icon name="check" size={17} /></div>
            <div className="m-label">Terminados</div>
            <div className="m-val">{done} <span className="cur">u.</span></div>
          </div>
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--amber-soft)", color: "var(--amber-bright)" }}><Icon name="flame" size={17} /></div>
            <div className="m-label">En proceso</div>
            <div className="m-val">{wip} <span className="cur">u.</span></div>
          </div>
        </div>

        {batches.length === 0 && (
          <div className="card card-pad" style={{ textAlign: "center", padding: "36px 16px", color: "var(--txt-3)" }}>
            <Icon name="factory" size={40} style={{ opacity: 0.3, display: "block", margin: "0 auto 12px" }} />
            <div style={{ fontSize: 14, marginBottom: 4 }}>Sin lotes activos</div>
            <div style={{ fontSize: 12 }}>Iniciá una nueva producción desde Producir</div>
          </div>
        )}

        <div className="stack gap-10">
          {batches.map(b => {
            const p = PROD_BY_ID[b.prod] || { name: b.prod || b.etapa || "Lote", img: "assets/alfajor-maicena.png" };
            const st = (typeof b.stage === "number" ? STAGE_API[b.stage] : STAGE[b.stage])
                     || { l: b.etapa || "En proceso", c: "var(--txt-3)", soft: "var(--card)" };
            const isListo = b.stage === "listo" || b.stage === 3 || b.progress >= 100;
            return (
              <div className="card card-pad" key={b.id}>
                <div className="row gap-12">
                  <div className="l-ava" style={{ borderRadius: 12, overflow: "hidden", background: "#1a140c", width: 44, height: 44, flexShrink: 0 }}>
                    <img src={p.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                  </div>
                  <div className="grow">
                    <div style={{ fontSize: 13.5, fontWeight: 650 }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--txt-3)", marginTop: 2 }}>
                      Lote #{b.id} · {b.qty} {b.unidad || "und"}{b.operario ? ` · ${b.operario}` : ""}
                    </div>
                  </div>
                  <span className="badge" style={{ background: st.soft, color: st.c, flexShrink: 0 }}>
                    <span className="bd" />{st.l}
                  </span>
                </div>
                <div className="pbar" style={{ marginTop: 12 }}>
                  <span style={{ width: (b.progress || 0) + "%", background: isListo ? "var(--green)" : undefined }} />
                </div>
                {!isListo && (
                  <button className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 12 }} onClick={() => onAdvance(b)}>
                    <Icon name="arrowRight" size={16} />
                    {b.stage === 2 || (b.etapa || "").toLowerCase().includes("armado") ? "Finalizar armado" : "Avanzar etapa"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TAB 2 — STOCK DE INSUMOS
══════════════════════════════════════════════════════════════════════ */
function StockInsumos() {
  const [insumos, setInsumos] = oUseState([]);
  const [loading, setLoading] = oUseState(true);
  const [q, setQ] = oUseState("");

  oUseEffect(() => {
    setLoading(true);
    fetchInsumos()
      .then(data => { setInsumos(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const lista = insumos.filter(i => !q || i.nombre.toLowerCase().includes(q.toLowerCase()));
  const bajoStock = insumos.filter(i => i.bajo_stock).length;

  return (
    <div className="anim-in pad-x stack gap-14" style={{ paddingTop: 16, paddingBottom: 80 }}>

      <div className="metric-grid">
        <div className="metric">
          <div className="m-ico" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>
            <Icon name="box" size={17} />
          </div>
          <div className="m-label">Materias primas</div>
          <div className="m-val">{insumos.length} <span className="cur">items</span></div>
        </div>
        <div className="metric">
          <div className="m-ico" style={{ background: bajoStock ? "var(--red-soft)" : "var(--green-soft)", color: bajoStock ? "var(--red)" : "var(--green)" }}>
            <Icon name="alert" size={17} />
          </div>
          <div className="m-label">Stock bajo</div>
          <div className="m-val" style={{ color: bajoStock ? "var(--red)" : undefined }}>
            {bajoStock} <span className="cur">alertas</span>
          </div>
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--txt-3)", pointerEvents: "none" }}>
          <Icon name="search" size={16} />
        </span>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar insumo…"
          style={{ width: "100%", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
            color: "var(--txt)", fontSize: 14, padding: "10px 14px 10px 38px", outline: "none" }} />
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--txt-3)" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
          <div style={{ fontSize: 13 }}>Cargando stock…</div>
        </div>
      )}

      {!loading && lista.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--txt-3)" }}>
          <Icon name="box" size={40} style={{ opacity: 0.3, display: "block", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 13 }}>Sin resultados</div>
        </div>
      )}

      {!loading && lista.length > 0 && (
        <div className="card">
          {lista.map((ins, i) => {
            const pct = ins.stock_minimo > 0
              ? Math.min(100, (ins.stock_actual / ins.stock_minimo) * 100)
              : 100;
            const low = ins.bajo_stock;
            return (
              <div key={ins.id}>
                <div className="lrow" style={{ padding: "13px 16px", alignItems: "center" }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: low ? "var(--red-soft)" : "var(--amber-soft)",
                    color: low ? "var(--red)" : "var(--amber-bright)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon name="package" size={18} />
                  </div>

                  <div className="grow" style={{ minWidth: 0, marginLeft: 12 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{ins.nombre}</div>
                    {ins.stock_minimo > 0 && (
                      <div style={{ height: 3, background: "var(--border)", borderRadius: 99, overflow: "hidden", margin: "4px 0" }}>
                        <div style={{
                          height: "100%", width: pct + "%", borderRadius: 99,
                          background: low ? "var(--red)" : "var(--green)",
                          transition: "width 0.4s ease",
                        }} />
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--txt-3)" }}>
                      {ins.stock_minimo > 0 ? `Mín: ${ins.stock_minimo} ${ins.unidad_medida}` : ins.unidad_medida}
                      {ins.proveedor_default ? ` · ${ins.proveedor_default}` : ""}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", marginLeft: 12, flexShrink: 0 }}>
                    <div style={{ fontSize: 19, fontWeight: 750, color: low ? "var(--red)" : "var(--txt)" }}>
                      {Math.round(ins.stock_actual * 10) / 10}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--txt-3)" }}>{ins.unidad_medida}</div>
                    {low && <div style={{ fontSize: 9.5, color: "var(--red)", fontWeight: 700, letterSpacing: "0.04em" }}>↓ BAJO</div>}
                  </div>
                </div>
                {i < lista.length - 1 && <div className="divider" style={{ marginLeft: 70 }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TAB 3 — INICIAR NUEVA PRODUCCIÓN
══════════════════════════════════════════════════════════════════════ */
function NuevaProduccion({ user, toast, onDone }) {
  const [tipo, setTipo] = oUseState(null);
  const [loading, setLoading] = oUseState(false);
  const [loadingOpts, setLoadingOpts] = oUseState(false);
  const [recetas, setRecetas] = oUseState([]);
  const [lotesMasa, setLotesMasa] = oUseState([]);
  const [lotesTapas, setLotesTapas] = oUseState([]);

  const [recetaId, setRecetaId] = oUseState("");
  const [cantRecetas, setCantRecetas] = oUseState("1");
  const [pesoMasaG, setPesoMasaG] = oUseState("");
  const [loteOrigenId, setLoteOrigenId] = oUseState("");
  const [operario, setOperario] = oUseState(((user?.name || user?.nombre || "").split(" ")[0]) || "");
  const [notas, setNotas] = oUseState("");

  oUseEffect(() => {
    if (!tipo) return;
    setLoadingOpts(true);
    setRecetaId(""); setLoteOrigenId("");
    const p = tipo === "masa"
      ? fetchRecetasActivas().then(d => setRecetas(d))
      : tipo === "tapas"
        ? fetchLotesMasaDisp().then(d => setLotesMasa(d))
        : fetchLotesTapasDisp().then(d => setLotesTapas(d));
    p.catch(() => toast("Error al cargar opciones", "err"))
     .finally(() => setLoadingOpts(false));
  }, [tipo]);

  async function submit() {
    if (!tipo) return;
    if (tipo === "masa" && !recetaId) { toast("Seleccioná una receta", "warn"); return; }
    if ((tipo === "tapas" || tipo === "armado") && !loteOrigenId) { toast("Seleccioná un lote origen", "warn"); return; }
    setLoading(true);
    try {
      await iniciarProduccion({
        tipo,
        recetaId:       recetaId ? +recetaId : null,
        cantidadRecetas: +cantRecetas || 1,
        operario:       operario || null,
        notas:          notas || null,
        pesoMasaG:      pesoMasaG ? +pesoMasaG : null,
        loteOrigenId:   loteOrigenId ? +loteOrigenId : null,
      });
      toast("¡Producción iniciada!", "ok");
      onDone();
    } catch(e) {
      toast((e?.message || "Error al iniciar").slice(0, 80), "err");
    } finally {
      setLoading(false);
    }
  }

  const TIPOS = [
    { id: "masa",   icon: "flame",   label: "Masa",   sub: "Amasado de ingredientes",      c: "var(--red)",          s: "var(--red-soft)"   },
    { id: "tapas",  icon: "package", label: "Tapas",  sub: "Horneado y recorte de tapas",  c: "var(--amber-bright)", s: "var(--amber-soft)" },
    { id: "armado", icon: "box",     label: "Armado", sub: "Armado y empaque de alfajores", c: "var(--blue)",         s: "var(--blue-soft)"  },
  ];

  const inp = {
    width: "100%", background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 12,
    color: "var(--txt)", fontSize: 14, padding: "12px 14px", outline: "none", fontFamily: "var(--font)",
  };

  return (
    <div className="anim-in pad-x stack gap-16" style={{ paddingTop: 16, paddingBottom: 80 }}>

      <div>
        <div className="section-title" style={{ marginBottom: 10 }}>¿Qué vas a producir?</div>
        <div className="stack gap-8">
          {TIPOS.map(t => (
            <button key={t.id} onClick={() => setTipo(t.id)} style={{
              background: tipo === t.id ? t.s : "var(--card)",
              border: "1.5px solid " + (tipo === t.id ? t.c : "var(--border)"),
              borderRadius: 14, padding: "14px 16px", cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 14, transition: "all 0.18s ease",
            }}>
              <div style={{
                width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                background: t.s, color: t.c,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name={t.icon} size={22} />
              </div>
              <div className="grow">
                <div style={{ fontSize: 15, fontWeight: 650, color: tipo === t.id ? t.c : "var(--txt)" }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginTop: 2 }}>{t.sub}</div>
              </div>
              {tipo === t.id && <Icon name="check" size={18} style={{ color: t.c, flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      </div>

      {tipo && (
        <div className="stack gap-12">
          <div className="divider" />

          {loadingOpts && (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--txt-3)", fontSize: 13 }}>
              Cargando opciones…
            </div>
          )}

          {!loadingOpts && tipo === "masa" && (
            <>
              <div>
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Receta</div>
                {recetas.length === 0
                  ? <div style={{ fontSize: 13, color: "var(--txt-3)", padding: "8px 0" }}>No hay recetas activas en el sistema</div>
                  : <select value={recetaId} onChange={e => setRecetaId(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                      <option value="">Seleccioná una receta…</option>
                      {recetas.map(r => (
                        <option key={r.id} value={r.id}>{r.nombre}{r.version ? ` v${r.version}` : ""}</option>
                      ))}
                    </select>
                }
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Cantidad de recetas</div>
                <input type="number" min="0.5" step="0.5" value={cantRecetas} onChange={e => setCantRecetas(e.target.value)} style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>
                  Peso total de masa (g) <span style={{ fontWeight: 400 }}>— opcional</span>
                </div>
                <input type="number" placeholder="ej: 5000" value={pesoMasaG} onChange={e => setPesoMasaG(e.target.value)} style={inp} />
              </div>
            </>
          )}

          {!loadingOpts && tipo === "tapas" && (
            <div>
              <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Lote de masa origen</div>
              {lotesMasa.length === 0
                ? <div style={{ fontSize: 13, color: "var(--txt-3)", padding: "8px 0" }}>No hay lotes de masa disponibles</div>
                : <select value={loteOrigenId} onChange={e => setLoteOrigenId(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                    <option value="">Seleccioná un lote…</option>
                    {lotesMasa.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.numero_lote} · {l.producto_nombre} · {Math.round(l.cantidad_actual)} unds
                      </option>
                    ))}
                  </select>
              }
            </div>
          )}

          {!loadingOpts && tipo === "armado" && (
            <div>
              <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Lote de tapas origen</div>
              {lotesTapas.length === 0
                ? <div style={{ fontSize: 13, color: "var(--txt-3)", padding: "8px 0" }}>No hay lotes de tapas disponibles</div>
                : <select value={loteOrigenId} onChange={e => setLoteOrigenId(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                    <option value="">Seleccioná un lote…</option>
                    {lotesTapas.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.numero_lote} · {l.producto_nombre} · {l.cantidad_actual} tapas
                      </option>
                    ))}
                  </select>
              }
            </div>
          )}

          {!loadingOpts && (
            <>
              <div>
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Operario</div>
                <input value={operario} onChange={e => setOperario(e.target.value)} placeholder="Nombre del operario" style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>
                  Notas <span style={{ fontWeight: 400 }}>— opcional</span>
                </div>
                <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones…" style={inp} />
              </div>

              <button onClick={submit} disabled={loading} style={{
                background: loading ? "var(--border)" : "var(--amber-bright)",
                color: loading ? "var(--txt-3)" : "#1a0f00",
                border: "none", borderRadius: 14, padding: "15px", fontSize: 15, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer", width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.18s ease",
              }}>
                {loading ? "Iniciando…" : <><Icon name="arrowRight" size={18} />Iniciar producción</>}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TAB 4 — REGISTRAR COMPRA DE INSUMOS
══════════════════════════════════════════════════════════════════════ */
function RegistrarCompra({ toast }) {
  const [insumos, setInsumos] = oUseState([]);
  const [loading, setLoading] = oUseState(false);
  const [loadingInsumos, setLoadingInsumos] = oUseState(true);
  const [q, setQ] = oUseState("");

  const [insumoId, setInsumoId] = oUseState("");
  const [cantidad, setCantidad] = oUseState("");
  const [costoUnit, setCostoUnit] = oUseState("");
  const [proveedor, setProveedor] = oUseState("");
  const [vencimiento, setVencimiento] = oUseState("");
  const [notas, setNotas] = oUseState("");

  oUseEffect(() => {
    fetchInsumos()
      .then(data => { setInsumos(data); setLoadingInsumos(false); })
      .catch(() => setLoadingInsumos(false));
  }, []);

  const insumoSel = insumos.find(i => String(i.id) === String(insumoId));
  const filtrados = insumos.filter(i => !q || i.nombre.toLowerCase().includes(q.toLowerCase()));

  function selectInsumo(ins) {
    setInsumoId(String(ins.id));
    setQ(ins.nombre);
    if (!proveedor && ins.proveedor_default) setProveedor(ins.proveedor_default);
  }

  function resetForm() {
    setInsumoId(""); setCantidad(""); setCostoUnit(""); setProveedor("");
    setVencimiento(""); setNotas(""); setQ("");
  }

  async function submit() {
    if (!insumoId)                { toast("Seleccioná un insumo", "warn"); return; }
    if (!cantidad || +cantidad <= 0) { toast("Ingresá la cantidad recibida", "warn"); return; }
    if (costoUnit === "" || +costoUnit < 0) { toast("Ingresá el costo por unidad (puede ser 0)", "warn"); return; }
    setLoading(true);
    try {
      await registrarCompraInsumo(+insumoId, {
        cantidad:         +cantidad,
        costoUnitario:    +costoUnit,
        proveedor:        proveedor || null,
        fechaVencimiento: vencimiento || null,
        notas:            notas || null,
      });
      toast("Ingreso registrado ✓", "ok");
      resetForm();
    } catch(e) {
      toast((e?.message || "Error al registrar").slice(0, 80), "err");
    } finally {
      setLoading(false);
    }
  }

  const inp = {
    width: "100%", background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 12,
    color: "var(--txt)", fontSize: 14, padding: "12px 14px", outline: "none", fontFamily: "var(--font)",
  };

  const totalCompra = cantidad && costoUnit && +cantidad > 0 && +costoUnit > 0
    ? +cantidad * +costoUnit : 0;

  return (
    <div className="anim-in pad-x stack gap-14" style={{ paddingTop: 16, paddingBottom: 80 }}>

      {/* Selección de insumo */}
      <div>
        <div className="section-title" style={{ marginBottom: 10 }}>¿Qué compraste?</div>

        {loadingInsumos ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--txt-3)", fontSize: 13 }}>
            Cargando insumos…
          </div>
        ) : (
          <>
            <div style={{ position: "relative", marginBottom: 8 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--txt-3)", pointerEvents: "none" }}>
                <Icon name="search" size={16} />
              </span>
              <input value={q} onChange={e => { setQ(e.target.value); if (insumoId) setInsumoId(""); }}
                placeholder="Buscar o elegir insumo…"
                style={{ ...inp, paddingLeft: 38 }} />
            </div>

            {(!insumoId || q !== (insumoSel?.nombre || "")) && (
              <div style={{
                maxHeight: 220, overflowY: "auto", borderRadius: 12,
                background: "var(--card)", border: "1px solid var(--border)",
              }}>
                {filtrados.length === 0
                  ? <div style={{ padding: "16px", color: "var(--txt-3)", fontSize: 13, textAlign: "center" }}>Sin resultados</div>
                  : filtrados.map((ins, i) => (
                    <div key={ins.id} onClick={() => selectInsumo(ins)} style={{
                      padding: "12px 16px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 12,
                      background: String(insumoId) === String(ins.id) ? "var(--amber-soft)" : "transparent",
                      borderBottom: i < filtrados.length - 1 ? "1px solid var(--border)" : "none",
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: 99, flexShrink: 0,
                        background: ins.bajo_stock ? "var(--red)" : "var(--green)",
                      }} />
                      <div className="grow">
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{ins.nombre}</div>
                        <div style={{ fontSize: 11, color: "var(--txt-3)" }}>
                          Stock: {Math.round(ins.stock_actual * 10) / 10} {ins.unidad_medida}
                          {ins.bajo_stock ? " · ⚠ bajo mínimo" : ""}
                        </div>
                      </div>
                      {String(insumoId) === String(ins.id) && <Icon name="check" size={16} style={{ color: "var(--amber-bright)" }} />}
                    </div>
                  ))
                }
              </div>
            )}
          </>
        )}
      </div>

      {/* Detalle del ingreso */}
      {insumoId && q === (insumoSel?.nombre || "") && (
        <div className="stack gap-12">
          <div className="divider" />

          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--txt-2)" }}>
            Ingreso de <span style={{ color: "var(--amber-bright)" }}>{insumoSel?.nombre}</span>
          </div>

          <div className="row gap-12">
            <div className="grow">
              <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>
                Cantidad ({insumoSel?.unidad_medida || "u."})
              </div>
              <input type="number" min="0" step="any" value={cantidad}
                onChange={e => setCantidad(e.target.value)} placeholder="0" style={inp} />
            </div>
            <div className="grow">
              <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>
                Costo / unidad ($)
              </div>
              <input type="number" min="0" step="any" value={costoUnit}
                onChange={e => setCostoUnit(e.target.value)} placeholder="0.00" style={inp} />
            </div>
          </div>

          {totalCompra > 0 && (
            <div style={{
              background: "var(--green-soft)", borderRadius: 12, padding: "12px 16px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 13, color: "var(--txt-3)" }}>Total de la compra</span>
              <span style={{ fontSize: 17, fontWeight: 750, color: "var(--green)" }}>{ARS(totalCompra)}</span>
            </div>
          )}

          <div>
            <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>
              Proveedor <span style={{ fontWeight: 400 }}>— opcional</span>
            </div>
            <input value={proveedor} onChange={e => setProveedor(e.target.value)}
              placeholder="Nombre del proveedor" style={inp} />
          </div>

          <div>
            <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>
              Fecha de vencimiento <span style={{ fontWeight: 400 }}>— opcional</span>
            </div>
            <input type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)}
              style={{ ...inp, colorScheme: "dark" }} />
          </div>

          <div>
            <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>
              Notas <span style={{ fontWeight: 400 }}>— opcional</span>
            </div>
            <input value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Nº de remito, observaciones…" style={inp} />
          </div>

          <button onClick={submit} disabled={loading} style={{
            background: loading ? "var(--border)" : "var(--green)",
            color: loading ? "var(--txt-3)" : "#001209",
            border: "none", borderRadius: 14, padding: "15px", fontSize: 15, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", width: "100%",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.18s ease",
          }}>
            {loading ? "Registrando…" : <><Icon name="download" size={18} />Registrar ingreso</>}
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PANEL FÁBRICA — embebido dentro del admin (chips de navegación propios)
══════════════════════════════════════════════════════════════════════ */
function FabricaPanel({ user, toast }) {
  const [sub, setSub] = oUseState("lotes");
  const [batches, setBatches] = oUseState(() => BATCH_SEED.map(b => ({ ...b })));
  const [cantModal, setCantModal] = oUseState(null);

  function recargarLotes() {
    fetchEtapasProduccion()
      .then(data => { if (data.length) setBatches(data); })
      .catch(() => {});
  }

  oUseEffect(() => { recargarLotes(); }, []);

  async function advance(batch) {
    if (batch.stage === 2 || (batch.etapa || "").toLowerCase().includes("armado")) {
      setCantModal(batch);
      return;
    }
    await doAdvance(batch.id, null);
  }

  async function doAdvance(id, cantidad) {
    setCantModal(null);
    try {
      await avanzarEtapaProduccion(id, cantidad);
      recargarLotes();
      toast(cantidad ? `${cantidad} alfajores registrados ✓` : "Etapa avanzada", "ok");
    } catch {
      setBatches(bs => bs.map(b => {
        if (b.id !== id) return b;
        const nextIdx = typeof b.stage === "number" ? Math.min(b.stage + 1, 3) : 3;
        return { ...b, stage: nextIdx, progress: nextIdx >= 3 ? 100 : Math.min(100, (b.progress || 0) + 34) };
      }));
      toast("Avanzado (sin conexión)", "warn");
    }
  }

  const CHIPS = [
    { id: "lotes",   icon: "factory", label: "En curso" },
    { id: "stock",   icon: "box",     label: "Stock"    },
    { id: "nueva",   icon: "plus",    label: "Producir" },
    { id: "insumos", icon: "package", label: "Insumos"  },
    { id: "compras", icon: "cart",    label: "Compras"  },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{
        display: "flex", gap: 8, padding: "12px 16px 4px",
        overflowX: "auto", scrollbarWidth: "none", flexShrink: 0,
        borderBottom: "1px solid var(--border)",
      }}>
        {CHIPS.map(c => {
          const active = sub === c.id;
          return (
            <button key={c.id} onClick={() => setSub(c.id)} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 99, border: "none",
              background: active ? "var(--amber-bright)" : "var(--card)",
              color: active ? "#1a0f00" : "var(--txt-3)",
              fontSize: 13, fontWeight: active ? 700 : 500,
              cursor: "pointer", flexShrink: 0,
              transition: "all 0.15s ease",
            }}>
              <Icon name={c.icon} size={14} sw={active ? 2.4 : 2} />
              {c.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }} key={sub}>
        {sub === "lotes"   && <ProdHoy batches={batches} onAdvance={advance} />}
        {sub === "stock"   && <StockTerminado />}
        {sub === "insumos" && <StockInsumos />}
        {sub === "nueva"   && <NuevaProduccion user={user} toast={toast} onDone={() => { setSub("lotes"); recargarLotes(); }} />}
        {sub === "compras" && <RegistrarCompra toast={toast} />}
      </div>

      {cantModal && (
        <ModalCantidadAlfajores
          batch={cantModal}
          onConfirm={n => doAdvance(cantModal.id, n)}
          onCancel={() => setCantModal(null)}
        />
      )}
    </div>
  );
}

Object.assign(window, { ProduccionApp, FabricaPanel });
