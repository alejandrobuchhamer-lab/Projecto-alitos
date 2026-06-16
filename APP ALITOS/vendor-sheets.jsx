/* ===================== ALITO'S · Sheets del vendedor ===================== */
const { useState: shUseState, useEffect: shUseEffect } = React;

const SELL_PAGO_OPTS = [
  { id: "efectivo",      l: "Efectivo",      e: "💵", pct: 10 },
  { id: "transferencia", l: "Transferencia", e: "🏦", pct: 5  },
  { id: "qr",            l: "QR / MP",       e: "📱", pct: 0  },
  { id: "consignacion",  l: "Consignación",  e: "📦", pct: 0  },
];

/* ---------- SELL sheet ─────────────────────────────────────────────────────── */
function SellSheet({ open, onClose, stock, places, onSaved }) {
  const [step, setStep]           = shUseState(1);
  // Paso 1: cliente + cantidad
  const [tipoCliente, setTipoC]   = shUseState("consumidor_final");
  const [clienteNombre, setCliNom]= shUseState("");
  const [clienteSel, setCliSel]   = shUseState(null);  // {id, nombre}
  const [negocioSel, setNegSel]   = shUseState(null);
  const [clientes, setClientes]   = shUseState([]);
  const [qty, setQty]             = shUseState({});
  const [notas, setNotas]         = shUseState("");
  const [newClienteOpen, setNCA]  = shUseState(false);
  // Paso 2: precio + descuento
  const [descPct, setDescPct]     = shUseState("");
  const [descMonto, setDescMonto] = shUseState("");
  const [lastDescEdit, setLDE]    = shUseState("pct");  // "pct" | "monto"
  // Paso 3: cobro
  const [pagosSel, setPagosSel]   = shUseState({});  // {metodo: monto_str}
  const [estadoPago, setEstPago]  = shUseState("completo");
  const [saving, setSaving]       = shUseState(false);
  const [receipt, setReceipt]     = shUseState(null);
  const [preciosMap, setPreciosMap] = shUseState({});

  shUseEffect(() => {
    if (!open) return;
    setStep(1); setTipoC("consumidor_final"); setCliNom(""); setCliSel(null); setNegSel(null);
    setQty({}); setNotas(""); setDescPct(""); setDescMonto(""); setLDE("pct");
    setPagosSel({}); setEstPago("completo"); setSaving(false); setReceipt(null); setNCA(false);
    fetchClientes().then(setClientes).catch(() => setClientes([]));
    fetchProductos().then(data => {
      const m = {};
      data.forEach(p => { m[String(p.id)] = p.precio_venta_base || 0; });
      setPreciosMap(m);
    }).catch(() => {});
  }, [open]);

  // Precio por unidad de un ítem (usa precio_venta_base del producto)
  const getPrecioUnit = (id) => {
    const sid = String(id);
    if (preciosMap[sid]) return preciosMap[sid];
    const s = stock.find(x => String(x.id) === sid || String(x.productoId) === sid);
    return s?.precio || 0;
  };

  // Calcular totales
  const totalUnits = Object.values(qty).reduce((a, b) => a + b, 0);
  const precioBase = Object.entries(qty).reduce((sum, [id, n]) => sum + n * getPrecioUnit(id), 0);
  const descPctVal   = parseFloat(lastDescEdit === "pct" ? descPct : (precioBase > 0 ? (parseFloat(descMonto || 0) / precioBase * 100).toFixed(2) : 0)) || 0;
  const descMontoVal = parseFloat(lastDescEdit === "monto" ? descMonto : (precioBase * descPctVal / 100).toFixed(2)) || 0;
  const totalFinal   = Math.max(0, Math.round((precioBase - descMontoVal) * 100) / 100);

  // Pagos
  const totalPagado = Object.values(pagosSel).reduce((a, v) => a + (parseFloat(v) || 0), 0);
  const montoPendiente = Math.max(0, Math.round((totalFinal - totalPagado) * 100) / 100);

  // Stock: primer item con disponible > 0
  const stockItem = stock.find(s => (s.loaded - s.sold) > 0) || stock[0];
  const remOf = id => {
    const s = stock.find(x => x.id === id || String(x.id) === String(id));
    return s ? Math.max(0, (s.loaded || 0) - (s.sold || 0)) : 0;
  };

  // Nombre para el recibo
  const nombreDisplay = tipoCliente === "negocio"
    ? (negocioSel?.name || "Negocio")
    : tipoCliente === "cliente"
    ? (clienteSel?.nombre || clienteNombre || "Cliente")
    : (clienteNombre || "Consumidor Final");

  async function confirmar() {
    if (totalUnits === 0 || !stockItem) return;
    setSaving(true);
    const pagosArr = Object.entries(pagosSel)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([metodo, v]) => ({ metodo, monto: parseFloat(v) }));

    const lugar = tipoCliente === "negocio" && negocioSel
      ? negocioSel.name
      : (clienteNombre || null);

    try {
      const res = await registrarVenta({
        svId:          stockItem.svId || null,
        productoId:    stockItem.productoId,
        cantidad:      totalUnits,
        precio:        totalUnits > 0 ? precioBase / totalUnits : 0,
        lugar,
        tipoCliente,
        clienteId:     clienteSel?.id || null,
        clienteNombre: nombreDisplay !== "Consumidor Final" ? nombreDisplay : null,
        pagos:         pagosArr,
        formaPago:     pagosArr.length ? pagosArr.reduce((a, p) => p.monto > a.monto ? p : a).metodo : "efectivo",
        estadoPago,
        montoPendiente: estadoPago !== "completo" ? montoPendiente : 0,
        descuentoPct:   descPctVal,
        descuentoMonto: descMontoVal,
        montoOriginal:  precioBase,
      });
      setReceipt({ units: totalUnits, total: totalFinal, costo: res.costo || 0, ganancia: res.ganancia || 0, lugar, estadoPago, montoPendiente });
      if (onSaved) onSaved();
    } catch(e) {
      setSaving(false);
    }
  }

  if (receipt) {
    return (
      <Sheet open={open} onClose={onClose} icon="check" title="¡Venta registrada!" sub={null}
        foot={<button className="btn btn-primary btn-block" onClick={onClose}>Listo</button>}>
        <div className="receipt">
          <div className="r-check"><Icon name="check" size={38} sw={3} /></div>
          <div className="r-title">{receipt.estadoPago === "completo" ? "Cobrado" : receipt.estadoPago === "parcial" ? "Cobro parcial" : "Pendiente de cobro"}</div>
          <div className="r-amt">{ARS(receipt.total)}</div>
          <div className="r-sub">{receipt.lugar || "Consumidor Final"} · {receipt.units} u.</div>
          <div className="receipt-lines">
            {receipt.estadoPago !== "completo" && (
              <div className="rl" style={{ color: "var(--amber-bright)" }}>
                <span className="k">Pendiente</span>
                <span className="v" style={{ fontWeight: 700 }}>{ARS(receipt.montoPendiente)}</span>
              </div>
            )}
            {receipt.costo > 0 && (
              <div className="rl">
                <span className="k">Costo lote</span>
                <span className="v">{ARS(receipt.costo)}</span>
              </div>
            )}
            {receipt.ganancia !== 0 && (
              <div className="rl">
                <span className="k">Ganancia bruta</span>
                <span className="v" style={{ color: receipt.ganancia >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{ARS(receipt.ganancia)}</span>
              </div>
            )}
            <div className="rl"><span className="k">Hora</span><span className="v">{new Date().toTimeString().slice(0, 5)} hs</span></div>
            <div className="rl"><span className="k">Stock descontado</span><span className="v">−{receipt.units} u.</span></div>
          </div>
        </div>
      </Sheet>
    );
  }

  // Paso footer
  const foot = (
    <div style={{ display: "flex", gap: 8 }}>
      {step > 1
        ? <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(s => s - 1)}>← Atrás</button>
        : <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
      }
      {step < 3
        ? <button className="btn btn-primary" style={{ flex: 2 }}
            disabled={step === 1 && totalUnits === 0}
            onClick={() => setStep(s => s + 1)}>
            {step === 1 ? `${totalUnits} u. · Precio →` : "Cobro →"}
          </button>
        : <button className="btn btn-primary" style={{ flex: 2 }}
            disabled={totalUnits === 0 || saving}
            onClick={confirmar}>
            <Icon name="check" size={18} />
            {saving ? "Guardando…" : (estadoPago === "completo" ? `Cobrar ${ARS(totalFinal)}` : `Guardar · ${ARS(totalFinal)}`)}
          </button>
      }
    </div>
  );

  const docenas = Math.floor(totalUnits / 12);
  const medias  = Math.floor((totalUnits % 12) / 6);
  const sueltas = totalUnits % 6;

  return (
    <Sheet open={open} onClose={onClose} icon="cart" title="Nueva venta" sub={`Paso ${step} de 3`} foot={foot}>

      {/* Indicador de pasos */}
      <div className="chip-row" style={{ marginBottom: 4 }}>
        {["1. Cliente", "2. Precio", "3. Cobro"].map((s, i) => (
          <button key={i} className={"chip" + (step === i + 1 ? " active" : "")}
            onClick={() => { if (i + 1 < step || (i + 1 === 2 && totalUnits > 0) || i + 1 <= step) setStep(i + 1); }}
            style={{ flex: 1, fontSize: 12 }}>{s}</button>
        ))}
      </div>

      {/* ── Paso 1: Cliente + Cantidad ── */}
      {step === 1 && (
        <div className="stack gap-12">
          <div className="field">
            <label className="lab">Tipo de cliente</label>
            <div className="chip-row">
              {[
                { id: "consumidor_final", l: "CF" },
                { id: "cliente", l: "Cliente" },
                { id: "negocio", l: "Negocio" },
              ].map(t => (
                <button key={t.id} className={"chip" + (tipoCliente === t.id ? " active" : "")}
                  onClick={() => setTipoC(t.id)} style={{ flex: 1 }}>{t.l}</button>
              ))}
            </div>
          </div>

          {tipoCliente === "consumidor_final" && (
            <div className="field">
              <label className="lab">Nombre (opcional)</label>
              <input className="input" placeholder="Ej: Juan García"
                value={clienteNombre} onChange={e => setCliNom(e.target.value)} />
            </div>
          )}

          {tipoCliente === "cliente" && (
            <div className="field">
              <label className="lab">Cliente</label>
              {clientes.length > 0 ? (
                <select className="select" value={clienteSel?.id || ""}
                  onChange={e => {
                    const c = clientes.find(x => String(x.id) === e.target.value);
                    setCliSel(c || null);
                    if (!c) setCliNom("");
                  }}>
                  <option value="">— Buscar cliente —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              ) : (
                <input className="input" placeholder="Nombre del cliente"
                  value={clienteNombre} onChange={e => setCliNom(e.target.value)} />
              )}
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 6, width: "100%", fontSize: 12 }}
                onClick={() => setNCA(true)}>
                <Icon name="plus" size={14} />Nuevo cliente
              </button>
            </div>
          )}

          {tipoCliente === "negocio" && (
            <div className="field">
              <label className="lab">Negocio</label>
              <select className="select" value={negocioSel?.id || ""}
                onChange={e => {
                  const n = places.find(x => String(x.id) === e.target.value);
                  setNegSel(n || null);
                }}>
                <option value="">— Seleccioná un negocio —</option>
                {places.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
          )}

          <div className="field">
            <label className="lab">Cantidad</label>
            {stock.map(s => {
              const mock = PROD_BY_ID[s.id] || { name: s.name || "Alfajor", img: s.img || "assets/alfajor-maicena.png" };
              const rem  = Math.max(0, (s.loaded || 0) - (s.sold || 0));
              const q    = qty[s.id] || 0;
              return (
                <div className="prow" key={s.id} style={{ marginBottom: 0 }}>
                  <div className="pimg"><img src={mock.img} alt="" /></div>
                  <div className="grow">
                    <div className="pname">{mock.name}</div>
                    <div className="pmeta"><b>{rem}</b> disponibles</div>
                  </div>
                  <div className="qty">
                    <button type="button" onClick={() => setQty(q2 => ({ ...q2, [s.id]: Math.max(0, (q2[s.id] || 0) - 1) }))}>−</button>
                    <input type="number" min="0" max={rem} value={q}
                      onChange={e => setQty(q2 => ({ ...q2, [s.id]: Math.min(rem, Math.max(0, parseInt(e.target.value) || 0)) }))}
                      style={{ width: 54, textAlign: "center" }} />
                    <button type="button" disabled={q >= rem}
                      onClick={() => setQty(q2 => ({ ...q2, [s.id]: Math.min(rem, (q2[s.id] || 0) + 1) }))}>+</button>
                  </div>
                </div>
              );
            })}
          </div>

          {totalUnits > 0 && (
            <div className="note" style={{ margin: 0 }}>
              <Icon name="info" size={14} />
              {totalUnits} u. · <b>{ARS(precioBase)}</b>
            </div>
          )}

          <div className="field">
            <label className="lab">Notas (opcional)</label>
            <textarea className="input" rows={2} style={{ resize: "none" }}
              placeholder="Lugar, observaciones…" value={notas} onChange={e => setNotas(e.target.value)} />
          </div>
        </div>
      )}

      {/* ── Paso 2: Precio + Descuento ── */}
      {step === 2 && (
        <div className="stack gap-10">
          {/* Desglose de productos */}
          <div className="card-2" style={{ padding: "12px 14px" }}>
            <div className="stack gap-6" style={{ fontSize: 13 }}>
              {Object.entries(qty).filter(([, n]) => n > 0).map(([id, n]) => {
                const s = stock.find(x => String(x.id) === id || String(x.productoId) === id);
                const pu = getPrecioUnit(id);
                return (
                  <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--txt-2)" }}>{n} × {s?.name || "Producto"}</span>
                    <span style={{ fontWeight: 600 }}>{ARS(n * pu)}</span>
                  </div>
                );
              })}
              <div style={{ borderTop: "1px solid var(--card-border)", margin: "2px 0", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Subtotal</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{ARS(precioBase)}</span>
              </div>
            </div>
          </div>

          {/* Descuento — fila compacta */}
          <div className="card-2" style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: descMontoVal > 0 ? 10 : 0 }}>
              <span style={{ fontSize: 13, color: "var(--txt-2)", flex: 1 }}>Descuento</span>
              {/* % */}
              <div style={{ display: "flex", alignItems: "center", background: "var(--bg)", border: "1px solid var(--card-border)", borderRadius: 8, overflow: "hidden", width: 80 }}>
                <input inputMode="decimal" placeholder="0"
                  value={descPct}
                  onChange={e => {
                    setDescPct(e.target.value); setLDE("pct");
                    const pct = parseFloat(e.target.value) || 0;
                    setDescMonto(pct > 0 ? (precioBase * pct / 100).toFixed(0) : "");
                  }}
                  style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 14, padding: "8px 6px", textAlign: "right" }} />
                <span style={{ paddingRight: 8, color: "var(--txt-3)", fontSize: 13 }}>%</span>
              </div>
              <span style={{ color: "var(--txt-3)", fontSize: 12 }}>ó</span>
              {/* $ */}
              <div style={{ display: "flex", alignItems: "center", background: "var(--bg)", border: "1px solid var(--card-border)", borderRadius: 8, overflow: "hidden", width: 90 }}>
                <span style={{ paddingLeft: 8, color: "var(--txt-3)", fontSize: 13 }}>$</span>
                <input inputMode="decimal" placeholder="0"
                  value={descMonto}
                  onChange={e => {
                    setDescMonto(e.target.value); setLDE("monto");
                    const m = parseFloat(e.target.value) || 0;
                    setDescPct(precioBase > 0 ? (m / precioBase * 100).toFixed(1) : "");
                  }}
                  style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 14, padding: "8px 6px" }} />
              </div>
            </div>
            {descMontoVal > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--green)", paddingTop: 8, borderTop: "1px solid var(--card-border)" }}>
                <span>Descuento aplicado {descPctVal.toFixed(1)}%</span>
                <span style={{ fontWeight: 600 }}>−{ARS(descMontoVal)}</span>
              </div>
            )}
          </div>

          {/* Total grande */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 2px" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
            <span style={{ fontWeight: 800, fontSize: 26, color: "var(--amber-bright)" }}>{ARS(totalFinal)}</span>
          </div>
        </div>
      )}

      {/* ── Paso 3: Cobro ── */}
      {step === 3 && (
        <div className="stack gap-12">
          <div className="note" style={{ margin: 0 }}>
            <Icon name="cash" size={15} /><b>Total a cobrar: {ARS(totalFinal)}</b>
            {nombreDisplay !== "Consumidor Final" ? ` — ${nombreDisplay}` : ""}
          </div>

          {/* Métodos de pago */}
          <div className="field">
            <label className="lab">Forma de cobro</label>
            <div className="stack gap-8">
              {SELL_PAGO_OPTS.map(m => {
                const val = pagosSel[m.id] || "";
                const activo = val !== "" && parseFloat(val) > 0;
                return (
                  <div key={m.id} className="card-2"
                    style={{ padding: "10px 14px", borderColor: activo ? "var(--amber-bright)" : "var(--card-border)", cursor: "pointer" }}
                    onClick={() => {
                      if (!val) {
                        setPagosSel(p => ({ ...p, [m.id]: String(montoPendiente > 0 ? montoPendiente : totalFinal) }));
                      }
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{m.e}</span>
                      <span style={{ fontWeight: 600, flex: 1 }}>{m.l}</span>
                      <div className="money" style={{ maxWidth: 100 }}>
                        <span style={{ color: "var(--txt-3)", fontSize: 14 }}>$</span>
                        <input className="input" inputMode="decimal"
                          placeholder="0" value={val}
                          style={{ textAlign: "right", width: 80, padding: "4px 6px" }}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setPagosSel(p => ({ ...p, [m.id]: e.target.value }))} />
                      </div>
                      {activo && (
                        <button style={{ background: "none", border: "none", color: "var(--txt-3)", cursor: "pointer", padding: 0 }}
                          onClick={e => { e.stopPropagation(); setPagosSel(p => { const n = { ...p }; delete n[m.id]; return n; }); }}>
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Estado de pago */}
          <div className="field">
            <label className="lab">Estado del cobro</label>
            <div className="chip-row">
              {[
                { id: "completo",  l: "Completo" },
                { id: "parcial",   l: "Pago parcial" },
                { id: "pendiente", l: "Falta cobrar" },
              ].map(e => (
                <button key={e.id} className={"chip" + (estadoPago === e.id ? " active" : "")}
                  onClick={() => setEstPago(e.id)} style={{ flex: 1, fontSize: 12 }}>
                  {e.l}
                </button>
              ))}
            </div>
          </div>

          {/* Resumen de cobro */}
          <div className="card-2" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: "var(--txt-2)" }}>Total venta</span>
              <span style={{ fontWeight: 600 }}>{ARS(totalFinal)}</span>
            </div>
            {totalPagado > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: "var(--green)" }}>Pagado</span>
                <span style={{ fontWeight: 600, color: "var(--green)" }}>{ARS(totalPagado)}</span>
              </div>
            )}
            {estadoPago !== "completo" && montoPendiente > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: "var(--amber-bright)" }}>Pendiente</span>
                <span style={{ fontWeight: 700, color: "var(--amber-bright)" }}>{ARS(montoPendiente)}</span>
              </div>
            )}
            <div style={{ borderTop: "1px solid var(--card-border)", marginTop: 8, paddingTop: 8,
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>{totalUnits} unidades · {nombreDisplay}</span>
              <span className={"badge " + (estadoPago === "completo" ? "green" : estadoPago === "parcial" ? "amber" : "red")}>
                <span className="bd" />{estadoPago === "completo" ? "Cobrado" : estadoPago === "parcial" ? "Parcial" : "Pendiente"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sheet de nuevo cliente inline */}
      {newClienteOpen && (
        <NuevoClienteSheet
          open={newClienteOpen}
          onClose={() => setNCA(false)}
          onSaved={c => {
            setClientes(prev => [...prev, c]);
            setCliSel(c);
            setNCA(false);
          }}
        />
      )}
    </Sheet>
  );
}

/* ---------- Nuevo cliente inline ───────────────────────────────────────────── */
function NuevoClienteSheet({ open, onClose, onSaved }) {
  const [nombre, setNombre]   = shUseState("");
  const [apellido, setApell]  = shUseState("");
  const [telefono, setTel]    = shUseState("");
  const [empresa, setEmpresa] = shUseState("");
  const [saving, setSaving]   = shUseState(false);
  shUseEffect(() => { if (open) { setNombre(""); setApell(""); setTel(""); setEmpresa(""); } }, [open]);

  async function guardar() {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const c = await crearCliente({ nombre: nombre.trim(), apellido: apellido.trim() || undefined, telefono: telefono || undefined, empresa: empresa || undefined });
      onSaved({ id: c.id, nombre: c.nombre_completo || (nombre + " " + apellido).trim() });
    } catch(e) { setSaving(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} icon="user" title="Nuevo cliente" sub="Se guarda en el sistema"
      foot={
        <button className="btn btn-primary btn-block" disabled={!nombre.trim() || saving} onClick={guardar}>
          <Icon name="check" size={18} />{saving ? "Guardando…" : "Guardar cliente"}
        </button>
      }>
      <div className="stack gap-12">
        <div className="field">
          <label className="lab">Nombre *</label>
          <input className="input" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>
        <div className="field">
          <label className="lab">Apellido</label>
          <input className="input" placeholder="Apellido" value={apellido} onChange={e => setApell(e.target.value)} />
        </div>
        <div className="field">
          <label className="lab">Teléfono</label>
          <input className="input" inputMode="tel" placeholder="11 2345-6789" value={telefono} onChange={e => setTel(e.target.value)} />
        </div>
        <div className="field">
          <label className="lab">Empresa (opcional)</label>
          <input className="input" placeholder="Nombre del negocio" value={empresa} onChange={e => setEmpresa(e.target.value)} />
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Completar pago pendiente ──────────────────────────────────────── */
function CompletarPagoSheet({ venta, onClose, onSaved }) {
  const [formaPago, setFormaPago] = shUseState("efectivo");
  const [monto, setMonto]         = shUseState("");
  const [saving, setSaving]       = shUseState(false);
  shUseEffect(() => {
    if (venta) { setFormaPago("efectivo"); setMonto(String(venta.monto_pendiente || "")); }
  }, [venta]);

  if (!venta) return <Sheet open={false} onClose={onClose} />;
  const val = parseFloat(monto) || 0;

  async function confirmar() {
    if (!val) return;
    setSaving(true);
    try {
      await completarPago(venta.id, { formaPago, monto: val });
      if (onSaved) onSaved();
    } catch(e) { setSaving(false); }
  }

  return (
    <Sheet open={!!venta} onClose={onClose} icon="cash"
      title="Completar pago"
      sub={`${venta.cliente_nombre || venta.lugar || "Consumidor Final"} · Pendiente: ${ARS(venta.monto_pendiente)}`}
      foot={
        <button className="btn btn-primary btn-block" disabled={!val || saving} onClick={confirmar}>
          <Icon name="check" size={18} />{saving ? "Guardando…" : `Cobrar ${ARS(val)}`}
        </button>
      }>
      <div className="stack gap-14">
        <div className="card-2" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: "var(--txt-2)" }}>Venta original</span>
            <span style={{ fontWeight: 600 }}>{ARS(venta.monto_total)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "var(--amber-bright)", fontWeight: 700 }}>Pendiente</span>
            <span style={{ color: "var(--amber-bright)", fontWeight: 800 }}>{ARS(venta.monto_pendiente)}</span>
          </div>
        </div>
        <div className="field">
          <label className="lab">Monto a cobrar ahora</label>
          <div className="money big"><span className="sgn">$</span>
            <input className="input" inputMode="numeric" value={monto} placeholder="0"
              onChange={e => setMonto(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label className="lab">Forma de pago</label>
          <div className="pay-grid">
            {SELL_PAGO_OPTS.slice(0, 3).map(m => (
              <div key={m.id} className={"pay" + (formaPago === m.id ? " sel" : "")} onClick={() => setFormaPago(m.id)}>
                <div className="pay-ico" style={{ background: "var(--card-2)" }}>{m.e}</div>
                <div className="pay-label">{m.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- COLLECT sheet ---------- */
function CollectSheet({ place, onClose, onConfirm }) {
  const [amount, setAmount] = shUseState("");
  const [pay, setPay] = shUseState("efectivo");
  const [done, setDone] = shUseState(false);
  shUseEffect(() => { if (place) { setAmount(place.debt ? ARSc(place.debt) : ""); setPay("efectivo"); setDone(false); } }, [place]);
  if (!place) return <Sheet open={false} onClose={onClose} />;
  const val = parseMoney(amount);
  const PAYS = [{ id: "efectivo", e: "💵", l: "Efectivo" }, { id: "transfer", e: "🏦", l: "Transfer." }, { id: "qr", e: "📱", l: "QR MP" }];
  return (
    <Sheet open={!!place} onClose={onClose} icon="cash" title={done ? "¡Cobro registrado!" : "Cobrar"} sub={done ? null : place.name}
      foot={done
        ? <button className="btn btn-primary btn-block" onClick={onClose}>Listo</button>
        : <button className="btn btn-success btn-block" disabled={!val} onClick={() => { setDone(true); setTimeout(() => onConfirm(val, pay), 900); }}><Icon name="check" size={18} />Confirmar cobro de {val ? ARS(val) : "$0"}</button>
      }>
      {done ? (
        <div className="receipt">
          <div className="r-check"><Icon name="check" size={38} sw={3} /></div>
          <div className="r-title">Cobrado</div>
          <div className="r-amt">{ARS(val)}</div>
          <div className="r-sub">{place.name}</div>
        </div>
      ) : (
        <div className="stack gap-14">
          {place.debt > 0 && (
            <div className="note"><Icon name="info" size={16} />Este negocio adeuda <b style={{ color: "var(--amber-bright)" }}>{ARS(place.debt)}</b>.</div>
          )}
          <div className="field">
            <label className="lab">Monto a cobrar</label>
            <div className="money big"><span className="sgn">$</span>
              <input className="input" inputMode="numeric" value={amount} placeholder="0" onChange={e => setAmount(fmtMoney(e.target.value))} />
            </div>
          </div>
          <div className="field">
            <label className="lab">Forma de pago</label>
            <div className="pay-grid">
              {PAYS.map(m => (
                <div key={m.id} className={"pay" + (pay === m.id ? " sel" : "")} onClick={() => setPay(m.id)}>
                  <div className="pay-ico" style={{ background: "var(--card-2)" }}>{m.e}</div>
                  <div className="pay-label">{m.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- NEW BUSINESS sheet ---------- */
function NewBizSheet({ open, onClose, onConfirm }) {
  const [name, setName] = shUseState("");
  const [addr, setAddr] = shUseState("");
  const [type, setType] = shUseState("kiosco");
  shUseEffect(() => { if (open) { setName(""); setAddr(""); setType("kiosco"); } }, [open]);
  const TYPES = [{ id: "kiosco", l: "Kiosco" }, { id: "almacen", l: "Almacén" }, { id: "super", l: "Super" }, { id: "bar", l: "Bar/Café" }];
  return (
    <Sheet open={open} onClose={onClose} icon="store" title="Nuevo negocio" sub="Sumá un cliente a tu cartera"
      foot={<button className="btn btn-primary btn-block" disabled={!name.trim() || !addr.trim()} onClick={() => onConfirm({ name: name.trim(), addr: addr.trim(), debt: 0 })}><Icon name="check" size={18} />Guardar negocio</button>}>
      <div className="stack gap-14">
        <div className="field">
          <label className="lab">Nombre del negocio</label>
          <input className="input" placeholder="Ej: Kiosco La Estrella" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="lab">Dirección</label>
          <input className="input" placeholder="Ej: Av. Rivadavia 1234, Morón" value={addr} onChange={e => setAddr(e.target.value)} />
        </div>
        <div className="field">
          <label className="lab">Tipo de comercio</label>
          <div className="chip-row">
            {TYPES.map(t => <button key={t.id} className={"chip" + (type === t.id ? " active" : "")} onClick={() => setType(t.id)}>{t.l}</button>)}
          </div>
        </div>
        <div className="field">
          <label className="lab">Ubicación</label>
          <button className="btn btn-ghost btn-block" onClick={e => e.preventDefault()}><Icon name="pin" size={17} />Usar mi ubicación actual</button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- PLACE DETAIL sheet ---------- */
function PlaceDetailSheet({ place, onClose, onCollect, onSell }) {
  if (!place) return <Sheet open={false} onClose={onClose} />;
  const p = PROD_BY_ID[place.prod] || { name: place.prod || "Alfajor", img: "assets/alfajor-maicena.png" };
  const v = VEND_BY_ID[place.vendor] || { name: place.vendedor || "Sin asignar" };
  return (
    <Sheet open={!!place} onClose={onClose} icon="store" title={place.name} sub={place.addr}
      foot={
        <React.Fragment>
          {place.debt > 0 && <button className="btn btn-ghost grow" onClick={() => onCollect(place)}><Icon name="cash" size={18} />Cobrar</button>}
          <button className="btn btn-primary grow" onClick={onSell}><Icon name="cart" size={18} />Vender acá</button>
        </React.Fragment>
      }>
      <div className="stack gap-14">
        <div className="row gap-12">
          {place.type === "warn"
            ? <span className="badge red"><span className="bd" />Mercadería vence en {place.days} días</span>
            : <span className="badge green"><span className="bd" />Mercadería vigente</span>}
          {place.debt > 0 && <span className="badge amber">Debe {ARS(place.debt)}</span>}
        </div>
        {place.qty > 0 && (
          <div className="prow">
            <div className="pimg"><img src={p.img} alt="" /></div>
            <div className="grow">
              <div className="pname">{p.name}</div>
              <div className="pmeta">Última entrega · <b>{place.qty} u.</b></div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: place.type === "warn" ? "var(--red)" : "var(--txt)" }}>Vence {place.exp}</div>
            </div>
          </div>
        )}
        <div className="card-2" style={{ padding: 14 }}>
          <div className="row between" style={{ padding: "4px 0", fontSize: 13 }}><span className="t2">Vendedor asignado</span><span style={{ fontWeight: 650 }}>{v.name}</span></div>
          <div className="row between" style={{ padding: "4px 0", fontSize: 13 }}><span className="t2">Deuda actual</span><span style={{ fontWeight: 700, color: place.debt > 0 ? "var(--amber-bright)" : "var(--green)" }}>{place.debt > 0 ? ARS(place.debt) : "Al día"}</span></div>
        </div>
      </div>
    </Sheet>
  );
}

Object.assign(window, { SellSheet, CollectSheet, NewBizSheet, PlaceDetailSheet, NuevoClienteSheet, CompletarPagoSheet });
