/* ===================== ALITO'S · App VENDEDOR REPARTIDOR ===================== */
const { useState: vUseState, useRef: vUseRef, useContext: vUseContext, useEffect: vUseEffect } = React;

function VendorApp({ onLogout, user }) {
  const ME = { name: user?.nombre || user?.name || "Vendedor", first: user?.first || user?.nombre?.split(" ")[0] || "V",
                color: user?.color || "#c47820", avatar: user?.avatar || "V", id: user?.id };
  const toast = vUseContext(ToastCtx);
  const [tab, setTab] = vUseState("inicio");
  const [stock, setStock] = vUseState([]);
  const [sales, setSales] = vUseState([]);
  const [places, setPlaces] = vUseState([]);

  // sheets
  const [sellOpen, setSellOpen]         = vUseState(false);
  const [collectPlace, setCollectPlace] = vUseState(null);
  const [newBizOpen, setNewBizOpen]     = vUseState(false);
  const [placeDetail, setPlaceDetail]   = vUseState(null);
  const [pendingVenta, setPendingVenta] = vUseState(null);
  const [pendientes, setPendientes]     = vUseState([]);
  const [profileOpen, setProfileOpen]   = vUseState(false);

  function reloadData() {
    fetchMiStock().then(setStock).catch(() => {});
    fetchMisVentas().then(setSales).catch(() => {});
    fetchNegocios().then(setPlaces).catch(() => {});
    fetchVentasPendientes().then(setPendientes).catch(() => {});
  }

  // Cargar datos + SSE tiempo real
  vUseEffect(() => {
    reloadData();
    pingOnline();
    const ivPing = setInterval(pingOnline, 5 * 60 * 1000);

    let evtSrc = null;
    function conectarSSE() {
      evtSrc = new EventSource(API_BASE + "/api/events");
      evtSrc.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.tipo === "connected") return;
          reloadData();
          const notif = sseEventToNotif(d);
          if (notif) pushNotif(notif);
        } catch(_) {}
      };
      evtSrc.onerror = () => {
        evtSrc.close();
        setTimeout(conectarSSE, 4000);
      };
    }
    conectarSSE();

    return () => { clearInterval(ivPing); if (evtSrc) evtSrc.close(); };
  }, []);

  const myPlaces = places;
  const soldToday = sales.reduce((a, s) => a + (s.units || s.cantidad || 0), 0);
  const cashToday = sales.reduce((a, s) => a + (s.amount || s.monto_total || 0), 0);
  const myDebt = myPlaces.reduce((a, p) => a + (p.debt || 0), 0);
  const totalLoaded = stock.reduce((a, s) => a + ((s.loaded || 0) - (s.sold || 0)), 0);

  function onVentaSaved() {
    reloadData();
    toast("Venta registrada", "ok");
  }
  async function collect(place, amount, pay) {
    // Si la deuda viene de una entrega con ID, registrarla en el backend
    if (place.entregaId) {
      try {
        await cobrarEntrega(place.entregaId, pay);
      } catch(e) {}
    }
    setPlaces(ps => ps.map(p => p.id === place.id ? { ...p, debt: Math.max(0, p.debt - amount) } : p));
    pushNotif({ kind: "cobro", who: ME.name, color: ME.color, title: `${ME.first} cobró una deuda`, sub: `${place.name} · ${pay === "qr" ? "MercadoPago" : pay === "transfer" ? "Transferencia" : "efectivo"}`, amount, dir: "in" });
    toast(`Cobro de ${ARS(amount)} · ${place.name}`, "ok");
  }
  async function addBiz(biz) {
    try {
      await apiPost("/vendedores/api/negocios", { nombre: biz.name, direccion: biz.addr });
      fetchNegocios().then(data => { if (data.length) setPlaces(data); }).catch(() => {});
    } catch(e) {
      // guardar local como fallback
      const id = Math.max(0, ...places.map(p => p.id || 0)) + 1;
      setPlaces(ps => [...ps, { ...biz, id, vendor: ME.id, qty: 0, type: "ok", debt: 0, x: 0, y: 0 }]);
    }
    pushNotif({ kind: "negocio", who: ME.name, color: ME.color, title: "Nuevo negocio cargado", sub: `${biz.name} · ${biz.addr}`, dir: "info" });
    toast(`${biz.name} agregado a tu cartera`, "ok");
  }
  const nav = [
    { id: "inicio", icon: "home", label: "Inicio" },
    { id: "ruta", icon: "map", label: "Ruta" },
    { id: "vender", icon: "cart", label: "Vender" },
    { id: "pedidos", icon: "list", label: "Pedidos" },
    { id: "stock", icon: "box", label: "Stock" },
  ];

  return (
    <div className="screen-wrap">
      <AppBar leftLogo title="Vendedor · reparto" userName={ME.name}
        right={<NotifBell unread={0} onClick={() => toast("3 negocios con mercadería por vencer", "warn")} />}
        avatar={{ color: ME.color, txt: ME.avatar, onClick: () => setProfileOpen(true) }} />

      <PullToRefresh key={tab} onRefresh={reloadData}>
        {tab === "inicio" && <VendorHome me={ME} soldToday={soldToday} cashToday={cashToday} myDebt={myDebt} totalLoaded={totalLoaded}
          sales={sales} myPlaces={myPlaces} onSell={() => setSellOpen(true)} onCollect={setCollectPlace} onNewBiz={() => setNewBizOpen(true)}
          onPedido={() => setTab("pedidos")} />}
        {tab === "ruta" && <VendorRoute me={ME} places={myPlaces} onDetail={setPlaceDetail} onNewBiz={() => setNewBizOpen(true)} />}
        {tab === "vender" && <VendorSellTab onSell={() => setSellOpen(true)} sales={sales} cashToday={cashToday} soldToday={soldToday}
          pendientes={pendientes} onCompletarPago={setPendingVenta} />}
        {tab === "pedidos" && <OrdersView heroTitle="Mis pedidos" heroSub="Tomá pedidos para entregar después" />}
        {tab === "stock" && <VendorStock stock={stock} totalLoaded={totalLoaded} />}
      </PullToRefresh>

      <BotNav items={nav} value={tab} onChange={setTab} />

      {/* SELL sheet */}
      <SellSheet open={sellOpen} onClose={() => setSellOpen(false)} stock={stock} places={myPlaces} onSaved={onVentaSaved} />
      {/* COLLECT sheet */}
      <CollectSheet place={collectPlace} onClose={() => setCollectPlace(null)}
        onConfirm={(amt, pay) => { collect(collectPlace, amt, pay); setCollectPlace(null); }} />
      {/* NEW BIZ sheet */}
      <NewBizSheet open={newBizOpen} onClose={() => setNewBizOpen(false)} onConfirm={(b) => { addBiz(b); setNewBizOpen(false); }} />
      {/* PLACE detail */}
      <PlaceDetailSheet place={placeDetail} onClose={() => setPlaceDetail(null)}
        onCollect={(p) => { setPlaceDetail(null); setCollectPlace(p); }}
        onSell={() => { setPlaceDetail(null); setSellOpen(true); }} />
      {/* COMPLETAR PAGO sheet */}
      <CompletarPagoSheet venta={pendingVenta} onClose={() => setPendingVenta(null)}
        onSaved={() => { setPendingVenta(null); reloadData(); toast("Pago completado", "ok"); }} />
      {/* PERFIL sheet */}
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} onLogout={onLogout} user={user} />
    </div>
  );
}
function nowHM() { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

/* ---------- Vendor Home ---------- */
function VendorHome({ me, soldToday, cashToday, myDebt, totalLoaded, sales, myPlaces, onSell, onCollect, onNewBiz, onPedido }) {
  const PAYICON = { efectivo: "cash", transfer: "transfer", qr: "qr" };
  const warnPlaces = myPlaces.filter(p => p.type === "warn");
  const debtPlaces = myPlaces.filter(p => p.debt > 0);
  return (
    <div className="anim-in">
      <div className="hero">
        <div className="hero-hi">¡Buen día,</div>
        <div className="hero-name">{me.first}! 👋</div>
      </div>
      <div className="pad-x stack gap-14">
        {/* day summary */}
        <div className="metric-grid">
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--green-soft)", color: "var(--green)" }}><Icon name="cash" size={17} /></div>
            <div className="m-label">Recaudado hoy</div>
            <div className="m-val"><span className="cur">$</span>{ARSc(cashToday)}</div>
          </div>
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--amber-soft)", color: "var(--amber-bright)" }}><Icon name="cart" size={17} /></div>
            <div className="m-label">Unidades vendidas</div>
            <div className="m-val">{soldToday}</div>
          </div>
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}><Icon name="box" size={17} /></div>
            <div className="m-label">Stock a bordo</div>
            <div className="m-val">{totalLoaded} <span className="cur">u.</span></div>
          </div>
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--red-soft)", color: "var(--red)" }}><Icon name="clock" size={17} /></div>
            <div className="m-label">A cobrar</div>
            <div className="m-val"><span className="cur">$</span>{ARSc(myDebt)}</div>
          </div>
        </div>

        {/* quick actions */}
        <div className="qa-grid">
          {[
            { ic: "cart", c: "var(--amber-soft)", cc: "var(--amber-bright)", l: "Vender", fn: onSell },
            { ic: "cash", c: "var(--green-soft)", cc: "var(--green)", l: "Cobrar", fn: () => onCollect(debtPlaces[0] || myPlaces[0]) },
            { ic: "list", c: "var(--blue-soft)", cc: "var(--blue)", l: "Tomar pedido", fn: onPedido },
            { ic: "store", c: "var(--purple-soft)", cc: "var(--purple)", l: "Nuevo negocio", fn: onNewBiz },
          ].map((q, i) => (
            <div className="qa" key={i} onClick={q.fn}>
              <div className="qa-ico" style={{ background: q.c, color: q.cc }}><Icon name={q.ic} size={20} /></div>
              <div className="qa-label">{q.l}</div>
            </div>
          ))}
        </div>

        {/* alert: por vencer */}
        {warnPlaces.length > 0 && (
          <div className="card card-pad" style={{ borderColor: "rgba(224,96,74,0.3)", background: "linear-gradient(150deg, rgba(224,96,74,0.08), var(--card) 60%)" }}>
            <div className="row gap-10">
              <div className="m-ico" style={{ background: "var(--red-soft)", color: "var(--red)", margin: 0, width: 36, height: 36 }}><Icon name="alert" size={18} /></div>
              <div className="grow">
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{warnPlaces.length} negocios con mercadería por vencer</div>
                <div style={{ fontSize: 11.5, color: "var(--txt-3)", marginTop: 2 }}>Pasá a hacer cambio antes de que venza</div>
              </div>
            </div>
            <div className="stack gap-8" style={{ marginTop: 12 }}>
              {warnPlaces.map(p => (
                <div key={p.id} className="row gap-10" style={{ padding: "9px 11px", background: "var(--bg)", borderRadius: 11 }}>
                  <Icon name="pin" size={15} style={{ color: "var(--red)" }} />
                  <div className="grow" style={{ fontSize: 12.5, fontWeight: 600 }}>{p.name}</div>
                  <span className="badge red"><span className="bd" />Vence en {p.days}d</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ventas de hoy */}
        <div>
          <div className="section-title">Ventas de hoy</div>
          <div className="card">
            {sales.length === 0 && <div className="empty"><Icon name="cart" size={40} /><div>Todavía no registraste ventas</div></div>}
            {sales.map((s, i) => (
              <div key={i}>
                <div className="mv">
                  <div className="mv-ico" style={{ background: "var(--green-soft)", color: "var(--green)" }}><Icon name={PAYICON[s.pay]} size={17} /></div>
                  <div className="grow">
                    <div className="mv-concept">{s.place}</div>
                    <div className="mv-sub">{s.time} · {s.units} u. · {s.pay === "qr" ? "MercadoPago" : s.pay === "transfer" ? "Transferencia" : "Efectivo"}</div>
                  </div>
                  <div className="mv-amt in">+{ARS(s.amount)}</div>
                </div>
                {i < sales.length - 1 && <div className="divider" style={{ marginLeft: 64 }} />}
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

/* ---------- Vendor Route (map) ---------- */
function VendorRoute({ me, places, onDetail, onNewBiz }) {
  const myDriver = DRIVERS.find(d => d.vendor === me.id);
  const [filter, setFilter] = vUseState("all");
  const shown = places.filter(p => filter === "all" || (filter === "warn" ? p.type === "warn" : filter === "debt" ? p.debt > 0 : true));
  return (
    <div className="anim-in" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ height: 300, position: "relative", flexShrink: 0 }}>
        <MiniMap places={places} drivers={myDriver ? [myDriver] : []} onSelect={onDetail} />
      </div>
      <div className="pad stack gap-12" style={{ marginTop: -18, position: "relative", zIndex: 4 }}>
        <div className="card card-pad row between" style={{ boxShadow: "0 -8px 24px rgba(0,0,0,0.3)" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Mi ruta de hoy</div>
            <div style={{ fontSize: 11.5, color: "var(--txt-3)", marginTop: 2 }}>{me.visited} de {me.route} negocios visitados</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 750, color: "var(--amber-bright)" }}>{Math.round(me.visited / me.route * 100)}%</div>
          </div>
        </div>
        <div className="pbar"><span style={{ width: (me.visited / me.route * 100) + "%" }} /></div>

        <div className="chip-row">
          {[{ id: "all", l: "Todos" }, { id: "warn", l: "Por vencer" }, { id: "debt", l: "Con deuda" }].map(c => (
            <button key={c.id} className={"chip" + (filter === c.id ? " active" : "")} onClick={() => setFilter(c.id)}>{c.l}</button>
          ))}
        </div>

        <div className="card">
          {shown.map((p, i) => (
            <div key={p.id}>
              <div className="lrow" onClick={() => onDetail(p)} style={{ cursor: "pointer" }}>
                <div className="l-ava" style={{ background: p.type === "ok" ? "var(--green-soft)" : "var(--red-soft)", color: p.type === "ok" ? "var(--green)" : "var(--red)", borderRadius: 13 }}><Icon name="store" size={19} /></div>
                <div className="grow">
                  <div className="l-name">{p.name}</div>
                  <div className="l-sub">{p.addr}</div>
                </div>
                <div className="l-right" style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                  {p.type === "warn" && <span className="badge red"><span className="bd" />Vence {p.days}d</span>}
                  {p.debt > 0 && <span className="badge amber">Debe {ARS(p.debt)}</span>}
                  {p.type === "ok" && p.debt === 0 && <span className="badge green"><span className="bd" />Al día</span>}
                </div>
              </div>
              {i < shown.length - 1 && <div className="divider" style={{ marginLeft: 69 }} />}
            </div>
          ))}
        </div>
        <button className="btn btn-ghost btn-block" onClick={onNewBiz}><Icon name="plus" size={18} />Agregar negocio</button>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

/* ---------- Vendor Sell tab (landing) ---------- */
function VendorSellTab({ onSell, sales, cashToday, soldToday, pendientes, onCompletarPago }) {
  const totalPendiente = (pendientes || []).reduce((a, v) => a + (v.monto_pendiente || 0), 0);
  return (
    <div className="anim-in pad stack gap-16">
      <div className="balance-card">
        <div className="glow" />
        <div className="bc-label">Recaudado hoy</div>
        <div className="bc-val"><span className="cur">$</span>{ARSc(cashToday)}</div>
        <div className="row gap-12" style={{ marginTop: 14, position: "relative" }}>
          <div className="badge green" style={{ fontSize: 11 }}><Icon name="cart" size={12} />{soldToday} unidades</div>
          <div className="badge amber" style={{ fontSize: 11 }}><Icon name="receipt" size={12} />{sales.length} ventas</div>
        </div>
      </div>
      <button className="btn btn-primary btn-lg btn-block" onClick={onSell}><Icon name="cart" size={20} />Registrar venta</button>

      {/* Pagos pendientes */}
      {pendientes && pendientes.length > 0 && (
        <div>
          <div className="section-title" style={{ color: "var(--amber-bright)" }}>
            Pagos pendientes · {ARS(totalPendiente)}
          </div>
          <div className="card">
            {pendientes.map((v, i) => (
              <div key={v.id}>
                <div className="mv" style={{ cursor: "pointer" }} onClick={() => onCompletarPago(v)}>
                  <div className="mv-ico" style={{ background: "var(--amber-soft)", color: "var(--amber-bright)" }}>
                    <Icon name="clock" size={17} />
                  </div>
                  <div className="grow">
                    <div className="mv-concept">{v.cliente_nombre || v.lugar || "Consumidor Final"}</div>
                    <div className="mv-sub">{v.fecha} · {v.cantidad} u.</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "var(--txt-3)" }}>Total: {ARS(v.monto_total)}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--amber-bright)" }}>Debe: {ARS(v.monto_pendiente)}</div>
                  </div>
                </div>
                {i < pendientes.length - 1 && <div className="divider" style={{ marginLeft: 64 }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="note"><Icon name="info" size={16} />Cada venta descuenta el stock y suma a tu recaudación del día.</div>

      <div>
        <div className="section-title">Ventas de hoy</div>
        <div className="card">
          {sales.length === 0 && (
            <div className="empty"><Icon name="cart" size={40} /><div>Todavía no registraste ventas</div></div>
          )}
          {sales.map((s, i) => {
            const pend = s.estado_pago && s.estado_pago !== "completo";
            return (
              <div key={s.id || i}>
                <div className="mv">
                  <div className="mv-ico" style={{ background: pend ? "var(--amber-soft)" : "var(--green-soft)", color: pend ? "var(--amber-bright)" : "var(--green)" }}>
                    <Icon name={pend ? "clock" : "check"} size={17} />
                  </div>
                  <div className="grow">
                    <div className="mv-concept">{s.cliente_nombre || s.lugar || s.place || "—"}</div>
                    <div className="mv-sub">{s.hora || s.time} · {s.cantidad || s.units} u.
                      {pend ? <span style={{ color: "var(--amber-bright)" }}> · Pendiente</span> : ""}
                    </div>
                  </div>
                  <div className="mv-amt in">+{ARS(s.monto_total || s.amount)}</div>
                </div>
                {i < sales.length - 1 && <div className="divider" style={{ marginLeft: 64 }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Vendor Stock ---------- */
function VendorStock({ stock, totalLoaded }) {
  const totalSold = stock.reduce((a, s) => a + s.sold, 0);
  const totalLoadedAll = stock.reduce((a, s) => a + s.loaded, 0);
  return (
    <div className="anim-in pad stack gap-16">
      <div className="card card-pad">
        <div className="row between">
          <div><div style={{ fontSize: 12, color: "var(--txt-2)" }}>Stock a bordo</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 2 }}>{totalLoaded} <span style={{ fontSize: 16, color: "var(--txt-3)" }}>u.</span></div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="badge green" style={{ fontSize: 11 }}>{totalSold} vendidas</div>
            <div style={{ fontSize: 11, color: "var(--txt-3)", marginTop: 6 }}>de {totalLoadedAll} cargadas</div>
          </div>
        </div>
        <div className="pbar" style={{ marginTop: 14 }}><span style={{ width: (totalSold / totalLoadedAll * 100) + "%" }} /></div>
      </div>
      <div>
        <div className="section-title">Por producto</div>
        <div className="card">
          {stock.map((s, i) => {
            const p = PROD_BY_ID[s.id] || { name: s.name || "Producto", img: s.img || "assets/alfajor-maicena.png", price: s.precio || 0 };
            const rem = (s.loaded || 0) - (s.sold || 0);
            return (
              <div key={s.id}>
                <div className="lrow">
                  <div className="l-ava" style={{ borderRadius: 12, overflow: "hidden", background: "#1a140c" }}><img src={p.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /></div>
                  <div className="grow">
                    <div className="l-name" style={{ fontSize: 13.5 }}>{p.name}</div>
                    <div className="l-sub">{s.sold || 0} vendidas · {ARS(p.price)} c/u</div>
                    <div className="pbar" style={{ marginTop: 7, height: 5 }}><span style={{ width: ((s.sold || 0) / Math.max(s.loaded || 1, 1) * 100) + "%" }} /></div>
                  </div>
                  <div className="l-right">
                    <div style={{ fontSize: 19, fontWeight: 750, color: rem < 15 ? "var(--red)" : "var(--txt)" }}>{rem}</div>
                    <div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>restantes</div>
                  </div>
                </div>
                {i < stock.length - 1 && <div className="divider" style={{ marginLeft: 69 }} />}
              </div>
            );
          })}
        </div>
      </div>
      <div className="note"><Icon name="info" size={16} />Para reponer stock, pedí una nueva carga al administrador desde la fábrica.</div>
    </div>
  );
}

Object.assign(window, { VendorApp });
