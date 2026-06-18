/* ===================== ALITO'S · App ADMINISTRADOR ===================== */
const { useState: aUseState, useContext: aUseContext, useMemo: aUseMemo, useEffect: aUseEffect } = React;

function AdminApp({ onLogout, user }) {
  const toast = aUseContext(ToastCtx);
  const [tab, setTab] = aUseState("inicio");
  const [accounts, setAccounts] = aUseState(() => JSON.parse(JSON.stringify(ACCOUNTS)));
  const [movements, setMovements] = aUseState([]);
  const [vendors, setVendors] = aUseState(() => VENDORS.map(v => ({ ...v })));
  const { unread } = useNotifs();

  const [places, setPlaces] = aUseState([]);
  const [entregas, setEntregas] = aUseState([]);
  const [placeDetail, setPlaceDetail] = aUseState(null);
  const [movOpen, setMovOpen] = aUseState(false);
  const [transferOpen, setTransferOpen] = aUseState(false);
  const [assignVendor, setAssignVendor] = aUseState(null);
  const [vendorDetail, setVendorDetail] = aUseState(null);
  const [notifOpen, setNotifOpen] = aUseState(false);
  const [adminSellOpen, setAdminSellOpen] = aUseState(false);
  const [adminStock, setAdminStock] = aUseState([]);
  const [profileOpen, setProfileOpen] = aUseState(false);

  const adminName = user?.nombre || user?.name || "Administrador";
  const adminInitials = adminName.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

  // SSE tiempo real
  aUseEffect(() => {
    let evtSrc = null;
    function conectarSSE() {
      evtSrc = new EventSource(API_BASE + "/api/events");
      evtSrc.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.tipo === "connected") return;
          if (d.tipo === "venta" || d.tipo === "pago") recargarCuentas();
          if (d.tipo === "stock") fetchVendedores().then(data => { if (data.length) setVendors(data); }).catch(() => {});
          const notif = sseEventToNotif(d);
          if (notif) pushNotif(notif);
        } catch(_) {}
      };
      evtSrc.onerror = () => { evtSrc.close(); setTimeout(conectarSSE, 4000); };
    }
    conectarSSE();
    return () => { if (evtSrc) evtSrc.close(); };
  }, []);

  // Cargar datos reales al montar
  aUseEffect(() => {
    fetchCuentas().then(ctas => {
      if (ctas && Object.keys(ctas).length) {
        const base = JSON.parse(JSON.stringify(ACCOUNTS));
        for (const key of Object.keys(ctas)) {
          if (base[key]) {
            base[key].balance = ctas[key].balance;
            base[key].id = ctas[key].id;
          }
        }
        setAccounts(base);
        // Movimientos de todas las cuentas
        const movs = Object.values(ctas).flatMap(c => c.movimientos || []);
        movs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        if (movs.length) setMovements(movs);
      }
    }).catch(() => {});
    fetchVendedores().then(data => { if (data.length) setVendors(data); }).catch(() => {});
    fetchNegocios().then(data => { if (data.length) setPlaces(data); }).catch(() => {});
    fetchEntregas(true).then(data => { if (data.length) setEntregas(data); }).catch(() => {});
    // Stock propio del admin para venta directa
    fetchMiStock().then(data => {
      if (data.length) { setAdminStock(data); return; }
      // Sin stock asignado: usar catálogo de productos
      fetchProductos().then(prods => {
        setAdminStock(prods.map(p => ({
          id: String(p.id), name: p.nombre, img: _guessImg(p.nombre),
          loaded: 9999, sold: 0, svId: null, productoId: p.id,
        })));
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  async function recargarAdmin() {
    recargarCuentas();
    fetchVendedores().then(data => { if (data.length) setVendors(data); }).catch(() => {});
    fetchEntregas().then(data => { if (data.length) setEntregas(data); }).catch(() => {});
    await new Promise(r => setTimeout(r, 600));
  }

  function recargarCuentas() {
    fetchCuentas().then(ctas => {
      if (!ctas) return;
      setAccounts(prev => {
        const next = { ...prev };
        for (const key of Object.keys(ctas)) {
          if (next[key]) next[key] = { ...next[key], balance: ctas[key].balance, id: ctas[key].id };
        }
        return next;
      });
      const movs = Object.values(ctas).flatMap(c => c.movimientos || []);
      movs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      if (movs.length) setMovements(movs);
    }).catch(() => {});
  }

  function openNotifs() { setNotifOpen(true); markNotifsRead(); }

  const total =(accounts.efectivo?.balance || 0) + (accounts.banco?.balance || 0) + (accounts.mp?.balance || 0);

  async function addMovement(m) {
    // m.account = "efectivo" | "banco" | "mp"
    const cuentaId = accounts[m.account]?.id;
    if (cuentaId) {
      try {
        await agregarMovimiento({
          cuentaId,
          tipo:        m.type === "in" ? "entrada" : "salida",
          monto:       m.amount,
          concepto:    m.concept,
          descripcion: m.sub || "",
        });
        recargarCuentas();
      } catch(e) {
        toast("Error al guardar movimiento", "error");
        return;
      }
    } else {
      // fallback local si no hay ID de cuenta
      setMovements(ms => [m, ...ms]);
      setAccounts(a => ({ ...a, [m.account]: { ...a[m.account], balance: a[m.account].balance + (m.type === "in" ? m.amount : -m.amount) } }));
    }
    toast(`Movimiento de ${ARS(m.amount)} registrado`, "ok");
  }
  async function transfer(from, to, amount) {
    const fromId = accounts[from]?.id;
    const toId   = accounts[to]?.id;
    if (fromId && toId) {
      try {
        await transferirCuentas({
          cuentaOrigenId:  fromId,
          cuentaDestinoId: toId,
          monto:           amount,
          concepto:        `Transferencia ${ACCOUNTS[from]?.short || from} → ${ACCOUNTS[to]?.short || to}`,
        });
        recargarCuentas();
      } catch(e) {
        toast("Error al registrar transferencia", "error");
        return;
      }
    } else {
      // fallback local
      setAccounts(a => ({ ...a,
        [from]: { ...a[from], balance: a[from].balance - amount },
        [to]:   { ...a[to],   balance: a[to].balance   + amount } }));
      const now = todayHM();
      setMovements(ms => [
        { date: now, concept: `Transferencia desde ${ACCOUNTS[from]?.short || from}`, sub: "Movimiento interno", account: to,   type: "in",  amount },
        { date: now, concept: `Transferencia a ${ACCOUNTS[to]?.short || to}`,         sub: "Movimiento interno", account: from, type: "out", amount },
        ...ms]);
    }
    toast(`${ARS(amount)} transferidos`, "ok");
  }
  async function assignStock(vendorId, totalUnits, asignaciones) {
    // asignaciones = [{productoId, cantidad, precio}] — enviado desde AssignSheet
    if (asignaciones && asignaciones.length) {
      try {
        for (const a of asignaciones) {
          if (a.cantidad > 0) {
            await asignarStock({
              vendedorId: vendorId,
              productoId: a.productoId,
              cantidad:   a.cantidad,
              precioUnitario: a.precio || null,
            });
          }
        }
      } catch(e) {
        toast("Error al asignar stock", "error");
        return;
      }
    }
    setVendors(vs => vs.map(v => v.id === vendorId ? { ...v, stockUnits: (v.stockUnits || 0) + totalUnits } : v));
    const vend = vendors.find(v => v.id === vendorId);
    toast(`${totalUnits} u. asignadas a ${vend?.first || vendorId}`, "ok");
  }

  const nav = [
    { id: "inicio",    icon: "home",    label: "Inicio"   },
    { id: "mapa",      icon: "map",     label: "Mapa"     },
    { id: "cuentas",   icon: "wallet",  label: "Cuentas"  },
    { id: "pedidos",   icon: "list",    label: "Pedidos"  },
    { id: "analytics", icon: "chart",   label: "BI"       },
    { id: "equipo",    icon: "users",   label: "Equipo"   },
    { id: "fabrica",   icon: "factory", label: "Fábrica"  },
  ];

  return (
    <div className="screen-wrap">
      <AppBar leftLogo title="Administrador" userName={adminName}
        right={<NotifBell unread={unread} onClick={openNotifs} />}
        avatar={{ color: "var(--amber)", txt: adminInitials, onClick: () => setProfileOpen(true) }} />

      <PullToRefresh key={tab} onRefresh={recargarAdmin}>
        {tab === "inicio" && <AdminHome accounts={accounts} total={total} vendors={vendors} movements={movements} places={places} entregas={entregas} adminName={adminName}
          onAssign={() => setTab("equipo")} onTransfer={() => setTransferOpen(true)} onNewMov={() => setMovOpen(true)}
          onMap={() => setTab("mapa")} onCuentas={() => setTab("cuentas")} onPedidos={() => setTab("pedidos")}
          onVentaDirecta={() => setAdminSellOpen(true)} />}
        {tab === "mapa" && <AdminMap places={places} vendors={vendors} onDetail={setPlaceDetail} />}
        {tab === "cuentas" && <AdminCuentas accounts={accounts} total={total} movements={movements} onNewMov={() => setMovOpen(true)} onTransfer={() => setTransferOpen(true)} />}
        {tab === "pedidos"   && <OrdersView heroTitle="Pedidos del equipo" heroSub="Todo lo que toma tu equipo" showBy adminMode />}
        {tab === "analytics" && <AnalyticsView />}
        {tab === "equipo"    && <AdminEquipo vendors={vendors} onAssign={setAssignVendor} onDetail={setVendorDetail} />}
        {tab === "fabrica"   && <FabricaPanel user={user} toast={toast} />}
      </PullToRefresh>

      <BotNav items={nav} value={tab} onChange={setTab} />

      <PlaceDetailSheetAdmin place={placeDetail} onClose={() => setPlaceDetail(null)} />
      <MovSheet open={movOpen} onClose={() => setMovOpen(false)} onConfirm={(m) => { addMovement(m); setMovOpen(false); }} />
      <TransferSheet open={transferOpen} accounts={accounts} onClose={() => setTransferOpen(false)} onConfirm={(f, t, a) => { transfer(f, t, a); setTransferOpen(false); }} />
      <AssignSheet vendor={assignVendor} onClose={() => setAssignVendor(null)} onConfirm={(units, asigs) => { assignStock(assignVendor.id, units, asigs); setAssignVendor(null); }} />
      <VendorDetailSheet vendor={vendorDetail} onClose={() => setVendorDetail(null)} onAssign={(v) => { setVendorDetail(null); setAssignVendor(v); }} />
      <NotifSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
      {/* Venta directa admin */}
      <SellSheet open={adminSellOpen} onClose={() => setAdminSellOpen(false)}
        stock={adminStock} places={places}
        onSaved={() => { setAdminSellOpen(false); toast("Venta registrada", "ok"); recargarCuentas(); }} />
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} onLogout={onLogout} user={user} />
    </div>
  );
}
function todayHM() { const d = new Date(); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

/* ---------- Admin Home ---------- */
function AdminHome({ accounts, total, vendors, movements, places, entregas, adminName, onAssign, onTransfer, onNewMov, onMap, onCuentas, onPedidos, onVentaDirecta }) {
  const active = vendors.filter(v => v.online).length;
  const stockCalle = vendors.reduce((a, v) => a + (v.stockUnits || 0), 0);
  const pending = entregas.reduce((a, e) => a + (e.debt || 0), 0);
  const warn = entregas.filter(e => e.type === "warn").length;
  const firstName = (adminName || "Admin").split(" ")[0];
  return (
    <div className="anim-in">
      <div className="hero">
        <div className="hero-hi">Hola, {firstName} 👋</div>
        <div className="hero-name">Resumen de hoy</div>
      </div>
      <div className="pad-x stack gap-14">
        {/* balance */}
        <div className="balance-card" onClick={onCuentas} style={{ cursor: "pointer" }}>
          <div className="glow" />
          <div className="bc-label">Saldo total disponible</div>
          <div className="bc-val"><span className="cur">$</span>{ARSc(total)}</div>
          <div className="row gap-8" style={{ marginTop: 14, position: "relative" }}>
            {Object.entries(accounts).map(([k, a]) => (
              <div key={k} className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "var(--txt-2)", fontSize: 10.5 }}>
                <span className="bd" style={{ background: a.color }} />{a.short} {ARS(a.balance)}
              </div>
            ))}
          </div>
        </div>

        {/* operation metrics */}
        <div className="metric-grid">
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}><Icon name="users" size={17} /></div>
            <div className="m-label">Vendedores activos</div>
            <div className="m-val">{active}<span style={{ fontSize: 15, color: "var(--txt-3)", fontWeight: 600 }}> / {vendors.length}</span></div>
          </div>
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--amber-soft)", color: "var(--amber-bright)" }}><Icon name="box" size={17} /></div>
            <div className="m-label">Stock en calle</div>
            <div className="m-val">{ARSc(stockCalle)} <span className="cur">u.</span></div>
          </div>
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--red-soft)", color: "var(--red)" }}><Icon name="clock" size={17} /></div>
            <div className="m-label">Cobros pendientes</div>
            <div className="m-val"><span className="cur">$</span>{ARSc(pending)}</div>
          </div>
          <div className="metric">
            <div className="m-ico" style={{ background: "var(--red-soft)", color: "var(--red)" }}><Icon name="alert" size={17} /></div>
            <div className="m-label">Por vencer</div>
            <div className="m-val">{warn} <span style={{ fontSize: 13, color: "var(--txt-3)", fontWeight: 600 }}>negocios</span></div>
          </div>
        </div>

        {/* quick actions */}
        <div className="qa-grid">
          {[
            { ic: "cart", c: "var(--green-soft)", cc: "var(--green)", l: "Venta directa", fn: onVentaDirecta },
            { ic: "box", c: "var(--amber-soft)", cc: "var(--amber-bright)", l: "Asignar stock", fn: onAssign },
            { ic: "transfer", c: "var(--blue-soft)", cc: "var(--blue)", l: "Transferir", fn: onTransfer },
            { ic: "plus", c: "var(--purple-soft)", cc: "var(--purple)", l: "Movimiento", fn: onNewMov },
          ].map((q, i) => (
            <div className="qa" key={i} onClick={q.fn}>
              <div className="qa-ico" style={{ background: q.c, color: q.cc }}><Icon name={q.ic} size={20} /></div>
              <div className="qa-label">{q.l}</div>
            </div>
          ))}
        </div>

        {/* team mini */}
        <div>
          <div className="row between" style={{ margin: "4px 2px 10px" }}>
            <div className="section-title" style={{ margin: 0 }}>Equipo en calle</div>
            <button className="link" onClick={onAssign}>Ver todo</button>
          </div>
          <div className="card">
            {vendors.map((v, i) => (
              <div key={v.id}>
                <div className="lrow">
                  <Ava v={v} size={42} circ />
                  <div className="grow">
                    <div className="l-name"><span className={"status-dot " + (v.online ? "on" : "off")} />{v.name}</div>
                    <div className="l-sub">{v.role} · {v.stockUnits} u. a bordo</div>
                  </div>
                  <div className="l-right">
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{v.sales ? ARS(v.sales) : "—"}</div>
                    <div style={{ fontSize: 10.5, color: "var(--txt-3)" }}>ventas hoy</div>
                  </div>
                </div>
                {i < vendors.length - 1 && <div className="divider" style={{ marginLeft: 69 }} />}
              </div>
            ))}
          </div>
        </div>

        {/* recent movements */}
        <div>
          <div className="row between" style={{ margin: "4px 2px 10px" }}>
            <div className="section-title" style={{ margin: 0 }}>Últimos movimientos</div>
            <button className="link" onClick={onCuentas}>Ver caja</button>
          </div>
          <div className="card">
            {movements.slice(0, 4).map((m, i) => <MovRow key={i} m={m} last={i === 3} />)}
          </div>
        </div>
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

function MovRow({ m, last }) {
  const a = ACCOUNTS[m.account] || { short: m.account || "Cuenta" };
  return (
    <div>
      <div className="mv">
        <div className="mv-ico" style={{ background: m.type === "in" ? "var(--green-soft)" : "var(--red-soft)", color: m.type === "in" ? "var(--green)" : "var(--red)" }}>
          <Icon name={m.type === "in" ? "download" : "send"} size={16} />
        </div>
        <div className="grow">
          <div className="mv-concept">{m.concept}</div>
          <div className="mv-sub">{m.date} · {a.short}</div>
        </div>
        <div className={"mv-amt " + m.type}>{m.type === "in" ? "+" : "−"}{ARS(m.amount)}</div>
      </div>
      {!last && <div className="divider" style={{ marginLeft: 64 }} />}
    </div>
  );
}

/* ---------- Admin Map ---------- */
function AdminMap({ places, vendors, onDetail }) {
  const [filter, setFilter] = aUseState("all");
  const shown = places.filter(p => filter === "all" || (filter === "warn" ? p.type === "warn" : p.debt > 0));
  const activeVendors = vendors.filter(v => v.online);
  const drivers = activeVendors.map((v, i) => ({ vendor: v.id, x: 30 + i * 15, y: 30 + i * 20 }));
  const vendorById = Object.fromEntries(vendors.map(v => [v.id, v]));
  const warnCount = places.filter(p => p.type === "warn").length;
  return (
    <div className="anim-in" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ height: 340, flexShrink: 0, position: "relative" }}>
        <MiniMap places={places} drivers={drivers} onSelect={onDetail} onSelectDriver={(d) => onDetail({ ...(vendorById[d.vendor] || {}), isDriver: true })} />
      </div>
      <div className="pad stack gap-12" style={{ marginTop: -18, position: "relative", zIndex: 4 }}>
        <div className="card card-pad" style={{ boxShadow: "0 -8px 24px rgba(0,0,0,0.3)" }}>
          <div className="row between">
            <div className="row gap-8"><span className={"status-dot " + (activeVendors.length ? "on" : "off")} /><span style={{ fontSize: 13, fontWeight: 700 }}>{activeVendors.length} repartidor{activeVendors.length !== 1 ? "es" : ""} en vivo</span></div>
            <span className="badge amber">{warnCount} por vencer</span>
          </div>
        </div>
        <div className="chip-row">
          {[{ id: "all", l: "Todos los negocios" }, { id: "warn", l: "Por vencer" }, { id: "debt", l: "Con deuda" }].map(c => (
            <button key={c.id} className={"chip" + (filter === c.id ? " active" : "")} onClick={() => setFilter(c.id)}>{c.l}</button>
          ))}
        </div>
        <div className="card">
          {shown.length === 0 && <div className="empty"><Icon name="store" size={40} /><div>Sin negocios cargados</div></div>}
          {shown.map((p, i) => (
            <div key={p.id}>
              <div className="lrow" onClick={() => onDetail(p)} style={{ cursor: "pointer" }}>
                <div className="l-ava" style={{ background: p.type === "ok" ? "var(--green-soft)" : "var(--red-soft)", color: p.type === "ok" ? "var(--green)" : "var(--red)", borderRadius: 13 }}><Icon name="store" size={19} /></div>
                <div className="grow">
                  <div className="l-name">{p.name}</div>
                  <div className="l-sub">{p.addr || "Sin dirección"}{p.debt > 0 ? ` · Debe ${ARS(p.debt)}` : ""}</div>
                </div>
                <Icon name="chevR" size={18} style={{ color: "var(--txt-3)" }} />
              </div>
              {i < shown.length - 1 && <div className="divider" style={{ marginLeft: 69 }} />}
            </div>
          ))}
        </div>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

/* ---------- Admin Cuentas ---------- */
function AdminCuentas({ accounts, total, movements, onNewMov, onTransfer }) {
  const [filter, setFilter] = aUseState("all");
  const shown = movements.filter(m => filter === "all" || m.account === filter);
  return (
    <div className="anim-in pad stack gap-16" style={{ position: "relative" }}>
      <div className="balance-card">
        <div className="glow" />
        <div className="bc-label">Saldo total disponible</div>
        <div className="bc-val"><span className="cur">$</span>{ARSc(total)}</div>
      </div>
      <div className="stack gap-10">
        {Object.entries(accounts).map(([k, a]) => (
          <div className="card" key={k}>
            <div className="acct-mini">
              <div className="am-ico" style={{ background: a.soft }}>{a.emoji}</div>
              <div className="grow"><div className="am-name">{a.name}</div><div className="am-tag">{k === "efectivo" ? "Caja física" : k === "banco" ? "Cta. Galicia ····4821" : "QR · alitos.fabrica"}</div></div>
              <div className="am-val">{ARS(a.balance)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="row gap-10">
        <button className="btn btn-primary grow" onClick={onNewMov}><Icon name="plus" size={18} />Movimiento</button>
        <button className="btn btn-ghost grow" onClick={onTransfer}><Icon name="transfer" size={18} />Transferir</button>
      </div>
      <div>
        <div className="row between" style={{ margin: "4px 2px 10px" }}>
          <div className="section-title" style={{ margin: 0 }}>Historial</div>
          <button className="link" onClick={() => exportCSV(shown)}><Icon name="download" size={13} style={{ marginRight: 4, verticalAlign: -2 }} />CSV</button>
        </div>
        <div className="chip-row" style={{ marginBottom: 10 }}>
          {[{ id: "all", l: "Todas" }, { id: "efectivo", l: "💵 Efectivo" }, { id: "banco", l: "🏦 Banco" }, { id: "mp", l: "📱 MercadoPago" }].map(c => (
            <button key={c.id} className={"chip" + (filter === c.id ? " active" : "")} onClick={() => setFilter(c.id)}>{c.l}</button>
          ))}
        </div>
        <div className="card">
          {shown.length === 0 && <div className="empty"><Icon name="wallet" size={40} /><div>Sin movimientos</div></div>}
          {shown.map((m, i) => <MovRow key={i} m={m} last={i === shown.length - 1} />)}
        </div>
      </div>
      <div style={{ height: 8 }} />
    </div>
  );
}
function exportCSV(rows) {
  const head = ["Fecha", "Concepto", "Detalle", "Cuenta", "Tipo", "Monto"];
  const csv = [head.join(",")].concat(rows.map(m => [m.date, `"${m.concept}"`, `"${m.sub}"`, ACCOUNTS[m.account].name, m.type === "in" ? "Entrada" : "Salida", m.amount].join(","))).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "alitos-caja.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Admin Equipo ---------- */
function AdminEquipo({ vendors, onAssign, onDetail }) {
  const best = [...vendors].sort((a, b) => b.sales - a.sales);
  const maxSales = Math.max(...vendors.map(v => v.sales), 1);
  return (
    <div className="anim-in pad stack gap-16">
      <div>
        <div className="section-title">Rendimiento de hoy</div>
        <div className="card card-pad stack gap-14">
          {best.map((v, idx) => (
            <div key={v.id} className="row gap-12">
              <div style={{ width: 20, textAlign: "center", fontWeight: 800, color: idx === 0 ? "var(--amber-bright)" : "var(--txt-3)", fontSize: 14 }}>{idx + 1}</div>
              <Ava v={v} size={38} circ />
              <div className="grow">
                <div className="row between"><div style={{ fontSize: 13.5, fontWeight: 650 }}>{v.first}</div><div style={{ fontSize: 13.5, fontWeight: 750 }}>{ARS(v.sales)}</div></div>
                <div className="pbar" style={{ marginTop: 7 }}><span style={{ width: (v.sales / maxSales * 100) + "%" }} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="section-title">Vendedores</div>
        <div className="stack gap-10">
          {vendors.map(v => (
            <div className="card" key={v.id}>
              <div className="lrow" onClick={() => onDetail(v)} style={{ cursor: "pointer" }}>
                <Ava v={v} size={46} circ />
                <div className="grow">
                  <div className="l-name"><span className={"status-dot " + (v.online ? "on" : "off")} />{v.name}</div>
                  <div className="l-sub">{v.role} · {v.online ? "En línea" : "Desconectado"}</div>
                </div>
                <span className={"badge " + (v.roleTag === "rep" ? "blue" : "purple")}>{v.roleTag === "rep" ? "Reparto" : "Pedidos"}</span>
              </div>
              <div className="divider" />
              <div className="row" style={{ padding: "12px 14px", gap: 0 }}>
                {[{ k: "Stock", val: v.stockUnits + " u." }, { k: "Ventas hoy", val: v.sales ? ARS(v.sales) : "—" }, { k: "Pendiente", val: v.pending ? ARS(v.pending) : "$0", c: v.pending ? "var(--red)" : "var(--txt)" }].map((s, i) => (
                  <div key={i} style={{ flex: 1, textAlign: i === 0 ? "left" : "center", borderLeft: i ? "1px solid var(--border)" : "none" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: s.c || "var(--txt)" }}>{s.val}</div>
                    <div style={{ fontSize: 10.5, color: "var(--txt-3)", marginTop: 2 }}>{s.k}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "0 14px 14px" }}>
                <button className="btn btn-ghost btn-block btn-sm" onClick={() => onAssign(v)}><Icon name="box" size={16} />Asignar stock</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 8 }} />
    </div>
  );
}

Object.assign(window, { AdminApp });
