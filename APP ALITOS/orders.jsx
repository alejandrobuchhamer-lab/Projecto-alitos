/* ===================== ALITO'S · Módulo Pedidos ===================== */
const { useState: pUseState, useEffect: pUseEffect } = React;

const ORDER_STATUS = {
  pendiente:  { l: "Pendiente",  c: "amber", color: "var(--amber-bright)", soft: "var(--amber-soft)", icon: "clock" },
  preparando: { l: "Preparando", c: "blue",  color: "var(--blue)",         soft: "var(--blue-soft)",  icon: "box" },
  entregado:  { l: "Entregado",  c: "green", color: "var(--green)",        soft: "var(--green-soft)", icon: "check" },
  cancelado:  { l: "Cancelado",  c: "gray",  color: "var(--txt-3)",        soft: "var(--card-2)",     icon: "x" },
};

// ── Precios alfajor ──────────────────────────────────────────────────────────
// Modificar aquí para cambiar los precios base
const PRECIOS_CF  = { docena: 20, media: 12 };   // consumidor final
const PRECIOS_NEG = { docena: 24, media: 14 };   // negocio — precio ANTES del descuento

const PAGO_OPTS = [
  { id: "efectivo",      l: "Efectivo",      pct: 10 },
  { id: "transferencia", l: "Transferencia", pct: 5  },
  { id: "qr",            l: "QR / MP",       pct: 0  },
  { id: "consignacion",  l: "Consignación",  pct: 0  },
];

const TIPO_CLIENTE_OPTS = [
  { id: "consumidor_final", l: "Consumidor Final" },
  { id: "cliente",          l: "Cliente" },
  { id: "negocio",          l: "Negocio" },
];

const TIPO_LABEL = {
  consumidor_final: "Consumidor Final",
  cliente:          "Cliente",
  negocio:          "Negocio",
};

const PAGO_LABEL = {
  efectivo:      "Efectivo",
  transferencia: "Transferencia",
  qr:            "QR / MercadoPago",
  consignacion:  "Consignación",
};

// ── Calculadora de precio ────────────────────────────────────────────────────
function calcPrecio(units, tipo, pagoId) {
  const p = tipo === "negocio" ? PRECIOS_NEG : PRECIOS_CF;
  const docenas = Math.floor(units / 12);
  const rest    = units % 12;
  const medias  = Math.floor(rest / 6);
  const sueltas = rest % 6;
  const base = docenas * p.docena + medias * p.media + sueltas * (p.docena / 12);
  const pago = pagoId ? PAGO_OPTS.find(x => x.id === pagoId) : null;
  const pct  = (tipo === "negocio" && pago) ? pago.pct : 0;
  const final = Math.round(base * (1 - pct / 100) * 100) / 100;
  return { base: Math.round(base * 100) / 100, pct, final };
}

// ── Input de cantidad libre ──────────────────────────────────────────────────
function QtyInput({ value, onChange }) {
  return (
    <div className="qty">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))}>−</button>
      <input
        type="number"
        min="0"
        value={value}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        style={{ width: 54, textAlign: "center" }}
      />
      <button type="button" onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

// ── Vista lista principal ────────────────────────────────────────────────────
function OrdersView({ heroTitle, heroSub, showBy = false, adminMode = false }) {
  const [orders, setOrders] = pUseState([]);
  const [loading, setLoading] = pUseState(true);
  const [newOrderOpen, setNewOrderOpen] = pUseState(false);
  const [filtroEstado, setFiltroEstado] = pUseState("todos");
  const [detalle, setDetalle] = pUseState(null);

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

  async function handleEstado(pedidoId, nuevoEstado, e) {
    if (e) e.stopPropagation();
    try { await actualizarPedidoEstado(pedidoId, nuevoEstado); reload(); } catch(_) {}
  }

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
                const sub = [
                  o.time,
                  o.units + " u.",
                  showBy && o.by ? o.by : null,
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
                        <span className={"badge " + st.c} style={{ marginTop: 4 }}>
                          <span className="bd" />{st.l}
                        </span>
                      </div>
                    </div>
                    {adminMode && (o.status === "pendiente" || o.status === "preparando") && (
                      <div style={{ padding: "0 16px 10px", display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        {o.status === "pendiente" && (
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "3px 8px" }}
                            onClick={e => handleEstado(o.id, "preparando", e)}>
                            Preparar
                          </button>
                        )}
                        <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: "3px 8px" }}
                          onClick={e => handleEstado(o.id, "entregado", e)}>
                          {o.status === "pendiente" ? "Entregado" : "Marcar entregado"}
                        </button>
                      </div>
                    )}
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
  const [saving, setSaving] = pUseState(false);
  const st = ORDER_STATUS[pedido.status] || ORDER_STATUS.pendiente;

  async function cambiar(nuevoEstado) {
    setSaving(true);
    try { await actualizarPedidoEstado(pedido.id, nuevoEstado); onChanged(); }
    catch(_) { setSaving(false); }
  }

  const fechaEntregaStr = pedido.fecha_entrega
    ? new Date(pedido.fecha_entrega).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : null;

  return (
    <Sheet open onClose={onClose} icon={st.icon} title={"Pedido #" + pedido.id} sub={st.l}>
      <div className="stack gap-12">

        {/* Cliente */}
        <div className="card-2" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                {pedido.cliente_nombre || pedido.place || "Consumidor Final"}
              </div>
              <div className="mv-sub" style={{ marginTop: 2 }}>
                {TIPO_LABEL[pedido.tipo_cliente] || "Consumidor Final"}
                {pedido.cliente_localidad ? " · " + pedido.cliente_localidad : ""}
              </div>
            </div>
            <span className={"badge " + st.c}><span className="bd" />{st.l}</span>
          </div>
          {pedido.by && pedido.by !== "—" && (
            <div className="mv-sub">Tomado por: {pedido.by}</div>
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
              <span style={{ color: "var(--txt-2)" }}>Total unidades</span>
              <span style={{ fontWeight: 700 }}>{pedido.units}</span>
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
              <span style={{ color: "var(--green)", fontWeight: 600 }}>
                -{ARS(pedido.monto_lista * pedido.descuento_pct / 100)}
              </span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700 }}>Total</span>
            <span style={{ fontWeight: 800, fontSize: 20, color: "var(--amber-bright)" }}>{ARS(pedido.amount)}</span>
          </div>
          {pedido.forma_pago && (
            <div style={{ fontSize: 12, color: "var(--txt-3)", marginTop: 4, textAlign: "right" }}>
              {PAGO_LABEL[pedido.forma_pago] || pedido.forma_pago}
            </div>
          )}
        </div>

        {/* Notas */}
        {pedido.notas && (
          <div className="note" style={{ margin: 0 }}>
            <Icon name="info" size={15} />{pedido.notas}
          </div>
        )}

        {/* Acciones */}
        {adminMode && pedido.status !== "cancelado" && pedido.status !== "entregado" && (
          <div className="stack gap-8">
            {pedido.status === "pendiente" && (
              <button className="btn btn-primary btn-block" disabled={saving}
                onClick={() => cambiar("preparando")}>
                <Icon name="box" size={18} />Marcar como preparando
              </button>
            )}
            <button className="btn btn-primary btn-block" disabled={saving}
              onClick={() => cambiar("entregado")}>
              <Icon name="check" size={18} />Marcar como entregado
            </button>
            <button className="btn btn-ghost btn-block" disabled={saving}
              style={{ color: "var(--txt-3)", fontSize: 13 }}
              onClick={() => cambiar("cancelado")}>
              Cancelar pedido
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ── Nuevo pedido ─────────────────────────────────────────────────────────────
function NewOrderSheet({ open, onClose, onSaved }) {
  const [step, setStep]             = pUseState(1);
  const [tipo, setTipo]             = pUseState("consumidor_final");
  const [clienteNombre, setClienteNombre]       = pUseState("");
  const [clienteLocalidad, setClienteLocalidad] = pUseState("");
  const [negocioSel, setNegocioSel] = pUseState(null);
  const [negocios, setNegocios]     = pUseState([]);
  const [productos, setProductos]   = pUseState([]);
  const [qty, setQty]               = pUseState({});
  const [fechaEntrega, setFechaEntrega] = pUseState("");
  const [notas, setNotas]           = pUseState("");
  const [formaPago, setFormaPago]   = pUseState("efectivo");
  const [saving, setSaving]         = pUseState(false);

  pUseEffect(() => {
    if (open) {
      setStep(1); setTipo("consumidor_final");
      setClienteNombre(""); setClienteLocalidad(""); setNegocioSel(null);
      setQty({}); setFechaEntrega(""); setNotas(""); setFormaPago("efectivo");
      fetchNegocios().then(setNegocios).catch(() => {});
      fetchProductos().then(setProductos).catch(() => {
        if (typeof PRODUCTS !== "undefined")
          setProductos(PRODUCTS.map(p => ({ id: p.id, nombre: p.name })));
      });
    }
  }, [open]);

  const totalUnits = Object.values(qty).reduce((a, b) => a + b, 0);
  const pricing    = calcPrecio(totalUnits, tipo, tipo === "negocio" ? formaPago : null);

  const docenas = Math.floor(totalUnits / 12);
  const medias  = Math.floor((totalUnits % 12) / 6);
  const sueltas = totalUnits % 6;
  const p       = tipo === "negocio" ? PRECIOS_NEG : PRECIOS_CF;

  async function confirmar() {
    if (totalUnits === 0) return;
    setSaving(true);
    const place = tipo === "negocio" && negocioSel
      ? negocioSel.name
      : (clienteNombre || "Consumidor Final");
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
        clienteNombre:    tipo !== "negocio" ? clienteNombre : (negocioSel ? negocioSel.name : ""),
        clienteLocalidad,
        fechaEntrega:     fechaEntrega || null,
        formaPago:        tipo === "negocio" ? formaPago : null,
        descuentoPct:     pricing.pct,
        montoLista:       pricing.base,
      });
      if (onSaved) onSaved();
    } catch(_) {
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const prodList = productos.length
    ? productos
    : (typeof PRODUCTS !== "undefined" ? PRODUCTS.map(p => ({ id: p.id, nombre: p.name })) : []);

  const footContent = (
    <div style={{ display: "flex", gap: 8 }}>
      {step > 1
        ? <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(s => s - 1)}>← Atrás</button>
        : <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
      }
      {step < 3
        ? <button className="btn btn-primary" style={{ flex: 2 }}
            disabled={step === 2 && totalUnits === 0}
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
        {["1. Cliente", "2. Productos", "3. Entrega"].map((s, i) => (
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
            <label className="lab">Tipo de cliente</label>
            <div className="chip-row">
              {TIPO_CLIENTE_OPTS.map(t => (
                <button key={t.id} className={"chip" + (tipo === t.id ? " active" : "")}
                  onClick={() => setTipo(t.id)} style={{ flex: 1 }}>
                  {t.l}
                </button>
              ))}
            </div>
          </div>

          {tipo !== "negocio" && (
            <>
              <div className="field">
                <label className="lab">
                  {tipo === "consumidor_final" ? "Nombre (opcional)" : "Nombre y apellido"}
                </label>
                <input className="input" placeholder="Ej: Juan García"
                  value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} />
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
            <textarea className="input" rows={3} style={{ resize: "none" }}
              placeholder="Notas, instrucciones de entrega, alergias…"
              value={notas} onChange={e => setNotas(e.target.value)} />
          </div>
        </div>
      )}

      {/* ── Paso 2: Productos ── */}
      {step === 2 && (
        <div className="stack gap-8">
          <div className="note" style={{ margin: 0 }}>
            <Icon name="info" size={15} />
            Escribí la cantidad exacta o usá +/−. Docena = {ARS(p.docena)}.
          </div>
          {prodList.map(prod => {
            const mock = typeof PROD_BY_ID !== "undefined" ? (PROD_BY_ID[prod.id] || {}) : {};
            const img  = mock.img || prod.img || "assets/alfajor-maicena.png";
            return (
              <div className="prow" key={prod.id}>
                <div className="pimg"><img src={img} alt="" /></div>
                <div className="grow">
                  <div className="pname">{prod.nombre || prod.name}</div>
                  <div className="pmeta">unidades</div>
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

      {/* ── Paso 3: Fecha + Calculadora ── */}
      {step === 3 && (
        <div className="stack gap-12">
          <div className="field">
            <label className="lab">Fecha de entrega (opcional)</label>
            <input type="date" className="input" value={fechaEntrega}
              onChange={e => setFechaEntrega(e.target.value)}
              min={new Date().toISOString().slice(0, 10)} />
          </div>

          {/* Calculadora */}
          <div className="card-2" style={{ padding: 14 }}>
            <div className="lab" style={{ marginBottom: 10 }}>
              {tipo === "negocio" ? "Calculadora de precio — Negocio" : "Resumen de precio"}
            </div>

            {tipo === "negocio" && (
              <div className="field" style={{ marginBottom: 12 }}>
                <label className="lab">Forma de pago</label>
                <div className="chip-row" style={{ flexWrap: "wrap" }}>
                  {PAGO_OPTS.map(opt => (
                    <button key={opt.id} className={"chip" + (formaPago === opt.id ? " active" : "")}
                      onClick={() => setFormaPago(opt.id)} style={{ flex: 1, fontSize: 11 }}>
                      {opt.l}{opt.pct > 0 ? " -" + opt.pct + "%" : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {totalUnits === 0
              ? <div style={{ color: "var(--txt-3)", fontSize: 13, textAlign: "center", padding: "8px 0" }}>
                  Sin productos — volvé al paso 2
                </div>
              : (
                <div className="stack gap-6" style={{ fontSize: 13 }}>
                  {docenas > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--txt-2)" }}>{docenas} docena{docenas > 1 ? "s" : ""} × {ARS(p.docena)}</span>
                      <span style={{ fontWeight: 600 }}>{ARS(docenas * p.docena)}</span>
                    </div>
                  )}
                  {medias > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--txt-2)" }}>{medias} media{medias > 1 ? "s" : ""} × {ARS(p.media)}</span>
                      <span style={{ fontWeight: 600 }}>{ARS(medias * p.media)}</span>
                    </div>
                  )}
                  {sueltas > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--txt-2)" }}>{sueltas} suelta{sueltas > 1 ? "s" : ""}</span>
                      <span style={{ fontWeight: 600 }}>{ARS(sueltas * (p.docena / 12))}</span>
                    </div>
                  )}

                  {pricing.pct > 0 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--txt-2)" }}>Precio de lista</span>
                        <span style={{ textDecoration: "line-through", color: "var(--txt-3)" }}>{ARS(pricing.base)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--green)" }}>Descuento {pricing.pct}%</span>
                        <span style={{ color: "var(--green)", fontWeight: 600 }}>
                          -{ARS(Math.round(pricing.base * pricing.pct / 100 * 100) / 100)}
                        </span>
                      </div>
                    </>
                  )}

                  <div style={{ borderTop: "1px solid var(--card-border)", margin: "4px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Total a cobrar</span>
                    <span style={{ fontWeight: 800, fontSize: 20, color: "var(--amber-bright)" }}>
                      {ARS(pricing.final)}
                    </span>
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

Object.assign(window, { ORDER_STATUS, OrdersView, NewOrderSheet, PedidoDetailSheet });
