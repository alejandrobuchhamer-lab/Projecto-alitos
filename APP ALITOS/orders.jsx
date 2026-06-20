/* ===================== ALITO'S · Módulo Pedidos ===================== */
const { useState: pUseState, useEffect: pUseEffect, useRef: pUseRef } = React;

const ORDER_STATUS = {
  pendiente:  { l: "Pendiente",  c: "amber", color: "var(--amber-bright)", soft: "var(--amber-soft)", icon: "clock" },
  preparando: { l: "Preparando", c: "blue",  color: "var(--blue)",         soft: "var(--blue-soft)",  icon: "box" },
  listo:      { l: "Listo",      c: "purple",color: "var(--purple)",       soft: "var(--purple-soft)",icon: "check" },
  entregado:  { l: "Entregado",  c: "green", color: "var(--green)",        soft: "var(--green-soft)", icon: "check" },
  cancelado:  { l: "Cancelado",  c: "gray",  color: "var(--txt-3)",        soft: "var(--card-2)",     icon: "x" },
};

const COBRO_STATUS = {
  pendiente: { l: "Sin cobrar",  c: "amber" },
  cobrado:   { l: "Cobrado",     c: "green" },
  parcial:   { l: "Pago parcial",c: "blue"  },
  deuda:     { l: "Debe",        c: "red"   },
};

const PAGO_OPTS = [
  { id: "efectivo",      l: "Efectivo"      },
  { id: "transferencia", l: "Transferencia" },
  { id: "qr",            l: "QR / MP"       },
  { id: "consignacion",  l: "Consignación"  },
];

const TIPO_LABEL = {
  cliente:  "Cliente",
  negocio:  "Negocio",
  regalo:   "Regalo",
  costo:    "A costo",
};

const PAGO_LABEL = {
  efectivo:      "Efectivo",
  transferencia: "Transferencia",
  qr:            "QR / MercadoPago",
  consignacion:  "Consignación",
};

// ── Input de cantidad libre ──────────────────────────────────────────────────
function QtyInput({ value, onChange }) {
  return (
    <div className="qty">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))}>−</button>
      <input
        type="number" min="0" value={value}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        style={{ width: 54, textAlign: "center" }}
      />
      <button type="button" onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

// ── Buscador de clientes con autocomplete ────────────────────────────────────
function ClientePicker({ value, onChange, localidad, onLocalidad }) {
  const [q, setQ]           = pUseState(value || "");
  const [results, setRes]   = pUseState([]);
  const [open, setOpen]     = pUseState(false);
  const [loading, setLoad]  = pUseState(false);
  const timer               = pUseRef(null);

  function search(txt) {
    setQ(txt);
    onChange(null, txt);
    clearTimeout(timer.current);
    if (txt.length < 1) { setRes([]); setOpen(false); return; }
    setLoad(true);
    timer.current = setTimeout(() => {
      buscarClientesPedido(txt)
        .then(r => { setRes(r); setOpen(r.length > 0); })
        .catch(() => {})
        .finally(() => setLoad(false));
    }, 280);
  }

  function pick(c) {
    setQ(c.nombre);
    onChange(c.id || null, c.nombre);
    if (c.localidad) onLocalidad(c.localidad);
    setOpen(false);
    setRes([]);
  }

  return (
    <div style={{ position: "relative" }}>
      <input className="input" placeholder="Buscar o escribir nombre…"
        value={q} onChange={e => search(e.target.value)}
        onFocus={() => q.length > 0 && results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div style={{
          position: "absolute", zIndex: 200, left: 0, right: 0, top: "100%",
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 10, marginTop: 4, boxShadow: "0 8px 24px #0006",
          maxHeight: 200, overflowY: "auto",
        }}>
          {results.map((c, i) => (
            <div key={i} onMouseDown={() => pick(c)}
              style={{ padding: "9px 14px", display: "flex", alignItems: "center",
                gap: 10, cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: c.registrado ? "var(--amber-soft)" : "var(--card-2)",
                color: c.registrado ? "var(--amber-bright)" : "var(--txt-3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {c.nombre[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.nombre}</div>
                {c.localidad && <div style={{ fontSize: 11, color: "var(--txt-3)" }}>{c.localidad}</div>}
              </div>
              {c.registrado && (
                <span className="badge green" style={{ marginLeft: "auto", fontSize: 10 }}>Registrado</span>
              )}
            </div>
          ))}
          {q.length > 0 && (
            <div onMouseDown={() => pick({ id: null, nombre: q, localidad: "", registrado: false })}
              style={{ padding: "9px 14px", color: "var(--blue)", fontSize: 13, cursor: "pointer" }}>
              + Crear "{q}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sheet para asignar repartidor ────────────────────────────────────────────
function AsignarVendedorSheet({ open, onClose, pedidoId, onSaved }) {
  const [vendedores, setVend] = pUseState([]);
  const [sel, setSel]         = pUseState(null);
  const [saving, setSaving]   = pUseState(false);

  pUseEffect(() => {
    if (open) {
      fetchVendedores().then(setVend).catch(() => {});
    }
  }, [open]);

  async function confirmar() {
    setSaving(true);
    try {
      await asignarPedido(pedidoId, { vendedorId: sel?.id, vendedorNombre: sel?.name });
      if (onSaved) onSaved();
    } catch(_) {}
    setSaving(false);
  }

  return (
    <Sheet open={open} onClose={onClose} icon="truck" title="Asignar repartidor"
      sub="¿Quién va a entregar este pedido?"
      foot={
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={saving || !sel}
            onClick={confirmar}>
            {saving ? "Asignando…" : "Confirmar →"}
          </button>
        </div>
      }>
      <div className="stack gap-8">
        {vendedores.map(v => (
          <div key={v.id}
            className={"mv" + (sel?.id === v.id ? " active" : "")}
            style={{
              cursor: "pointer", padding: "10px 12px", borderRadius: 10,
              border: sel?.id === v.id ? "1.5px solid var(--amber-bright)" : "1.5px solid transparent",
              background: sel?.id === v.id ? "var(--amber-soft)" : "var(--card-2)",
            }}
            onClick={() => setSel(v)}>
            <div className="mv-ico" style={{ background: "var(--amber-soft)", color: "var(--amber-bright)" }}>
              <Icon name="truck" size={16} />
            </div>
            <div className="grow">
              <div className="mv-concept">{v.name}</div>
              <div className="mv-sub">{v.online ? "En línea" : "Sin actividad"} · {v.stockUnits} u.</div>
            </div>
            {sel?.id === v.id && <Icon name="check" size={18} style={{ color: "var(--amber-bright)" }} />}
          </div>
        ))}
        {vendedores.length === 0 && (
          <div className="empty"><Icon name="truck" size={32} /><div>Sin vendedores</div></div>
        )}
      </div>
    </Sheet>
  );
}

// ── Sheet para registrar cobro ───────────────────────────────────────────────
function CobrarSheet({ open, onClose, pedido, onSaved }) {
  const [forma, setForma]         = pUseState("efectivo");
  const [cobrado, setCobrado]     = pUseState("");
  const [esCobrado, setEsCobrado] = pUseState(true);
  const [saving, setSaving]       = pUseState(false);

  pUseEffect(() => {
    if (open) {
      setForma("efectivo");
      setCobrado("");
      setEsCobrado(true);
    }
  }, [open]);

  const totalPedido = pedido?.amount || 0;
  const montoCobradoNum = parseMoney(cobrado) || (esCobrado ? totalPedido : 0);
  const montoDeudaNum   = esCobrado ? 0 : Math.max(0, totalPedido - montoCobradoNum);

  async function confirmar() {
    setSaving(true);
    try {
      await entregarPedido(pedido.id, {
        formaCobro:   forma,
        montoCobrado: esCobrado ? totalPedido : montoCobradoNum,
        montoDeuda:   montoDeudaNum,
      });
      if (onSaved) onSaved();
    } catch(_) {}
    setSaving(false);
  }

  if (!pedido) return null;

  return (
    <Sheet open={open} onClose={onClose} icon="cash" title="Registrar cobro"
      sub={"Pedido #" + pedido.id + " · " + ARS(totalPedido)}
      foot={
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={saving}
            onClick={confirmar}>
            <Icon name="check" size={18} />{saving ? "Guardando…" : "Confirmar entrega"}
          </button>
        </div>
      }>
      <div className="stack gap-12">

        {/* ¿Cobrado o deuda? */}
        <div className="field">
          <label className="lab">¿Cómo quedó?</label>
          <div className="chip-row">
            <button className={"chip" + (esCobrado ? " active" : "")} style={{ flex: 1 }}
              onClick={() => setEsCobrado(true)}>
              <Icon name="check" size={13} /> Cobrado
            </button>
            <button className={"chip" + (!esCobrado ? " active" : "")} style={{ flex: 1 }}
              onClick={() => setEsCobrado(false)}>
              <Icon name="clock" size={13} /> Quedó a deber
            </button>
          </div>
        </div>

        {/* Forma de cobro */}
        {esCobrado && (
          <div className="field">
            <label className="lab">Forma de pago</label>
            <div className="chip-row" style={{ flexWrap: "wrap" }}>
              {PAGO_OPTS.map(opt => (
                <button key={opt.id} className={"chip" + (forma === opt.id ? " active" : "")}
                  style={{ flex: 1, minWidth: 80 }} onClick={() => setForma(opt.id)}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Si pagó parcialmente */}
        {!esCobrado && (
          <div className="field">
            <label className="lab">¿Pagó algo? (opcional)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--txt-3)" }}>$</span>
              <input className="input" type="text" inputMode="numeric"
                placeholder={"Dejá vacío si no pagó nada"}
                value={cobrado}
                onChange={e => setCobrado(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            {montoCobradoNum > 0 && (
              <div className="field">
                <label className="lab" style={{ marginTop: 8 }}>Forma de pago parcial</label>
                <div className="chip-row" style={{ flexWrap: "wrap" }}>
                  {PAGO_OPTS.filter(o => o.id !== "consignacion").map(opt => (
                    <button key={opt.id} className={"chip" + (forma === opt.id ? " active" : "")}
                      style={{ flex: 1 }} onClick={() => setForma(opt.id)}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resumen */}
        <div className="card-2" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: "var(--txt-2)" }}>Total pedido</span>
            <span style={{ fontWeight: 700 }}>{ARS(totalPedido)}</span>
          </div>
          {esCobrado ? (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--green)" }}>Cobrado ({PAGO_LABEL[forma] || forma})</span>
              <span style={{ fontWeight: 700, color: "var(--green)" }}>{ARS(totalPedido)}</span>
            </div>
          ) : (
            <>
              {montoCobradoNum > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: "var(--blue)" }}>Pago parcial</span>
                  <span style={{ fontWeight: 700, color: "var(--blue)" }}>{ARS(montoCobradoNum)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--red)" }}>Quedó a deber</span>
                <span style={{ fontWeight: 700, color: "var(--red)" }}>{ARS(montoDeudaNum)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}

// ── Vista lista principal ────────────────────────────────────────────────────
function OrdersView({ heroTitle, heroSub, showBy = false, adminMode = false }) {
  const [orders, setOrders]       = pUseState([]);
  const [loading, setLoading]     = pUseState(true);
  const [newOrderOpen, setNewOrderOpen] = pUseState(false);
  const [filtroEstado, setFiltroEstado] = pUseState("todos");
  const [detalle, setDetalle]     = pUseState(null);

  function reload() {
    setLoading(true);
    fetchPedidos()
      .then(data => { setOrders(data); setLoading(false); })
      .catch(() => setLoading(false));
  }
  pUseEffect(reload, []);

  const today = orders.filter(o => o.time && (
    o.time.startsWith("Hace") || o.time === "Ahora" || o.time.startsWith("Hoy")
  ));
  const pending   = orders.filter(o => o.status === "pendiente").length;
  const montoHoy  = today.reduce((a, o) => a + (o.amount || 0), 0);

  const filtrado = filtroEstado === "todos"
    ? orders
    : orders.filter(o => o.status === filtroEstado);

  const FILTROS = [
    { id: "todos",      l: "Todos" },
    { id: "pendiente",  l: "Pendientes" },
    { id: "preparando", l: "Preparando" },
    { id: "entregado",  l: "Entregados" },
  ];

  return (
    <div className="anim-in">
      <div className="hero">
        <div className="hero-hi">{heroSub}</div>
        <div className="hero-name">{heroTitle}</div>
      </div>
      <div className="pad-x stack gap-14">

        {/* Métricas */}
        <div className="metric-grid">
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--amber-soft)", color: "var(--amber-bright)" }}>
              <Icon name="list" size={17} />
            </div>
            <div className="m-label">Pedidos hoy</div>
            <div className="m-val">{today.length}</div>
          </div>
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>
              <Icon name="clock" size={17} />
            </div>
            <div className="m-label">Pendientes</div>
            <div className="m-val">{pending}</div>
          </div>
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
              <Icon name="cash" size={17} />
            </div>
            <div className="m-label">Monto hoy</div>
            <div className="m-val"><span className="cur">$</span>{ARSc(montoHoy)}</div>
          </div>
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--purple-soft)", color: "var(--purple)" }}>
              <Icon name="receipt" size={17} />
            </div>
            <div className="m-label">Total</div>
            <div className="m-val">{orders.length}</div>
          </div>
        </div>

        <button className="btn btn-primary btn-lg btn-block" onClick={() => setNewOrderOpen(true)}>
          <Icon name="plus" size={20} />Tomar nuevo pedido
        </button>

        {/* Filtros */}
        <div className="chip-row">
          {FILTROS.map(f => (
            <button key={f.id}
              className={"chip" + (filtroEstado === f.id ? " active" : "")}
              onClick={() => setFiltroEstado(f.id)}>
              {f.l}{f.id !== "todos" ? ` (${orders.filter(o => o.status === f.id).length})` : ""}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div>
          {loading && <div className="empty"><Icon name="clock" size={40} /><div>Cargando…</div></div>}
          {!loading && filtrado.length === 0 && (
            <div className="empty">
              <Icon name="list" size={40} />
              <div>{filtroEstado === "todos" ? "Sin pedidos registrados" : "Sin pedidos en este estado"}</div>
            </div>
          )}
          {!loading && filtrado.length > 0 && (
            <div className="card">
              {filtrado.map((o, i) => {
                const st = ORDER_STATUS[o.status] || ORDER_STATUS.pendiente;
                const nombre = o.cliente_nombre || o.place || "—";
                const cobro = COBRO_STATUS[o.estadoCobro];
                const sub = [
                  o.time,
                  o.units + " u.",
                  showBy && o.by ? o.by : null,
                  o.asignadoANombre ? "→ " + o.asignadoANombre : null,
                  o.fecha_entrega ? "🗓 " + new Date(o.fecha_entrega).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : null,
                ].filter(Boolean).join(" · ");
                return (
                  <div key={o.id}>
                    <div className="mv" style={{ cursor: "pointer" }} onClick={() => setDetalle(o)}>
                      <div className="mv-ico" style={{ background: st.soft, color: st.color }}>
                        <Icon name={st.icon} size={16} />
                      </div>
                      <div className="grow">
                        <div className="mv-concept">{nombre}</div>
                        <div className="mv-sub">{sub}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{ARS(o.amount)}</div>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 3 }}>
                          <span className={"badge " + st.c}><span className="bd" />{st.l}</span>
                          {o.status === "entregado" && cobro && (
                            <span className={"badge " + cobro.c}><span className="bd" />{cobro.l}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {i < filtrado.length - 1 && <div className="divider" style={{ marginLeft: 64 }} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ height: 16 }} />
      </div>

      <NewOrderSheet
        open={newOrderOpen}
        onClose={() => setNewOrderOpen(false)}
        onSaved={() => { setNewOrderOpen(false); reload(); }}
      />
      {detalle && (
        <PedidoDetailSheet
          pedido={detalle}
          adminMode={adminMode}
          onClose={() => setDetalle(null)}
          onChanged={() => { setDetalle(null); reload(); }}
        />
      )}
    </div>
  );
}

// ── Detalle de pedido ────────────────────────────────────────────────────────
function PedidoDetailSheet({ pedido, adminMode, onClose, onChanged }) {
  const [saving, setSaving]             = pUseState(false);
  const [asignarOpen, setAsignarOpen]   = pUseState(false);
  const [cobrarOpen, setCobrarOpen]     = pUseState(false);
  const st    = ORDER_STATUS[pedido.status] || ORDER_STATUS.pendiente;
  const cobro = COBRO_STATUS[pedido.estadoCobro] || COBRO_STATUS.pendiente;

  async function cambiar(nuevoEstado) {
    setSaving(true);
    try { await actualizarPedidoEstado(pedido.id, nuevoEstado); onChanged(); }
    catch(_) { setSaving(false); }
  }

  const fechaEntregaStr = pedido.fecha_entrega
    ? new Date(pedido.fecha_entrega).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : null;

  const puedeEntregar = pedido.status === "preparando" || pedido.status === "listo";
  const esAsignado    = pedido.asignadoANombre && pedido.asignadoAId;

  return (
    <Sheet open onClose={onClose} icon={st.icon} title={"Pedido #" + pedido.id} sub={st.l}>
      <div className="stack gap-12">

        {/* Estado + cobro */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span className={"badge " + st.c} style={{ fontSize: 13, padding: "4px 10px" }}>
            <span className="bd" />{st.l}
          </span>
          {pedido.status === "entregado" && (
            <span className={"badge " + cobro.c} style={{ fontSize: 13, padding: "4px 10px" }}>
              <span className="bd" />{cobro.l}
            </span>
          )}
          {pedido.lista_precio && (
            <span className="badge gray" style={{ fontSize: 12, padding: "4px 10px" }}>
              Lista: {pedido.lista_precio}
            </span>
          )}
        </div>

        {/* Cliente */}
        <div className="card-2" style={{ padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
            {pedido.cliente_nombre || pedido.place || "—"}
          </div>
          <div className="mv-sub">
            {TIPO_LABEL[pedido.tipo_cliente] || pedido.tipo_cliente}
            {pedido.cliente_localidad ? " · " + pedido.cliente_localidad : ""}
          </div>
          {pedido.by && pedido.by !== "—" && (
            <div className="mv-sub" style={{ marginTop: 4 }}>Tomado por: {pedido.by}</div>
          )}
          {esAsignado && (
            <div className="mv-sub" style={{ marginTop: 4, color: "var(--blue)" }}>
              <Icon name="truck" size={12} /> Repartidor: {pedido.asignadoANombre}
            </div>
          )}
        </div>

        {/* Fechas */}
        <div className="card-2" style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div className="mv-sub" style={{ marginBottom: 2 }}>Tomado</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{pedido.time}</div>
          </div>
          {fechaEntregaStr && (
            <div>
              <div className="mv-sub" style={{ marginBottom: 2 }}>🗓 Entrega</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--amber-bright)" }}>{fechaEntregaStr}</div>
            </div>
          )}
          {pedido.entregadoAt && (
            <div>
              <div className="mv-sub" style={{ marginBottom: 2 }}>Entregado</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--green)" }}>
                {new Date(pedido.entregadoAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          )}
        </div>

        {/* Productos */}
        {pedido.productos && pedido.productos.length > 0 && (
          <div className="card-2" style={{ padding: 12 }}>
            <div className="lab" style={{ marginBottom: 8 }}>Productos</div>
            {pedido.productos.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                <span style={{ color: "var(--txt-2)" }}>{p.name || p.nombre}</span>
                <span style={{ fontWeight: 600 }}>{p.qty || p.cantidad} u.</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--card-border)", marginTop: 8, paddingTop: 8,
              display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--txt-2)" }}>Total</span>
              <span style={{ fontWeight: 700 }}>{pedido.units} u.</span>
            </div>
          </div>
        )}

        {/* Precio */}
        <div className="card-2" style={{ padding: 14 }}>
          <div className="lab" style={{ marginBottom: 8 }}>Precio</div>
          {pedido.descuento_pct > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: "var(--txt-2)" }}>Precio de lista</span>
              <span style={{ textDecoration: "line-through", color: "var(--txt-3)" }}>{ARS(pedido.monto_lista)}</span>
            </div>
          )}
          {pedido.descuento_pct > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: "var(--green)" }}>Descuento {pedido.descuento_pct}%</span>
              <span style={{ color: "var(--green)", fontWeight: 600 }}>-{ARS(pedido.monto_lista * pedido.descuento_pct / 100)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700 }}>Total</span>
            <span style={{ fontWeight: 800, fontSize: 20, color: "var(--amber-bright)" }}>{ARS(pedido.amount)}</span>
          </div>
          {/* Cobro */}
          {pedido.status === "entregado" && (
            <div style={{ borderTop: "1px solid var(--card-border)", marginTop: 10, paddingTop: 10 }}>
              {pedido.montoCobrado > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: "var(--green)" }}>Cobrado ({PAGO_LABEL[pedido.formaCobro] || pedido.formaCobro})</span>
                  <span style={{ fontWeight: 700, color: "var(--green)" }}>{ARS(pedido.montoCobrado)}</span>
                </div>
              )}
              {pedido.montoDeuda > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--red)" }}>Queda a deber</span>
                  <span style={{ fontWeight: 700, color: "var(--red)" }}>{ARS(pedido.montoDeuda)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notas */}
        {pedido.notas && (
          <div className="note" style={{ margin: 0 }}>
            <Icon name="info" size={15} />{pedido.notas}
          </div>
        )}

        {/* Acciones admin */}
        {adminMode && pedido.status !== "cancelado" && pedido.status !== "entregado" && (
          <div className="stack gap-8">
            {pedido.status === "pendiente" && (
              <button className="btn btn-primary btn-block" disabled={saving}
                onClick={() => setAsignarOpen(true)}>
                <Icon name="truck" size={18} />Preparar y asignar repartidor
              </button>
            )}
            {pedido.status === "preparando" && !esAsignado && (
              <button className="btn btn-ghost btn-block" disabled={saving}
                onClick={() => setAsignarOpen(true)}>
                <Icon name="truck" size={18} />Asignar repartidor
              </button>
            )}
            {(pedido.status === "preparando" || pedido.status === "listo") && (
              <button className="btn btn-primary btn-block" disabled={saving}
                onClick={() => setCobrarOpen(true)}>
                <Icon name="check" size={18} />Marcar entregado
              </button>
            )}
            <button className="btn btn-ghost btn-block" disabled={saving}
              style={{ color: "var(--txt-3)", fontSize: 13 }}
              onClick={() => cambiar("cancelado")}>
              Cancelar pedido
            </button>
          </div>
        )}

        {/* Acciones vendedor (no admin) */}
        {!adminMode && puedeEntregar && (
          <button className="btn btn-primary btn-block" disabled={saving}
            onClick={() => setCobrarOpen(true)}>
            <Icon name="check" size={18} />Marcar como entregado
          </button>
        )}
      </div>

      <AsignarVendedorSheet
        open={asignarOpen}
        onClose={() => setAsignarOpen(false)}
        pedidoId={pedido.id}
        onSaved={() => { setAsignarOpen(false); onChanged(); }}
      />
      <CobrarSheet
        open={cobrarOpen}
        onClose={() => setCobrarOpen(false)}
        pedido={pedido}
        onSaved={() => { setCobrarOpen(false); onChanged(); }}
      />
    </Sheet>
  );
}

// ── Nuevo pedido ─────────────────────────────────────────────────────────────
function NewOrderSheet({ open, onClose, onSaved }) {
  const [step, setStep]           = pUseState(1);
  const [tipo, setTipo]           = pUseState("cliente");
  const [clienteId, setClienteId] = pUseState(null);
  const [clienteNombre, setClienteNombre]       = pUseState("");
  const [clienteLocalidad, setClienteLocalidad] = pUseState("");
  const [negocioSel, setNegocioSel] = pUseState(null);
  const [negocios, setNegocios]   = pUseState([]);
  const [listas, setListas]       = pUseState([]);
  const [listaSel, setListaSel]   = pUseState("cliente");
  const [productos, setProductos] = pUseState([]);
  const [qty, setQty]             = pUseState({});
  const [fechaEntrega, setFechaEntrega] = pUseState("");
  const [notas, setNotas]         = pUseState("");
  const [precioCustom, setPrecioCustom] = pUseState("");
  const [saving, setSaving]       = pUseState(false);
  const [stockMap, setStockMap]   = pUseState({});

  pUseEffect(() => {
    if (open) {
      setStep(1); setTipo("cliente");
      setClienteId(null); setClienteNombre(""); setClienteLocalidad("");
      setNegocioSel(null); setQty({}); setFechaEntrega(""); setNotas("");
      setPrecioCustom(""); setStockMap({});
      fetchNegocios().then(setNegocios).catch(() => {});
      fetchProductos().then(setProductos).catch(() => {});
      fetchListasPrecio().then(ls => {
        setListas(ls);
        setListaSel(ls[0]?.slug || "cliente");
      }).catch(() => {});
      fetchStockAlfajores().then(st => {
        setStockMap(Object.fromEntries(st.map(s => [String(s.id), s.stock])));
      }).catch(() => {});
    }
  }, [open]);

  const totalUnits = Object.values(qty).reduce((a, b) => a + b, 0);
  const lista      = listas.find(l => l.slug === listaSel);

  function calcPrecio() {
    if (listaSel === "regalo") return { base: 0, final: 0, pct: 0 };
    if (listaSel === "personalizado") {
      const v = parseFloat(precioCustom.replace(/\D/g, "")) || 0;
      return { base: v, final: v, pct: 0 };
    }
    if (!lista) return { base: 0, final: 0, pct: 0 };
    const docenas = Math.floor(totalUnits / 12);
    const rest    = totalUnits % 12;
    const medias  = Math.floor(rest / 6);
    const sueltas = rest % 6;
    const pDoc    = lista.precio_docena;
    const pMed    = lista.precio_media;
    const base    = docenas * pDoc + medias * pMed + sueltas * (pDoc / 12);
    return { base: Math.round(base * 100) / 100, final: Math.round(base * 100) / 100, pct: 0 };
  }
  const pricing = calcPrecio();

  const docenas = Math.floor(totalUnits / 12);
  const medias  = Math.floor((totalUnits % 12) / 6);
  const sueltas = totalUnits % 6;

  async function confirmar() {
    if (totalUnits === 0) return;
    setSaving(true);
    const place = tipo === "negocio" && negocioSel
      ? negocioSel.name
      : (clienteNombre || "Cliente");
    const prods = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const prod = productos.find(pr => String(pr.id) === String(id));
        return { id, name: prod ? prod.nombre : id, qty: q };
      });
    try {
      await crearPedido({
        place,
        negocioId:        tipo === "negocio" && negocioSel ? negocioSel.id : null,
        units:            totalUnits,
        amount:           pricing.final,
        productos:        prods,
        notas,
        tipoCliente:      tipo,
        clienteId:        clienteId || null,
        clienteNombre:    tipo !== "negocio" ? clienteNombre : (negocioSel ? negocioSel.name : ""),
        clienteLocalidad,
        fechaEntrega:     fechaEntrega || null,
        formaPago:        null,
        descuentoPct:     pricing.pct,
        montoLista:       pricing.base,
        listaPrecio:      listaSel,
      });
      if (onSaved) onSaved();
    } catch(_) {
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const footContent = (
    <div style={{ display: "flex", gap: 8 }}>
      {step > 1
        ? <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(s => s - 1)}>← Atrás</button>
        : <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
      }
      {step < 3
        ? <button className="btn btn-primary" style={{ flex: 2 }}
            disabled={step === 1 && tipo !== "negocio" && !clienteNombre}
            onClick={() => setStep(s => s + 1)}>
            Siguiente →
          </button>
        : <button className="btn btn-primary" style={{ flex: 2 }}
            disabled={totalUnits === 0 || saving}
            onClick={confirmar}>
            <Icon name="send" size={18} />
            {saving ? "Enviando…" : "Confirmar · " + ARS(pricing.final)}
          </button>
      }
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} icon="list" title="Nuevo pedido" sub="Se envía a fábrica para preparar" foot={footContent}>

      {/* Indicador de pasos */}
      <div className="chip-row" style={{ marginBottom: 4 }}>
        {["1. Cliente", "2. Productos", "3. Precio"].map((s, i) => (
          <button key={i} className={"chip" + (step === i + 1 ? " active" : "")}
            onClick={() => setStep(i + 1)} style={{ flex: 1, fontSize: 12 }}>
            {s}
          </button>
        ))}
      </div>

      {/* ── Paso 1: Cliente ── */}
      {step === 1 && (
        <div className="stack gap-12">
          <div className="field">
            <label className="lab">Tipo</label>
            <div className="chip-row">
              <button className={"chip" + (tipo === "cliente" ? " active" : "")} style={{ flex: 1 }}
                onClick={() => setTipo("cliente")}>Cliente</button>
              <button className={"chip" + (tipo === "negocio" ? " active" : "")} style={{ flex: 1 }}
                onClick={() => setTipo("negocio")}>Negocio</button>
            </div>
          </div>

          {tipo === "cliente" && (
            <>
              <div className="field">
                <label className="lab">Nombre del cliente</label>
                <ClientePicker
                  value={clienteNombre}
                  onChange={(id, nombre) => { setClienteId(id); setClienteNombre(nombre); }}
                  localidad={clienteLocalidad}
                  onLocalidad={setClienteLocalidad}
                />
              </div>
              <div className="field">
                <label className="lab">Localidad / De dónde es</label>
                <input className="input" placeholder="Ej: Rosario, Villa Constitución…"
                  value={clienteLocalidad} onChange={e => setClienteLocalidad(e.target.value)} />
              </div>
            </>
          )}

          {tipo === "negocio" && (
            <div className="field">
              <label className="lab">Negocio</label>
              <select className="select" value={negocioSel ? negocioSel.id : ""}
                onChange={e => {
                  const n = negocios.find(x => String(x.id) === e.target.value);
                  setNegocioSel(n || null);
                }}>
                <option value="">Seleccioná un negocio…</option>
                {negocios.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
          )}

          <div className="field">
            <label className="lab">Observaciones</label>
            <textarea className="input" rows={2} style={{ resize: "none" }}
              placeholder="Notas, instrucciones, alergias…"
              value={notas} onChange={e => setNotas(e.target.value)} />
          </div>
        </div>
      )}

      {/* ── Paso 2: Productos ── */}
      {step === 2 && (
        <div className="stack gap-8">
          <div className="note" style={{ margin: 0 }}>
            <Icon name="info" size={15} />
            Escribí la cantidad exacta o usá +/−.
          </div>
          {productos.map(prod => {
            const stockDisp = stockMap[String(prod.id)];
            const agotado = stockDisp != null && stockDisp === 0;
            return (
              <div className="prow" key={prod.id} style={agotado ? { opacity: 0.5 } : {}}>
                <div className="pimg"><img src={"assets/alfajor-maicena.png"} alt="" /></div>
                <div className="grow">
                  <div className="pname">{prod.nombre || prod.name}</div>
                  <div className="pmeta" style={{ color: agotado ? "var(--danger, #e53)" : stockDisp != null && stockDisp <= 12 ? "var(--warn, #f90)" : undefined }}>
                    {stockDisp != null ? stockDisp + " disponibles" : "unidades"}
                  </div>
                </div>
                <QtyInput
                  value={qty[String(prod.id)] || 0}
                  onChange={v => setQty(q => ({ ...q, [String(prod.id)]: v }))}
                />
              </div>
            );
          })}
          {totalUnits > 0 && (
            <div className="card-2" style={{ padding: 12, marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--txt-2)" }}>Total</span>
                <span style={{ fontWeight: 700 }}>{totalUnits} unidades</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--txt-3)", marginTop: 3 }}>
                {docenas > 0 ? docenas + " docena" + (docenas > 1 ? "s" : "") : ""}
                {medias > 0 ? (docenas > 0 ? " + " : "") + medias + " media" + (medias > 1 ? "s" : "") : ""}
                {sueltas > 0 ? ((docenas > 0 || medias > 0) ? " + " : "") + sueltas + " suelta" + (sueltas > 1 ? "s" : "") : ""}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Paso 3: Precio + Fecha ── */}
      {step === 3 && (
        <div className="stack gap-12">

          {/* Lista de precio */}
          <div className="field">
            <label className="lab">Lista de precio</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {listas.map(l => (
                <button key={l.slug} className={"chip" + (listaSel === l.slug ? " active" : "")}
                  style={{ flex: "1 1 calc(50% - 3px)", fontSize: 12 }}
                  onClick={() => setListaSel(l.slug)}>
                  {l.nombre}
                  {l.slug !== "regalo" && l.slug !== "personalizado"
                    ? " · " + ARS(l.precio_docena) + "/doc"
                    : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Precio personalizado */}
          {listaSel === "personalizado" && (
            <div className="field">
              <label className="lab">Precio total a cobrar</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--txt-3)" }}>$</span>
                <input className="input" type="text" inputMode="numeric"
                  placeholder="Ej: 1500"
                  value={precioCustom}
                  onChange={e => setPrecioCustom(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
          )}

          {/* Fecha de entrega */}
          <div className="field">
            <label className="lab">Fecha de entrega (opcional)</label>
            <input type="date" className="input" value={fechaEntrega}
              onChange={e => setFechaEntrega(e.target.value)}
              min={new Date().toISOString().slice(0, 10)} />
          </div>

          {/* Resumen de precio */}
          <div className="card-2" style={{ padding: 14 }}>
            <div className="lab" style={{ marginBottom: 10 }}>Resumen</div>
            {totalUnits === 0
              ? <div style={{ color: "var(--txt-3)", fontSize: 13, textAlign: "center" }}>Sin productos</div>
              : listaSel === "regalo"
              ? <div style={{ color: "var(--txt-2)", fontSize: 13 }}>
                  {totalUnits} unidades · <span style={{ color: "var(--green)", fontWeight: 700 }}>REGALO</span>
                </div>
              : listaSel === "personalizado"
              ? <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--txt-2)" }}>{totalUnits} u. · Precio personalizado</span>
                  <span style={{ fontWeight: 800, color: "var(--amber-bright)" }}>{ARS(pricing.final)}</span>
                </div>
              : (
                <div className="stack gap-6" style={{ fontSize: 13 }}>
                  {docenas > 0 && lista && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--txt-2)" }}>{docenas} doc × {ARS(lista.precio_docena)}</span>
                      <span style={{ fontWeight: 600 }}>{ARS(docenas * lista.precio_docena)}</span>
                    </div>
                  )}
                  {medias > 0 && lista && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--txt-2)" }}>{medias} media × {ARS(lista.precio_media)}</span>
                      <span style={{ fontWeight: 600 }}>{ARS(medias * lista.precio_media)}</span>
                    </div>
                  )}
                  {sueltas > 0 && lista && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--txt-2)" }}>{sueltas} suelta{sueltas > 1 ? "s" : ""}</span>
                      <span style={{ fontWeight: 600 }}>{ARS(sueltas * (lista.precio_docena / 12))}</span>
                    </div>
                  )}
                  <div style={{ borderTop: "1px solid var(--card-border)", margin: "4px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Total a cobrar</span>
                    <span style={{ fontWeight: 800, fontSize: 20, color: "var(--amber-bright)" }}>{ARS(pricing.final)}</span>
                  </div>
                </div>
              )
            }
          </div>
        </div>
      )}
    </Sheet>
  );
}

Object.assign(window, { ORDER_STATUS, OrdersView, NewOrderSheet, PedidoDetailSheet });
