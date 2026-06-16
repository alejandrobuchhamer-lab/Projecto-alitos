/* ===================== ALITO'S · Sheets del admin ===================== */
const { useState: asUseState, useEffect: asUseEffect } = React;

/* ---------- NEW MOVEMENT ---------- */
function MovSheet({ open, onClose, onConfirm }) {
  const [type, setType] = asUseState("in");
  const [account, setAccount] = asUseState("efectivo");
  const [amount, setAmount] = asUseState("");
  const [concept, setConcept] = asUseState("");
  const [note, setNote] = asUseState("");
  asUseEffect(() => { if (open) { setType("in"); setAccount("efectivo"); setAmount(""); setConcept(""); setNote(""); } }, [open]);
  const val = parseMoney(amount);
  const ok = val > 0 && concept.trim();
  return (
    <Sheet open={open} onClose={onClose} icon="plus" title="Nuevo movimiento" sub="Registrá una entrada o salida"
      foot={<button className="btn btn-primary btn-block" disabled={!ok} onClick={() => onConfirm({ date: nowStamp(), concept: concept.trim(), sub: note.trim() || "Registro manual", account, type, amount: val })}><Icon name="check" size={18} />Registrar {val ? ARS(val) : ""}</button>}>
      <div className="stack gap-14">
        <div className="seg">
          <button className={type === "in" ? "active in" : ""} onClick={() => setType("in")}><span className="sd" style={{ background: "var(--green)" }} />Entrada</button>
          <button className={type === "out" ? "active out" : ""} onClick={() => setType("out")}><span className="sd" style={{ background: "var(--red)" }} />Salida</button>
        </div>
        <div className="field">
          <label className="lab">Monto</label>
          <div className="money big"><span className="sgn">$</span><input className="input" inputMode="numeric" value={amount} placeholder="0" onChange={e => setAmount(fmtMoney(e.target.value))} /></div>
        </div>
        <div className="field">
          <label className="lab">Cuenta</label>
          <select className="select" value={account} onChange={e => setAccount(e.target.value)}>
            {Object.entries(ACCOUNTS).map(([k, a]) => <option key={k} value={k}>{a.emoji} {a.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="lab">Concepto</label>
          <input className="input" placeholder="Ej: Cobranza Kiosco Don Pedro" value={concept} onChange={e => setConcept(e.target.value)} />
        </div>
        <div className="field">
          <label className="lab">Nota <span className="muted">(opcional)</span></label>
          <textarea className="textarea" placeholder="Detalle interno…" value={note} onChange={e => setNote(e.target.value)} />
        </div>
      </div>
    </Sheet>
  );
}
function nowStamp() { const d = new Date(); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

/* ---------- TRANSFER ---------- */
function TransferSheet({ open, accounts, onClose, onConfirm }) {
  const [from, setFrom] = asUseState("efectivo");
  const [to, setTo] = asUseState("banco");
  const [amount, setAmount] = asUseState("");
  asUseEffect(() => { if (open) { setFrom("efectivo"); setTo("banco"); setAmount(""); } }, [open]);
  const val = parseMoney(amount);
  const insufficient = val > accounts[from].balance;
  const same = from === to;
  function pickFrom(v) { setFrom(v); if (v === to) setTo(Object.keys(ACCOUNTS).find(k => k !== v)); }
  function pickTo(v) { setTo(v); if (v === from) setFrom(Object.keys(ACCOUNTS).find(k => k !== v)); }
  return (
    <Sheet open={open} onClose={onClose} icon="transfer" title="Transferencia entre cuentas" sub="Movés saldo sin alterar el total"
      foot={<button className="btn btn-primary btn-block" disabled={!val || insufficient || same} onClick={() => onConfirm(from, to, val)}><Icon name="check" size={18} />Confirmar transferencia</button>}>
      <div className="stack gap-14">
        <div className="row gap-10" style={{ alignItems: "stretch" }}>
          <div className="field grow">
            <label className="lab">Desde</label>
            <select className="select" value={from} onChange={e => pickFrom(e.target.value)}>
              {Object.entries(ACCOUNTS).map(([k, a]) => <option key={k} value={k}>{a.emoji} {a.short}</option>)}
            </select>
            <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 2 }}>Saldo {ARS(accounts[from].balance)}</div>
          </div>
          <div style={{ display: "grid", placeItems: "center", color: "var(--amber-bright)", paddingTop: 26 }}><Icon name="arrowRight" size={22} /></div>
          <div className="field grow">
            <label className="lab">Hacia</label>
            <select className="select" value={to} onChange={e => pickTo(e.target.value)}>
              {Object.entries(ACCOUNTS).map(([k, a]) => <option key={k} value={k}>{a.emoji} {a.short}</option>)}
            </select>
            <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 2 }}>Saldo {ARS(accounts[to].balance)}</div>
          </div>
        </div>
        <div className="field">
          <label className="lab">Monto a transferir</label>
          <div className="money big"><span className="sgn">$</span><input className="input" inputMode="numeric" value={amount} placeholder="0" onChange={e => setAmount(fmtMoney(e.target.value))} /></div>
        </div>
        {insufficient && <div className="note" style={{ background: "var(--red-soft)", borderColor: "rgba(224,96,74,0.25)" }}><Icon name="alert" size={16} style={{ color: "var(--red)" }} /><span>Saldo insuficiente en {ACCOUNTS[from].short} (disponible {ARS(accounts[from].balance)}).</span></div>}
      </div>
    </Sheet>
  );
}

/* ---------- ASSIGN STOCK ---------- */
function AssignSheet({ vendor, onClose, onConfirm }) {
  const [qty, setQty] = asUseState({});
  const [step, setStep] = asUseState(1);
  const [productos, setProductos] = asUseState([]);

  asUseEffect(() => {
    if (vendor) {
      setQty({});
      setStep(1);
      fetchProductos().then(data => setProductos(data)).catch(() => {
        setProductos(PRODUCTS.map(p => ({ id: p.id, nombre: p.name, precio_venta_base: p.price, stock_actual: 0 })));
      });
    }
  }, [vendor]);

  if (!vendor) return <Sheet open={false} onClose={onClose} />;

  const prodList = productos.length
    ? productos
    : PRODUCTS.map(p => ({ id: p.id, nombre: p.name, precio_venta_base: p.price, stock_actual: 0 }));

  const bump = (id, d) => {
    const prod = prodList.find(p => String(p.id) === String(id));
    const avail = Math.max(0, Math.round(prod ? prod.stock_actual || 0 : 9999));
    setQty(q => ({ ...q, [id]: Math.max(0, Math.min(avail || 9999, (q[id] || 0) + d)) }));
  };
  const setDirect = (id, val) => {
    const prod = prodList.find(p => String(p.id) === String(id));
    const avail = Math.max(0, Math.round(prod ? prod.stock_actual || 0 : 9999));
    const n = parseInt(val, 10);
    setQty(q => ({ ...q, [id]: isNaN(n) ? 0 : Math.max(0, Math.min(avail || 9999, n)) }));
  };
  const total = Object.values(qty).reduce((a, b) => a + b, 0);

  function handleConfirm() {
    const asigs = Object.entries(qty).filter(([, c]) => c > 0).map(([id, cantidad]) => {
      const prod = prodList.find(p => String(p.id) === String(id));
      return { productoId: Number(id), cantidad, precio: prod ? prod.precio_venta_base || 0 : 0 };
    });
    onConfirm(total, asigs);
  }

  return (
    <Sheet open={!!vendor} onClose={onClose} icon="box" title={step === 1 ? "Asignar stock" : "¡Stock asignado!"} sub={step === 1 ? `Para ${vendor.name}` : null}
      foot={step === 1
        ? <React.Fragment>
            <div className="grow"><div style={{ fontSize: 11, color: "var(--txt-3)" }}>Total</div><div style={{ fontSize: 18, fontWeight: 750 }}>{total} u.</div></div>
            <button className="btn btn-primary" style={{ minWidth: 150 }} disabled={total === 0} onClick={() => setStep(2)}><Icon name="send" size={17} />Enviar carga</button>
          </React.Fragment>
        : <button className="btn btn-primary btn-block" onClick={handleConfirm}>Listo</button>}>
      {step === 1 ? (
        <div className="stack gap-10">
          <div className="row gap-12" style={{ padding: "0 2px 6px" }}>
            <Ava v={vendor} size={42} circ />
            <div><div style={{ fontSize: 14, fontWeight: 700 }}>{vendor.name}</div><div style={{ fontSize: 11.5, color: "var(--txt-3)" }}>Lleva {vendor.stockUnits} u. a bordo</div></div>
          </div>
          {prodList.map(p => {
            const mock = PROD_BY_ID[p.id] || {};
            const img = mock.img || "assets/alfajor-maicena.png";
            const avail = Math.round(p.stock_actual || 0);
            return (
              <div className="prow" key={p.id}>
                <div className="pimg"><img src={img} alt="" /></div>
                <div className="grow">
                  <div className="pname">{p.nombre || p.name}</div>
                  <div className="pmeta">Disponible: <b>{avail} u.</b></div>
                </div>
                <div className="qty">
                  <button onClick={() => bump(String(p.id), -1)}>−</button>
                  <input
                    type="number" inputMode="numeric" min={0}
                    value={qty[String(p.id)] || 0}
                    onChange={e => setDirect(String(p.id), e.target.value)}
                    style={{ textAlign: "center", width: 56 }}
                  />
                  <button onClick={() => bump(String(p.id), 1)}>+</button>
                </div>
              </div>
            );
          })}
          <div className="note"><Icon name="info" size={16} />Podés escribir la cantidad o usar los botones + / −.</div>
        </div>
      ) : (
        <div className="receipt">
          <div className="r-check"><Icon name="check" size={38} sw={3} /></div>
          <div className="r-title">Carga enviada</div>
          <div className="r-amt" style={{ color: "var(--amber-bright)" }}>{total} u.</div>
          <div className="r-sub">{vendor.name} la verá en su app</div>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- VENDOR DETAIL ---------- */
function VendorDetailSheet({ vendor, onClose, onAssign }) {
  const [entregas, setEntregas] = asUseState([]);
  asUseEffect(() => {
    if (vendor) {
      fetchEntregas().then(data => {
        setEntregas(data.filter(e => e.vendedorId === vendor.id));
      }).catch(() => setEntregas([]));
    }
  }, [vendor && vendor.id]);

  if (!vendor) return <Sheet open={false} onClose={onClose} />;
  return (
    <Sheet open={!!vendor} onClose={onClose}
      foot={<React.Fragment>
        <button className="btn btn-ghost grow" onClick={onClose}>Cerrar</button>
        <button className="btn btn-primary grow" onClick={() => onAssign(vendor)}><Icon name="box" size={18} />Asignar stock</button>
      </React.Fragment>}>
      <div className="stack gap-16">
        <div className="row gap-12">
          <Ava v={vendor} size={56} circ />
          <div className="grow">
            <div style={{ fontSize: 18, fontWeight: 750 }}>{vendor.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--txt-3)", marginTop: 2 }}>{vendor.role}</div>
          </div>
          <span className={"badge " + (vendor.online ? "green" : "gray")} style={vendor.online ? {} : { background: "var(--card-2)", color: "var(--txt-2)" }}><span className="bd" />{vendor.online ? "En línea" : "Offline"}</span>
        </div>
        <div className="metric-grid">
          {[
            { l: "Ventas hoy",   v: vendor.sales ? ARS(vendor.sales) : "—",   c: "var(--green)" },
            { l: "Stock a bordo",v: vendor.stockUnits + " u.",                  c: "var(--amber-bright)" },
            { l: "A cobrar",     v: vendor.pending ? ARS(vendor.pending) : "$0", c: vendor.pending ? "var(--red)" : "var(--txt)" },
            { l: "Entregas",     v: entregas.length,                             c: "var(--blue)" },
          ].map((s, i) => (
            <div className="card-2" style={{ padding: 14 }} key={i}>
              <div style={{ fontSize: 11.5, color: "var(--txt-2)" }}>{s.l}</div>
              <div style={{ fontSize: 19, fontWeight: 750, color: s.c, marginTop: 4 }}>{s.v}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="section-title">Entregas activas</div>
          <div className="card">
            {entregas.length === 0 && <div className="empty"><Icon name="store" size={36} /><div>Sin entregas activas</div></div>}
            {entregas.map((e, i) => (
              <div key={e.id}>
                <div className="mv">
                  <div className="mv-ico" style={{ background: e.type === "ok" ? "var(--green-soft)" : "var(--red-soft)", color: e.type === "ok" ? "var(--green)" : "var(--red)" }}><Icon name="store" size={16} /></div>
                  <div className="grow"><div className="mv-concept">{e.place}</div><div className="mv-sub">{e.units} u.{e.exp ? " · vence " + e.exp : ""}</div></div>
                  {e.debt > 0 && <span className="badge amber">{ARS(e.debt)}</span>}
                </div>
                {i < entregas.length - 1 && <div className="divider" style={{ marginLeft: 64 }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- PLACE DETAIL (admin, read) ---------- */
function PlaceDetailSheetAdmin({ place, onClose }) {
  if (!place) return <Sheet open={false} onClose={onClose} />;
  if (place.isDriver) {
    const served = PLACES.filter(p => p.vendor === place.id).length;
    return (
      <Sheet open onClose={onClose} icon="truck" title={place.name} sub="Repartidor · en vivo">
        <div className="stack gap-14">
          <div className="metric-grid">
            {[{ l: "Estado", v: "En reparto", c: "var(--green)" }, { l: "Stock a bordo", v: place.stockUnits + " u.", c: "var(--amber-bright)" }, { l: "En ruta", v: served + " paradas", c: "var(--blue)" }, { l: "A cobrar", v: place.pending ? ARS(place.pending) : "—", c: place.pending ? "var(--red)" : "var(--txt)" }].map((s, i) => (
              <div className="card-2" style={{ padding: 14 }} key={i}><div style={{ fontSize: 11.5, color: "var(--txt-2)" }}>{s.l}</div><div style={{ fontSize: 18, fontWeight: 750, color: s.c, marginTop: 4 }}>{s.v}</div></div>
            ))}
          </div>
        </div>
      </Sheet>
    );
  }
  const p = PROD_BY_ID[place.prod] || { name: place.prod || "Alfajor", img: "assets/alfajor-maicena.png" };
  const v = { name: place.vendedor || "Sin asignar" };
  return (
    <Sheet open onClose={onClose} icon="store" title={place.name} sub={place.addr}>
      <div className="stack gap-14">
        <div className="row gap-12">
          {place.type === "warn" ? <span className="badge red"><span className="bd" />Vence en {place.days} días</span> : <span className="badge green"><span className="bd" />Mercadería vigente</span>}
          {place.debt > 0 && <span className="badge amber">Debe {ARS(place.debt)}</span>}
        </div>
        <div className="prow">
          <div className="pimg"><img src={p.img} alt="" /></div>
          <div className="grow"><div className="pname">{p.name}</div><div className="pmeta">Última entrega · <b>{place.qty} u.</b></div></div>
          <div style={{ textAlign: "right", fontSize: 12, fontWeight: 700, color: place.type === "warn" ? "var(--red)" : "var(--txt)" }}>Vence {place.exp}</div>
        </div>
        <div className="card-2" style={{ padding: 14 }}>
          <div className="row between" style={{ padding: "4px 0", fontSize: 13 }}><span className="t2">Vendedor asignado</span><span style={{ fontWeight: 650 }}>{v.name}</span></div>
          <div className="row between" style={{ padding: "4px 0", fontSize: 13 }}><span className="t2">Deuda</span><span style={{ fontWeight: 700, color: place.debt > 0 ? "var(--amber-bright)" : "var(--green)" }}>{place.debt > 0 ? ARS(place.debt) : "Al día"}</span></div>
        </div>
      </div>
    </Sheet>
  );
}

Object.assign(window, { MovSheet, TransferSheet, AssignSheet, VendorDetailSheet, PlaceDetailSheetAdmin });
