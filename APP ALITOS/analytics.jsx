/* ===================== ALITO'S · Analytics / BI ===================== */
const { useState: biUseState, useEffect: biUseEffect } = React;

function AnalyticsView() {
  const [data, setData] = biUseState(null);
  const [dias, setDias] = biUseState(14);
  const [loading, setLoading] = biUseState(true);

  function reload(d) {
    setLoading(true);
    fetchAnalytics(d || dias).then(r => { setData(r); setLoading(false); }).catch(() => setLoading(false));
  }
  biUseEffect(() => reload(), []);
  function changeDias(d) { setDias(d); reload(d); }

  if (loading || !data) {
    return <div className="anim-in pad stack gap-14" style={{ paddingTop: 32 }}>
      <div className="empty"><Icon name="chart" size={44} /><div>Cargando analytics…</div></div>
    </div>;
  }

  const { kpis, ventas_por_dia, top_productos, ranking_vendedores, formas_pago } = data;
  const maxBar = Math.max(...ventas_por_dia.map(d => d.monto), 1);
  const maxProd = Math.max(...top_productos.map(p => p.unidades), 1);
  const maxVend = Math.max(...ranking_vendedores.map(v => v.monto), 1);

  const PAGO_LABEL = { efectivo: "💵 Efectivo", qr: "📱 MercadoPago", transferencia: "🏦 Transferencia" };
  const totalPago = formas_pago.reduce((a, f) => a + f.total, 0) || 1;

  return (
    <div className="anim-in">
      <div className="hero">
        <div className="hero-hi">Resultados reales</div>
        <div className="hero-name">Analytics · BI</div>
      </div>
      <div className="pad-x stack gap-14">

        {/* ── KPIs del día ── */}
        <div className="metric-grid">
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--green-soft)", color: "var(--green)" }}><Icon name="cash" size={17} /></div>
            <div className="m-label">Hoy</div>
            <div className="m-val"><span className="cur">$</span>{ARSc(kpis.monto_hoy)}</div>
          </div>
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--amber-soft)", color: "var(--amber-bright)" }}><Icon name="cart" size={17} /></div>
            <div className="m-label">Unidades hoy</div>
            <div className="m-val">{kpis.unidades_hoy}</div>
          </div>
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}><Icon name="wallet" size={17} /></div>
            <div className="m-label">Mes actual</div>
            <div className="m-val"><span className="cur">$</span>{ARSc(kpis.monto_mes)}</div>
          </div>
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--red-soft)", color: "var(--red)" }}><Icon name="clock" size={17} /></div>
            <div className="m-label">A cobrar</div>
            <div className="m-val"><span className="cur">$</span>{ARSc(kpis.cobros_pendientes)}</div>
          </div>
        </div>

        {/* ticket promedio */}
        <div className="card card-pad row between" style={{ alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--txt-2)" }}>Ticket promedio del mes</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--amber-bright)", marginTop: 2 }}>{ARS(kpis.ticket_promedio)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "var(--txt-2)" }}>Esta semana</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{ARS(kpis.monto_semana)}</div>
          </div>
        </div>

        {/* ── Gráfico barras ventas por día ── */}
        <div>
          <div className="row between" style={{ margin: "4px 2px 10px" }}>
            <div className="section-title" style={{ margin: 0 }}>Ventas por día</div>
            <div className="chip-row" style={{ marginBottom: 0, gap: 6 }}>
              {[7, 14, 30].map(d => (
                <button key={d} className={"chip" + (dias === d ? " active" : "")} onClick={() => changeDias(d)}>{d}d</button>
              ))}
            </div>
          </div>
          <div className="card card-pad">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, padding: "4px 0" }}>
              {ventas_por_dia.map((d, i) => {
                const h = Math.max(4, Math.round((d.monto / maxBar) * 72));
                const isHoy = i === ventas_por_dia.length - 1;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ width: "100%", height: h, borderRadius: 4,
                      background: isHoy ? "var(--amber-bright)" : d.monto > 0 ? "var(--amber-soft)" : "var(--card-2)",
                      border: isHoy ? "none" : "1px solid var(--border)",
                      transition: "height 0.3s"
                    }} title={`${d.fecha}: ${ARS(d.monto)}`} />
                    {(ventas_por_dia.length <= 14 || i % 2 === 0) && (
                      <div style={{ fontSize: 8.5, color: isHoy ? "var(--amber-bright)" : "var(--txt-3)", fontWeight: isHoy ? 700 : 400 }}>{d.dia}</div>
                    )}
                  </div>
                );
              })}
            </div>
            {ventas_por_dia.every(d => d.monto === 0) && (
              <div style={{ textAlign: "center", fontSize: 12, color: "var(--txt-3)", marginTop: 8 }}>Sin ventas en este período</div>
            )}
          </div>
        </div>

        {/* ── Top productos ── */}
        {top_productos.length > 0 && (
          <div>
            <div className="section-title">Top productos · mes</div>
            <div className="card">
              {top_productos.map((p, i) => (
                <div key={p.producto_id}>
                  <div className="lrow" style={{ padding: "12px 14px" }}>
                    <div style={{ width: 24, textAlign: "center", fontWeight: 800, fontSize: 14,
                      color: i === 0 ? "var(--amber-bright)" : i === 1 ? "var(--txt-2)" : "var(--txt-3)" }}>
                      {i + 1}
                    </div>
                    <div className="grow" style={{ marginLeft: 8 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 650 }}>{p.nombre}</div>
                      <div className="pbar" style={{ marginTop: 6, height: 5 }}>
                        <span style={{ width: (p.unidades / maxProd * 100) + "%", background: "var(--amber-bright)" }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 60 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 750 }}>{p.unidades} u.</div>
                      <div style={{ fontSize: 11, color: "var(--txt-3)" }}>{ARS(p.ingresos)}</div>
                    </div>
                  </div>
                  {i < top_productos.length - 1 && <div className="divider" style={{ marginLeft: 46 }} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Ranking vendedores ── */}
        {ranking_vendedores.length > 0 && (
          <div>
            <div className="section-title">Ranking vendedores · mes</div>
            <div className="card card-pad stack gap-12">
              {ranking_vendedores.map((v, i) => (
                <div key={v.vendedor_id} className="row gap-12" style={{ alignItems: "center" }}>
                  <div style={{ width: 22, textAlign: "center", fontWeight: 800, fontSize: 14,
                    color: i === 0 ? "var(--amber-bright)" : i === 1 ? "var(--txt-2)" : "var(--txt-3)" }}>
                    {i + 1}
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--amber-soft)",
                    display: "grid", placeItems: "center", fontWeight: 700, color: "var(--amber-bright)", fontSize: 14, flexShrink: 0 }}>
                    {(v.nombre || "?")[0].toUpperCase()}
                  </div>
                  <div className="grow">
                    <div className="row between">
                      <div style={{ fontSize: 13.5, fontWeight: 650 }}>{v.nombre}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 750 }}>{ARS(v.monto)}</div>
                    </div>
                    <div className="pbar" style={{ marginTop: 6 }}>
                      <span style={{ width: (v.monto / maxVend * 100) + "%", background: i === 0 ? "var(--amber-bright)" : "var(--blue)" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Formas de pago ── */}
        {formas_pago.length > 0 && (
          <div>
            <div className="section-title">Formas de pago · mes</div>
            <div className="card">
              {formas_pago.map((f, i) => {
                const pct = Math.round(f.total / totalPago * 100);
                return (
                  <div key={f.forma}>
                    <div style={{ padding: "12px 14px" }}>
                      <div className="row between" style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 650 }}>{PAGO_LABEL[f.forma] || f.forma}</span>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: 13.5, fontWeight: 750 }}>{ARS(f.total)}</span>
                          <span style={{ fontSize: 11, color: "var(--txt-3)", marginLeft: 6 }}>{pct}%</span>
                        </div>
                      </div>
                      <div className="pbar" style={{ height: 6 }}>
                        <span style={{ width: pct + "%",
                          background: f.forma === "efectivo" ? "var(--green)" : f.forma === "qr" ? "var(--blue)" : "var(--purple)" }} />
                      </div>
                    </div>
                    {i < formas_pago.length - 1 && <div className="divider" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {top_productos.length === 0 && ranking_vendedores.length === 0 && (
          <div className="note"><Icon name="info" size={16} />Todavía no hay ventas registradas en el período seleccionado. Los datos aparecen al registrar la primera venta desde la app.</div>
        )}

        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

Object.assign(window, { AnalyticsView });
