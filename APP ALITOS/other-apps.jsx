/* ===================== ALITO'S · App PRODUCCIÓN ===================== */
const { useState: oUseState, useContext: oUseContext, useEffect: oUseEffect, useRef: oUseRef } = React;

/* ══════════════════════════════════════════════════════════════════════
   SHEET DE FINALIZACIÓN — se adapta al tipo de producción (masa/tapas/armado)
══════════════════════════════════════════════════════════════════════ */
function FinalizarProduccionSheet({ batch, onConfirm, onCancel }) {
  const tipo = batch?.tipo || (batch?.stage === 0 ? "masa" : batch?.stage === 1 ? "tapas" : "armado");
  const est  = batch?.qty;

  const [notas,           setNotas]           = oUseState("");
  // Masa
  const [masaRealG,       setMasaRealG]       = oUseState("");
  // Tapas
  const [tapasReales,     setTapasReales]     = oUseState("");
  const [tapasRotas,      setTapasRotas]      = oUseState("0");
  const [masaDesperc,     setMasaDesperc]     = oUseState("");
  const [pesoCrudo,       setPesoCrudo]       = oUseState("");
  const [horasHorno,      setHorasHorno]      = oUseState("");
  // Armado
  const [cantidad,        setCantidad]        = oUseState("");
  const [diasVenc,        setDiasVenc]        = oUseState("30");

  const inp = {
    width: "100%", background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 12,
    color: "var(--txt)", fontSize: 14, padding: "12px 14px", outline: "none", fontFamily: "var(--font)",
  };

  const TITULO  = { masa: "Finalizar masa", tapas: "Finalizar tapas", armado: "Finalizar armado" };
  const BTN_CLR = { masa: "var(--red)", tapas: "var(--amber-bright)", armado: "var(--amber-bright)" };
  const BTN_TXT = { masa: "#fff", tapas: "#1a0f00", armado: "#1a0f00" };

  function confirm() {
    const data = {};
    if (notas) data.notas = notas;
    if (tipo === "masa") {
      if (masaRealG) data.masa_real_g = +masaRealG;
      if (masaRealG) data.cantidad    = +masaRealG;
    } else if (tipo === "tapas") {
      data.tapas_reales = tapasReales ? +tapasReales : (est ? Math.round(est) : undefined);
      if (tapasRotas)   data.tapas_rotas = +tapasRotas;
      if (masaDesperc)  data.masa_desperdiciada_g = +masaDesperc;
      if (pesoCrudo)    data.peso_tapa_cruda_promedio_g = +pesoCrudo;
      if (horasHorno)   data.horas_horno_total = +horasHorno;
    } else {
      data.cantidad = cantidad ? +cantidad : (est ? Math.round(est) : 1);
      data.dias_vencimiento = diasVenc ? +diasVenc : 30;
    }
    onConfirm(data);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "flex-end",
    }} onClick={onCancel}>
      <div style={{
        background: "var(--card)", width: "100%", borderRadius: "20px 20px 0 0",
        padding: "24px 20px 36px", maxHeight: "92vh", overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: "var(--border)", borderRadius: 99, margin: "0 auto 20px" }} />
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{TITULO[tipo] || "Finalizar"}</div>
        <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 20 }}>
          {batch?.prod}{est ? ` · ${Math.round(est)} ${batch?.unidad || "und"} estimados` : ""}
        </div>

        <div className="stack gap-12">
          {tipo === "masa" && (
            <div>
              <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>
                Peso real de masa (g) <span style={{ fontWeight: 400 }}>— opcional</span>
              </div>
              <input type="number" min="0" step="any" value={masaRealG} onChange={e => setMasaRealG(e.target.value)}
                placeholder="ej: 5000" style={inp} autoFocus />
            </div>
          )}

          {tipo === "tapas" && (<>
            <div>
              <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Tapas producidas</div>
              <input type="number" min="0" step="1" value={tapasReales} onChange={e => setTapasReales(e.target.value)}
                placeholder={est ? String(Math.round(est)) : "ej: 480"} style={{ ...inp, fontWeight: 700, fontSize: 18, textAlign: "center" }} autoFocus />
            </div>
            <div className="row gap-12">
              <div className="grow">
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Tapas rotas</div>
                <input type="number" min="0" step="1" value={tapasRotas} onChange={e => setTapasRotas(e.target.value)}
                  placeholder="0" style={inp} />
              </div>
              <div className="grow">
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Masa desperdicios (g)</div>
                <input type="number" min="0" step="any" value={masaDesperc} onChange={e => setMasaDesperc(e.target.value)}
                  placeholder="0" style={inp} />
              </div>
            </div>
            <div className="row gap-12">
              <div className="grow">
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Peso tapa cruda (g)</div>
                <input type="number" min="0" step="0.1" value={pesoCrudo} onChange={e => setPesoCrudo(e.target.value)}
                  placeholder="ej: 12.5" style={inp} />
              </div>
              <div className="grow">
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Horas de horno</div>
                <input type="number" min="0" step="0.25" value={horasHorno} onChange={e => setHorasHorno(e.target.value)}
                  placeholder="ej: 2.5" style={inp} />
              </div>
            </div>
          </>)}

          {tipo === "armado" && (<>
            <div>
              <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Alfajores terminados</div>
              <input type="number" min="1" step="1" value={cantidad} onChange={e => setCantidad(e.target.value)}
                placeholder={est ? String(Math.round(est)) : "ej: 240"}
                style={{ ...inp, fontSize: 20, fontWeight: 750, textAlign: "center" }} autoFocus />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>
                Días hasta vencimiento <span style={{ fontWeight: 400 }}>— default: 30</span>
              </div>
              <input type="number" min="1" max="365" value={diasVenc} onChange={e => setDiasVenc(e.target.value)}
                placeholder="30" style={inp} />
            </div>
          </>)}

          <div>
            <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>
              Notas <span style={{ fontWeight: 400 }}>— opcional</span>
            </div>
            <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones…" style={inp} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "14px", borderRadius: 14, border: "1px solid var(--border)",
            background: "var(--card-2)", color: "var(--txt-3)", fontSize: 15, fontWeight: 600, cursor: "pointer",
          }}>Cancelar</button>
          <button onClick={confirm} style={{
            flex: 2, padding: "14px", borderRadius: 14, border: "none",
            background: BTN_CLR[tipo] || "var(--amber-bright)", color: BTN_TXT[tipo] || "#1a0f00",
            fontSize: 15, fontWeight: 700, cursor: "pointer",
          }}>Confirmar finalización</button>
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
  const [finalizarModal, setFinalizarModal] = oUseState(null);
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

  function advance(batch) {
    setFinalizarModal(batch);
  }

  async function doAdvance(id, data) {
    setFinalizarModal(null);
    try {
      await avanzarEtapaProduccion(id, data || {});
      recargarLotes();
      const msg = data?.cantidad ? `${data.cantidad} alfajores registrados ✓`
                : data?.tapas_reales ? `${data.tapas_reales} tapas registradas ✓`
                : "Producción finalizada ✓";
      toast(msg, "ok");
    } catch(e) {
      setBatches(bs => bs.map(b => {
        if (b.id !== id) return b;
        const nextIdx = typeof b.stage === "number" ? Math.min(b.stage + 1, 3) : 3;
        return { ...b, stage: nextIdx, progress: nextIdx >= 3 ? 100 : Math.min(100, (b.progress || 0) + 34) };
      }));
      toast((e?.message || "Avanzado (sin conexión)").slice(0, 80), "warn");
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
      {finalizarModal && (
        <FinalizarProduccionSheet
          batch={finalizarModal}
          onConfirm={data => doAdvance(finalizarModal.id, data)}
          onCancel={() => setFinalizarModal(null)}
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
  const [detalleOpen, setDetalleOpen] = oUseState(false);
  const [detalle, setDetalle] = oUseState(null);
  const [loadingDetalle, setLoadingDetalle] = oUseState(false);

  oUseEffect(() => {
    setLoading(true);
    fetchStockTerminado()
      .then(data => { setLotes(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function verDetalle(lote) {
    setDetalleOpen(true);
    setDetalle(null);
    setLoadingDetalle(true);
    fetchCostoDetalleAlfajor(lote.id)
      .then(d => { setDetalle(d); setLoadingDetalle(false); })
      .catch(() => { setDetalle({ tiene_datos: false, numero_lote: lote.numero_lote }); setLoadingDetalle(false); });
  }

  const total = lotes.reduce((a, l) => a + (l.cantidad_actual || 0), 0);
  const valorTotal = lotes.reduce((a, l) => a + (l.cantidad_actual || 0) * (l.costo_unitario || 0), 0);
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
      {valorTotal > 0 && (
        <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
          <div className="m-ico" style={{ background: "var(--green-soft)", color: "var(--green)", width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="dollar" size={16} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--txt-3)", fontWeight: 500 }}>Costo total en stock</div>
            <div style={{ fontSize: 17, fontWeight: 750, color: "var(--txt)" }}>{ARS(Math.round(valorTotal))}</div>
          </div>
        </div>
      )}

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
                <button onClick={() => verDetalle(l)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
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
                </button>
                <div style={{ fontSize: 11, color: "var(--txt-3)", padding: "0 16px 10px 72px", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span>Costo/u: {l.costo_unitario > 0 ? ARS(l.costo_unitario) : "—"}</span>
                  {l.costo_unitario > 0 && <span>Valor stock: {ARS(Math.round(l.costo_unitario * l.cantidad_actual))}</span>}
                  {l.fecha_vencimiento && <span>Vence: {l.fecha_vencimiento}</span>}
                  <span style={{ color: "var(--amber-bright)" }}>Ver costos ›</span>
                </div>
                {i < lotes.length - 1 && <div className="divider" style={{ marginLeft: 72 }} />}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Detalle de costos por lote ────────────────────────── */}
      {detalleOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setDetalleOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
          <div style={{ position: "relative", background: "var(--card)", borderRadius: "20px 20px 0 0", maxHeight: "88vh", overflowY: "auto", paddingBottom: 32 }}>
            {/* Handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
              <div style={{ width: 40, height: 4, borderRadius: 99, background: "var(--border)" }} />
            </div>
            {/* Header */}
            <div style={{ padding: "8px 20px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--txt-3)", textTransform: "uppercase", letterSpacing: 1 }}>Análisis de costos</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>
                {loadingDetalle ? "Cargando…" : detalle ? detalle.producto : "Sin datos"}
              </div>
              {detalle && <div style={{ fontSize: 11, color: "var(--txt-3)" }}>Lote {detalle.numero_lote}</div>}
            </div>

            {loadingDetalle && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--txt-3)", fontSize: 13 }}>Calculando costos…</div>
            )}

            {!loadingDetalle && detalle && !detalle.tiene_datos && (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Sin trazabilidad</div>
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginTop: 4 }}>Este lote no tiene registros de producción vinculados.</div>
              </div>
            )}

            {!loadingDetalle && detalle && detalle.tiene_datos && (
              <div style={{ padding: "16px 20px 0" }}>
                {/* KPIs globales */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
                  <div style={{ background: "var(--surface)", borderRadius: 12, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: "var(--txt-3)" }}>Unidades</div>
                    <div style={{ fontSize: 18, fontWeight: 750 }}>{detalle.cantidad_inicial}</div>
                  </div>
                  <div style={{ background: "var(--surface)", borderRadius: 12, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: "var(--txt-3)" }}>Costo/u</div>
                    <div style={{ fontSize: 18, fontWeight: 750 }}>{ARS(detalle.costo_unitario)}</div>
                  </div>
                  <div style={{ background: "var(--surface)", borderRadius: 12, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: "var(--txt-3)" }}>Total lote</div>
                    <div style={{ fontSize: 18, fontWeight: 750 }}>{ARS(detalle.costo_total)}</div>
                  </div>
                </div>

                {/* Etapas */}
                {detalle.etapas.map((etapa, ei) => (
                  <div key={ei} style={{ marginBottom: 16 }}>
                    {/* Etapa header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 18 }}>
                        {etapa.icono === "box" ? "📦" : etapa.icono === "flame" ? "🔥" : "🌾"}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{etapa.etapa}</div>
                      <div style={{ flex: 1 }} />
                      <div style={{ fontSize: 13, fontWeight: 650, color: "var(--txt-2)" }}>{ARS(etapa.subtotal)}</div>
                    </div>

                    {/* Items */}
                    <div style={{ background: "var(--surface)", borderRadius: 12, overflow: "hidden" }}>
                      {etapa.items.map((item, ii) => (
                        <div key={ii}>
                          <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.nombre}</div>
                              <div style={{ fontSize: 11, color: "var(--txt-3)" }}>
                                {item.cantidad % 1 === 0 ? item.cantidad : item.cantidad.toFixed(2)} {item.unidad}
                                {item.costo_unitario > 0 && <span> · {ARS(item.costo_unitario)}/{item.unidad}</span>}
                              </div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 650, flexShrink: 0 }}>{ARS(item.costo_total)}</div>
                          </div>
                          {ii < etapa.items.length - 1 && <div style={{ height: 1, background: "var(--border)", marginLeft: 14 }} />}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Total footer */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "var(--green-soft)", borderRadius: 12, marginTop: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--green)" }}>Costo total</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--green)" }}>{ARS(detalle.costo_total)}</div>
                </div>
              </div>
            )}
          </div>
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
                    {b.tipo === "armado" || b.stage === 2 ? "Finalizar armado"
                     : b.tipo === "tapas" || b.stage === 1 ? "Finalizar tapas"
                     : "Finalizar masa"}
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
  const valorTotal = insumos.reduce((a, i) => a + (i.valor_stock || 0), 0);

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
      {valorTotal > 0 && (
        <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
          <div className="m-ico" style={{ background: "var(--amber-soft)", color: "var(--amber-bright)", width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="dollar" size={16} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--txt-3)", fontWeight: 500 }}>Valor total del stock</div>
            <div style={{ fontSize: 17, fontWeight: 750, color: "var(--txt)" }}>{ARS(Math.round(valorTotal))}</div>
          </div>
        </div>
      )}

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
                      {ins.costo_unitario_promedio > 0
                        ? `${ARS(ins.costo_unitario_promedio)} / ${ins.unidad_medida}`
                        : ins.unidad_medida}
                      {ins.stock_minimo > 0 ? ` · mín: ${ins.stock_minimo}` : ""}
                    </div>
                    {ins.valor_stock > 0 && (
                      <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 1 }}>
                        Stock: {ARS(ins.valor_stock)}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: "right", marginLeft: 12, flexShrink: 0 }}>
                    <div style={{ fontSize: 19, fontWeight: 750, color: low ? "var(--red)" : "var(--txt)" }}>
                      {Math.round(ins.stock_actual * 100) / 100}
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
  const [pesoTapaMinG, setPesoTapaMinG] = oUseState("");
  const [pesoTapaMaxG, setPesoTapaMaxG] = oUseState("");
  const [pesoTapaObjetivoG, setPesoTapaObjetivoG] = oUseState("");
  const [cantidadTapasAUsar, setCantidadTapasAUsar] = oUseState("");
  const [loteOrigenId, setLoteOrigenId] = oUseState("");
  const [operario, setOperario] = oUseState(((user?.name || user?.nombre || "").split(" ")[0]) || "");
  const [notas, setNotas] = oUseState("");

  oUseEffect(() => {
    if (!tipo) return;
    setLoadingOpts(true);
    setRecetaId(""); setLoteOrigenId(""); setCantidadTapasAUsar(""); setPesoTapaObjetivoG("");
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
        recetaId:         recetaId ? +recetaId : null,
        cantidadRecetas:  +cantRecetas || 1,
        operario:         operario || null,
        notas:            notas || null,
        pesoMasaG:        pesoMasaG        ? +pesoMasaG        : null,
        pesoTapaMinG:     pesoTapaMinG     ? +pesoTapaMinG     : null,
        pesoTapaMaxG:     pesoTapaMaxG     ? +pesoTapaMaxG     : null,
        pesoTapaObjetivoG: pesoTapaObjetivoG ? +pesoTapaObjetivoG : null,
        cantidadTapasAUsar: cantidadTapasAUsar ? +cantidadTapasAUsar : null,
        loteOrigenId:     loteOrigenId ? +loteOrigenId : null,
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
              <div className="row gap-12">
                <div className="grow">
                  <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>
                    Tapa mín (g) <span style={{ fontWeight: 400 }}>— opc.</span>
                  </div>
                  <input type="number" step="0.1" placeholder="ej: 11" value={pesoTapaMinG} onChange={e => setPesoTapaMinG(e.target.value)} style={inp} />
                </div>
                <div className="grow">
                  <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>
                    Tapa máx (g) <span style={{ fontWeight: 400 }}>— opc.</span>
                  </div>
                  <input type="number" step="0.1" placeholder="ej: 14" value={pesoTapaMaxG} onChange={e => setPesoTapaMaxG(e.target.value)} style={inp} />
                </div>
              </div>
            </>
          )}

          {!loadingOpts && tipo === "tapas" && (<>
            <div>
              <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Lote de masa origen</div>
              {lotesMasa.length === 0
                ? <div style={{ fontSize: 13, color: "var(--txt-3)", padding: "8px 0" }}>No hay lotes de masa disponibles</div>
                : <select value={loteOrigenId} onChange={e => setLoteOrigenId(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                    <option value="">Seleccioná un lote…</option>
                    {lotesMasa.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.numero_lote} · {l.producto_nombre} · {Math.round(l.cantidad_actual)} unds
                        {l.peso_tapa_objetivo_g ? ` · obj: ${l.peso_tapa_objetivo_g}g` : ""}
                      </option>
                    ))}
                  </select>
              }
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>
                Peso objetivo por tapa (g) <span style={{ fontWeight: 400 }}>— opcional</span>
              </div>
              <input type="number" step="0.1" placeholder="ej: 12.5" value={pesoTapaObjetivoG} onChange={e => setPesoTapaObjetivoG(e.target.value)} style={inp} />
            </div>
          </>)}

          {!loadingOpts && tipo === "armado" && (<>
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
            <div>
              <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>
                Tapas a usar <span style={{ fontWeight: 400 }}>— opcional, deja en blanco para usar todas</span>
              </div>
              <input type="number" min="1" step="1" placeholder="ej: 480" value={cantidadTapasAUsar} onChange={e => setCantidadTapasAUsar(e.target.value)} style={inp} />
            </div>
          </>)}

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
   Modos: Simple | Por bultos | Masivo (multi-insumo + flete)
══════════════════════════════════════════════════════════════════════ */
function InsumoDropdown({ insumos, insumoId, q, setQ, onSelect, inp }) {
  const filtrados = insumos.filter(i => !q || i.nombre.toLowerCase().includes(q.toLowerCase()));
  const insumoSel = insumos.find(i => String(i.id) === String(insumoId));
  const showDropdown = !insumoId || q !== (insumoSel?.nombre || "");
  return (
    <>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--txt-3)", pointerEvents: "none" }}>
          <Icon name="search" size={16} />
        </span>
        <input value={q} onChange={e => { setQ(e.target.value); if (insumoId) onSelect(null); }}
          placeholder="Buscar insumo…" style={{ ...inp, paddingLeft: 38 }} />
      </div>
      {showDropdown && filtrados.length > 0 && (
        <div style={{ maxHeight: 200, overflowY: "auto", borderRadius: 12, background: "var(--card)", border: "1px solid var(--border)", marginTop: 6 }}>
          {filtrados.map((ins, i) => (
            <div key={ins.id} onClick={() => onSelect(ins)} style={{
              padding: "11px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
              background: String(insumoId) === String(ins.id) ? "var(--amber-soft)" : "transparent",
              borderBottom: i < filtrados.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              <div style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: ins.bajo_stock ? "var(--red)" : "var(--green)" }} />
              <div className="grow">
                <div style={{ fontSize: 13, fontWeight: 500 }}>{ins.nombre}</div>
                <div style={{ fontSize: 11, color: "var(--txt-3)" }}>
                  {Math.round(ins.stock_actual * 10) / 10} {ins.unidad_medida}{ins.bajo_stock ? " · ⚠ bajo mín." : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function RegistrarCompra({ toast }) {
  const [insumos, setInsumos] = oUseState([]);
  const [loadingInsumos, setLoadingInsumos] = oUseState(true);
  const [loading, setLoading] = oUseState(false);
  const [modo, setModo] = oUseState("simple"); // "simple" | "bultos" | "masivo"

  // Simple / Bultos state
  const [insumoId, setInsumoId] = oUseState("");
  const [q, setQ] = oUseState("");
  const [cantidad, setCantidad] = oUseState("");
  const [costoUnit, setCostoUnit] = oUseState("");
  const [proveedor, setProveedor] = oUseState("");
  const [vencimiento, setVencimiento] = oUseState("");
  const [notas, setNotas] = oUseState("");
  const [numeroLote, setNumeroLote] = oUseState("");
  // Bultos extra
  const [tipoPres, setTipoPres] = oUseState("bolsa");
  const [cantBultos, setCantBultos] = oUseState("");
  const [unidadesPorBulto, setUnidadesPorBulto] = oUseState("");
  const [precioPorBulto, setPrecioPorBulto] = oUseState("");

  // Masivo state
  const [filas, setFilas] = oUseState([{ id: 1, insumoId: "", q: "", cantBultos: "", unidadesPorBulto: "1", precioPorBulto: "", vencimiento: "" }]);
  const [flete, setFlete] = oUseState("");
  const [provMasivo, setProvMasivo] = oUseState("");
  const [notasMasivo, setNotasMasivo] = oUseState("");

  oUseEffect(() => {
    fetchInsumos()
      .then(data => { setInsumos(data); setLoadingInsumos(false); })
      .catch(() => setLoadingInsumos(false));
  }, []);

  const insumoSel = insumos.find(i => String(i.id) === String(insumoId));

  function selectInsumo(ins) {
    if (!ins) { setInsumoId(""); return; }
    setInsumoId(String(ins.id));
    setQ(ins.nombre);
    if (!proveedor && ins.proveedor_default) setProveedor(ins.proveedor_default);
  }

  function resetForm() {
    setInsumoId(""); setCantidad(""); setCostoUnit(""); setProveedor("");
    setVencimiento(""); setNotas(""); setQ(""); setNumeroLote("");
    setCantBultos(""); setUnidadesPorBulto(""); setPrecioPorBulto("");
  }

  const inp = {
    width: "100%", background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 12,
    color: "var(--txt)", fontSize: 14, padding: "12px 14px", outline: "none", fontFamily: "var(--font)",
  };

  // ── Modo simple ──────────────────────────────────────────────
  const totalSimple = cantidad && costoUnit && +cantidad > 0 && +costoUnit > 0 ? +cantidad * +costoUnit : 0;

  async function submitSimple() {
    if (!insumoId) { toast("Seleccioná un insumo", "warn"); return; }
    if (!cantidad || +cantidad <= 0) { toast("Ingresá la cantidad", "warn"); return; }
    if (costoUnit === "" || +costoUnit < 0) { toast("Ingresá el costo unitario", "warn"); return; }
    setLoading(true);
    try {
      await registrarCompraInsumo(+insumoId, {
        cantidad: +cantidad, costoUnitario: +costoUnit,
        proveedor: proveedor || null, fechaVencimiento: vencimiento || null,
        notas: notas || null, numeroLote: numeroLote || null,
      });
      toast("Ingreso registrado ✓", "ok");
      resetForm();
    } catch(e) { toast((e?.message || "Error").slice(0, 80), "err"); }
    finally { setLoading(false); }
  }

  // ── Modo bultos ──────────────────────────────────────────────
  const cantTotal = cantBultos && unidadesPorBulto ? +cantBultos * +unidadesPorBulto : null;
  const costoCalc = precioPorBulto && unidadesPorBulto && +unidadesPorBulto > 0 ? +precioPorBulto / +unidadesPorBulto : null;
  const totalBultos = cantBultos && precioPorBulto ? +cantBultos * +precioPorBulto : 0;

  async function submitBultos() {
    if (!insumoId) { toast("Seleccioná un insumo", "warn"); return; }
    if (!cantBultos || +cantBultos <= 0) { toast("Ingresá la cantidad de bultos", "warn"); return; }
    if (!unidadesPorBulto || +unidadesPorBulto <= 0) { toast("Ingresá unidades por bulto", "warn"); return; }
    if (precioPorBulto === "" || +precioPorBulto < 0) { toast("Ingresá el precio por bulto", "warn"); return; }
    setLoading(true);
    try {
      await registrarCompraInsumo(+insumoId, {
        cantidad: +cantBultos * +unidadesPorBulto,
        costoUnitario: +precioPorBulto / +unidadesPorBulto,
        tipoPresentacion: tipoPres,
        cantidadBultos: +cantBultos,
        unidadesPorBulto: +unidadesPorBulto,
        precioPorBulto: +precioPorBulto,
        proveedor: proveedor || null, fechaVencimiento: vencimiento || null,
        notas: notas || null, numeroLote: numeroLote || null,
      });
      toast("Ingreso registrado ✓", "ok");
      resetForm();
    } catch(e) { toast((e?.message || "Error").slice(0, 80), "err"); }
    finally { setLoading(false); }
  }

  // ── Modo masivo ──────────────────────────────────────────────
  function addFila() {
    setFilas(fs => [...fs, { id: Date.now(), insumoId: "", q: "", cantBultos: "", unidadesPorBulto: "1", precioPorBulto: "", vencimiento: "" }]);
  }
  function removeFila(id) {
    setFilas(fs => fs.length > 1 ? fs.filter(f => f.id !== id) : fs);
  }
  function updateFila(id, key, val) {
    setFilas(fs => fs.map(f => f.id === id ? { ...f, [key]: val } : f));
  }
  function selectFilaInsumo(id, ins) {
    if (!ins) { updateFila(id, "insumoId", ""); return; }
    setFilas(fs => fs.map(f => f.id === id ? { ...f, insumoId: String(ins.id), q: ins.nombre } : f));
  }

  const totalMasivoSinFlete = filas.reduce((acc, f) => {
    const sub = f.cantBultos && f.precioPorBulto ? +f.cantBultos * +f.precioPorBulto : 0;
    return acc + sub;
  }, 0);
  const totalMasivo = totalMasivoSinFlete + (+flete || 0);

  async function submitMasivo() {
    const itemsValidos = filas.filter(f => f.insumoId && f.cantBultos && +f.cantBultos > 0 && f.precioPorBulto !== "");
    if (itemsValidos.length === 0) { toast("Agregá al menos un insumo con cantidad y precio", "warn"); return; }
    setLoading(true);
    try {
      await registrarIngresoMasivo({
        proveedor: provMasivo || null,
        notas: notasMasivo || null,
        flete: flete ? +flete : 0,
        items: itemsValidos.map(f => ({
          insumoId: +f.insumoId,
          tipoPresentacion: "unidad",
          cantidadBultos: +f.cantBultos,
          unidadesPorBulto: +f.unidadesPorBulto || 1,
          precioPorBulto: +f.precioPorBulto,
          fechaVencimiento: f.vencimiento || null,
        })),
      });
      toast(`${itemsValidos.length} insumos registrados ✓`, "ok");
      setFilas([{ id: Date.now(), insumoId: "", q: "", cantBultos: "", unidadesPorBulto: "1", precioPorBulto: "", vencimiento: "" }]);
      setFlete(""); setProvMasivo(""); setNotasMasivo("");
    } catch(e) { toast((e?.message || "Error").slice(0, 80), "err"); }
    finally { setLoading(false); }
  }

  const MODOS = [
    { id: "simple", label: "Simple" },
    { id: "bultos", label: "Por bultos" },
    { id: "masivo", label: "Masivo" },
  ];

  return (
    <div className="anim-in pad-x stack gap-14" style={{ paddingTop: 16, paddingBottom: 80 }}>

      {/* Selector de modo */}
      <div style={{ display: "flex", gap: 8 }}>
        {MODOS.map(m => (
          <button key={m.id} onClick={() => setModo(m.id)} style={{
            padding: "7px 14px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
            background: modo === m.id ? "var(--amber-bright)" : "var(--card)",
            color: modo === m.id ? "#1a0f00" : "var(--txt-3)",
            transition: "all 0.15s",
          }}>{m.label}</button>
        ))}
      </div>

      {loadingInsumos && modo !== "masivo" && (
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--txt-3)", fontSize: 13 }}>Cargando insumos…</div>
      )}

      {/* ── MODO SIMPLE ── */}
      {!loadingInsumos && modo === "simple" && (<>
        <div>
          <div className="section-title" style={{ marginBottom: 8 }}>¿Qué compraste?</div>
          <InsumoDropdown insumos={insumos} insumoId={insumoId} q={q} setQ={setQ} onSelect={selectInsumo} inp={inp} />
        </div>
        {insumoId && q === (insumoSel?.nombre || "") && (
          <div className="stack gap-12">
            <div className="divider" />
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--txt-2)" }}>
              Ingreso de <span style={{ color: "var(--amber-bright)" }}>{insumoSel?.nombre}</span>
            </div>
            <div className="row gap-12">
              <div className="grow">
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Cantidad ({insumoSel?.unidad_medida || "u."})</div>
                <input type="number" min="0" step="any" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="0" style={inp} />
              </div>
              <div className="grow">
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Costo / unidad ($)</div>
                <input type="number" min="0" step="any" value={costoUnit} onChange={e => setCostoUnit(e.target.value)} placeholder="0.00" style={inp} />
              </div>
            </div>
            {totalSimple > 0 && (
              <div style={{ background: "var(--green-soft)", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--txt-3)" }}>Total</span>
                <span style={{ fontSize: 17, fontWeight: 750, color: "var(--green)" }}>{ARS(totalSimple)}</span>
              </div>
            )}
            <div>
              <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Proveedor — opcional</div>
              <input value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Nombre del proveedor" style={inp} />
            </div>
            <div className="row gap-12">
              <div className="grow">
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Vencimiento — opcional</div>
                <input type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)} style={{ ...inp, colorScheme: "dark" }} />
              </div>
              <div className="grow">
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Nº Lote — opcional</div>
                <input value={numeroLote} onChange={e => setNumeroLote(e.target.value)} placeholder="ej: L-2024-001" style={inp} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Notas — opcional</div>
              <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Nº remito, observaciones…" style={inp} />
            </div>
            <button onClick={submitSimple} disabled={loading} style={{
              background: loading ? "var(--border)" : "var(--green)", color: loading ? "var(--txt-3)" : "#001209",
              border: "none", borderRadius: 14, padding: "15px", fontSize: 15, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", width: "100%",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              {loading ? "Registrando…" : <><Icon name="download" size={18} />Registrar ingreso</>}
            </button>
          </div>
        )}
      </>)}

      {/* ── MODO BULTOS ── */}
      {!loadingInsumos && modo === "bultos" && (<>
        <div>
          <div className="section-title" style={{ marginBottom: 8 }}>¿Qué compraste?</div>
          <InsumoDropdown insumos={insumos} insumoId={insumoId} q={q} setQ={setQ} onSelect={selectInsumo} inp={inp} />
        </div>
        {insumoId && q === (insumoSel?.nombre || "") && (
          <div className="stack gap-12">
            <div className="divider" />
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--txt-2)" }}>
              Ingreso por bultos — <span style={{ color: "var(--amber-bright)" }}>{insumoSel?.nombre}</span>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Tipo de presentación</div>
              <select value={tipoPres} onChange={e => setTipoPres(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                {["bolsa","saco","caja","bidón","tambor","fardo","paquete"].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="row gap-12">
              <div className="grow">
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Cantidad de {tipoPres}s</div>
                <input type="number" min="1" step="1" value={cantBultos} onChange={e => setCantBultos(e.target.value)} placeholder="ej: 3" style={inp} />
              </div>
              <div className="grow">
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Unidades / {tipoPres}</div>
                <input type="number" min="1" step="any" value={unidadesPorBulto} onChange={e => setUnidadesPorBulto(e.target.value)} placeholder="ej: 50" style={inp} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Precio por {tipoPres} ($)</div>
              <input type="number" min="0" step="any" value={precioPorBulto} onChange={e => setPrecioPorBulto(e.target.value)} placeholder="0.00" style={inp} />
            </div>
            {cantTotal !== null && costoCalc !== null && (
              <div style={{ background: "var(--blue-soft)", borderRadius: 12, padding: "12px 16px" }} className="stack gap-4">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--txt-3)" }}>Total unidades</span>
                  <span style={{ fontWeight: 700 }}>{Math.round(cantTotal * 100) / 100} {insumoSel?.unidad_medida || "u."}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--txt-3)" }}>Costo unitario</span>
                  <span style={{ fontWeight: 700 }}>{ARS(costoCalc)} / {insumoSel?.unidad_medida || "u."}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--txt-3)" }}>Total compra</span>
                  <span style={{ fontWeight: 750, fontSize: 17, color: "var(--blue)" }}>{ARS(totalBultos)}</span>
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Proveedor — opcional</div>
              <input value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Nombre del proveedor" style={inp} />
            </div>
            <div className="row gap-12">
              <div className="grow">
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Vencimiento — opcional</div>
                <input type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)} style={{ ...inp, colorScheme: "dark" }} />
              </div>
              <div className="grow">
                <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Nº Lote — opcional</div>
                <input value={numeroLote} onChange={e => setNumeroLote(e.target.value)} placeholder="del proveedor" style={inp} />
              </div>
            </div>
            <button onClick={submitBultos} disabled={loading} style={{
              background: loading ? "var(--border)" : "var(--green)", color: loading ? "var(--txt-3)" : "#001209",
              border: "none", borderRadius: 14, padding: "15px", fontSize: 15, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", width: "100%",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              {loading ? "Registrando…" : <><Icon name="download" size={18} />Registrar {cantBultos || "?"} {tipoPres}s</>}
            </button>
          </div>
        )}
      </>)}

      {/* ── MODO MASIVO ── */}
      {modo === "masivo" && (
        <div className="stack gap-12">
          <div style={{ fontSize: 13, color: "var(--txt-3)" }}>
            Registrá múltiples insumos de una misma compra. El flete se distribuye proporcionalmente.
          </div>

          {filas.map((fila, idx) => {
            const filaSel = insumos.find(i => String(i.id) === String(fila.insumoId));
            const subtotal = fila.cantBultos && fila.precioPorBulto ? +fila.cantBultos * +fila.precioPorBulto : 0;
            return (
              <div key={fila.id} style={{ background: "var(--card)", borderRadius: 14, padding: "14px 16px" }} className="stack gap-10">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--amber-bright)" }}>Insumo {idx + 1}</div>
                  {filas.length > 1 && (
                    <button onClick={() => removeFila(fila.id)} style={{
                      background: "none", border: "none", color: "var(--red)", cursor: "pointer", padding: "2px 6px", fontSize: 18,
                    }}>×</button>
                  )}
                </div>
                <InsumoDropdown
                  insumos={insumos} insumoId={fila.insumoId} q={fila.q}
                  setQ={v => updateFila(fila.id, "q", v)}
                  onSelect={ins => selectFilaInsumo(fila.id, ins)}
                  inp={{ ...inp, fontSize: 13, padding: "10px 12px 10px 36px" }}
                />
                <div className="row gap-10">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "var(--txt-3)", marginBottom: 4 }}>Cantidad</div>
                    <input type="number" min="1" step="any" value={fila.cantBultos}
                      onChange={e => updateFila(fila.id, "cantBultos", e.target.value)}
                      placeholder="0" style={{ ...inp, fontSize: 13, padding: "10px 12px" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "var(--txt-3)", marginBottom: 4 }}>Precio total ($)</div>
                    <input type="number" min="0" step="any" value={fila.precioPorBulto}
                      onChange={e => updateFila(fila.id, "precioPorBulto", e.target.value)}
                      placeholder="0.00" style={{ ...inp, fontSize: 13, padding: "10px 12px" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "var(--txt-3)", marginBottom: 4 }}>Venc.</div>
                    <input type="date" value={fila.vencimiento}
                      onChange={e => updateFila(fila.id, "vencimiento", e.target.value)}
                      style={{ ...inp, fontSize: 12, padding: "10px 8px", colorScheme: "dark" }} />
                  </div>
                </div>
                {subtotal > 0 && (
                  <div style={{ fontSize: 12, color: "var(--txt-3)", textAlign: "right" }}>
                    Subtotal: <span style={{ color: "var(--txt)", fontWeight: 600 }}>{ARS(subtotal)}</span>
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={addFila} style={{
            background: "none", border: "1.5px dashed var(--border)", borderRadius: 12,
            color: "var(--amber-bright)", padding: "12px", fontSize: 14, fontWeight: 600,
            cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Icon name="plus" size={16} />Agregar insumo
          </button>

          <div className="divider" />

          <div>
            <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Flete / Costo extra ($) — opcional</div>
            <input type="number" min="0" step="any" value={flete} onChange={e => setFlete(e.target.value)} placeholder="0.00" style={inp} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Proveedor global — opcional</div>
            <input value={provMasivo} onChange={e => setProvMasivo(e.target.value)} placeholder="Nombre del proveedor" style={inp} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--txt-3)", marginBottom: 6, fontWeight: 500 }}>Notas — opcional</div>
            <input value={notasMasivo} onChange={e => setNotasMasivo(e.target.value)} placeholder="Nº remito, observaciones…" style={inp} />
          </div>

          {totalMasivoSinFlete > 0 && (
            <div style={{ background: "var(--green-soft)", borderRadius: 12, padding: "14px 16px" }} className="stack gap-6">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--txt-3)" }}>Subtotal insumos</span>
                <span style={{ fontWeight: 600 }}>{ARS(totalMasivoSinFlete)}</span>
              </div>
              {+flete > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--txt-3)" }}>Flete</span>
                  <span style={{ fontWeight: 600 }}>{ARS(+flete)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 750, color: "var(--green)" }}>{ARS(totalMasivo)}</span>
              </div>
            </div>
          )}

          <button onClick={submitMasivo} disabled={loading} style={{
            background: loading ? "var(--border)" : "var(--green)", color: loading ? "var(--txt-3)" : "#001209",
            border: "none", borderRadius: 14, padding: "15px", fontSize: 15, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", width: "100%",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {loading ? "Registrando…" : <><Icon name="download" size={18} />Registrar {filas.filter(f => f.insumoId && f.cantBultos).length} insumos</>}
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
  const [finalizarModal, setFinalizarModal] = oUseState(null);

  function recargarLotes() {
    fetchEtapasProduccion()
      .then(data => { if (data.length) setBatches(data); })
      .catch(() => {});
  }

  oUseEffect(() => { recargarLotes(); }, []);

  function advance(batch) { setFinalizarModal(batch); }

  async function doAdvance(id, data) {
    setFinalizarModal(null);
    try {
      await avanzarEtapaProduccion(id, data || {});
      recargarLotes();
      const msg = data?.cantidad ? `${data.cantidad} alfajores registrados ✓`
                : data?.tapas_reales ? `${data.tapas_reales} tapas registradas ✓`
                : "Producción finalizada ✓";
      toast(msg, "ok");
    } catch(e) {
      setBatches(bs => bs.map(b => {
        if (b.id !== id) return b;
        const nextIdx = typeof b.stage === "number" ? Math.min(b.stage + 1, 3) : 3;
        return { ...b, stage: nextIdx, progress: nextIdx >= 3 ? 100 : Math.min(100, (b.progress || 0) + 34) };
      }));
      toast((e?.message || "Error").slice(0, 80), "warn");
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

      {finalizarModal && (
        <FinalizarProduccionSheet
          batch={finalizarModal}
          onConfirm={data => doAdvance(finalizarModal.id, data)}
          onCancel={() => setFinalizarModal(null)}
        />
      )}
    </div>
  );
}

Object.assign(window, { ProduccionApp, FabricaPanel });
