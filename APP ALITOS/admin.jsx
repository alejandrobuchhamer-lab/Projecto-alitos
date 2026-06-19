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
  const [gestionSub, setGestionSub] = aUseState(null);

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
    { id: "cuentas",   icon: "wallet",  label: "Cuentas"  },
    { id: "fabrica",   icon: "factory", label: "Fábrica"  },
    { id: "pedidos",   icon: "list",    label: "Pedidos"  },
    { id: "equipo",    icon: "users",   label: "Equipo"   },
    { id: "precios",   icon: "tag",     label: "Precios"  },
    { id: "mapa",      icon: "map",     label: "Mapa"     },
    { id: "analytics", icon: "chart",   label: "BI"       },
    { id: "gestion",   icon: "settings", label: "Gestión"  },
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
        {tab === "precios"   && <AdminPrecios />}
        {tab === "gestion"   && <AdminGestion sub={gestionSub} setSub={setGestionSub} toast={toast} />}
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

function AdminPrecios() {
  const [listas, setListas] = aUseState([]);
  const [saving, setSaving] = aUseState(null);
  const [vals, setVals]     = aUseState({});
  const toast = aUseContext(ToastCtx);

  aUseEffect(() => {
    fetchListasPrecio().then(ls => {
      setListas(ls);
      const v = {};
      ls.forEach(l => { v[l.slug] = { docena: l.precio_docena, media: l.precio_media }; });
      setVals(v);
    }).catch(() => toast("Error cargando precios", "error"));
  }, []);

  async function guardar(slug) {
    setSaving(slug);
    try {
      await actualizarListaPrecio(slug, { precioDocena: Number(vals[slug].docena), precioMedia: Number(vals[slug].media) });
      toast("Precio actualizado", "ok");
    } catch { toast("Error al guardar", "error"); }
    finally { setSaving(null); }
  }

  function set(slug, campo, val) {
    setVals(v => ({ ...v, [slug]: { ...v[slug], [campo]: val } }));
  }

  return (
    <div className="anim-in pad stack gap-16">
      <div className="section-title">Listas de precio</div>
      {listas.filter(l => l.slug !== "regalo" && l.slug !== "personalizado").map(l => (
        <div className="card card-pad" key={l.slug}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>{l.nombre}</div>
          <div className="row gap-10" style={{ marginBottom: 10 }}>
            <div className="grow">
              <div style={{ fontSize: 11, color: "var(--txt-3)", marginBottom: 4 }}>Precio x docena</div>
              <input type="number" value={vals[l.slug]?.docena ?? ""} onChange={e => set(l.slug, "docena", e.target.value)}
                style={{ width: "100%", padding: "8px 10px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--txt)", fontSize: 15, fontWeight: 700 }} />
            </div>
            <div className="grow">
              <div style={{ fontSize: 11, color: "var(--txt-3)", marginBottom: 4 }}>Precio x 6 u.</div>
              <input type="number" value={vals[l.slug]?.media ?? ""} onChange={e => set(l.slug, "media", e.target.value)}
                style={{ width: "100%", padding: "8px 10px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--txt)", fontSize: 15, fontWeight: 700 }} />
            </div>
          </div>
          <button className={"btn btn-primary btn-block btn-sm" + (saving === l.slug ? " loading" : "")}
            onClick={() => guardar(l.slug)} disabled={saving === l.slug}>
            {saving === l.slug ? "Guardando…" : "Guardar"}
          </button>
        </div>
      ))}
      <div style={{ height: 8 }} />
    </div>
  );
}

/* ===================== GESTIÓN HUB ===================== */
function AdminGestion({ sub, setSub, toast }) {
  if (sub === "ventas")   return <AdminVentasEquipo onBack={() => setSub(null)} toast={toast} />;
  if (sub === "finanzas") return <AdminFinanzasView  onBack={() => setSub(null)} toast={toast} />;
  if (sub === "alertas")  return <AdminAlertasView   onBack={() => setSub(null)} toast={toast} />;
  if (sub === "usuarios") return <AdminUsuariosView  onBack={() => setSub(null)} toast={toast} />;
  if (sub === "insumos")  return <AdminInsumosView   onBack={() => setSub(null)} toast={toast} />;

  const items = [
    { id: "ventas",   icon: "cart",     color: "var(--green)",       soft: "var(--green-soft)",   title: "Ventas del equipo",  desc: "Historial completo del equipo" },
    { id: "insumos",  icon: "box",      color: "var(--amber-bright)",soft: "var(--amber-soft)",   title: "Insumos",            desc: "Stock de materias primas y lotes" },
    { id: "finanzas", icon: "bank",     color: "var(--blue)",        soft: "var(--blue-soft)",    title: "Finanzas",           desc: "Gastos y salud financiera" },
    { id: "usuarios", icon: "users",    color: "var(--purple)",      soft: "var(--purple-soft)",  title: "Usuarios",           desc: "Crear y gestionar equipo" },
    { id: "alertas",  icon: "alert",    color: "var(--red)",         soft: "var(--red-soft)",     title: "Alertas de stock",   desc: "Notificaciones de stock bajo" },
  ];
  return (
    <div className="anim-in pad stack gap-12">
      <div className="section-title">Administración</div>
      <div className="stack gap-10">
        {items.map(item => (
          <div className="card" key={item.id} onClick={() => setSub(item.id)} style={{ cursor: "pointer" }}>
            <div className="lrow" style={{ padding: "14px 14px" }}>
              <div className="l-ava" style={{ background: item.soft, color: item.color, borderRadius: 13 }}>
                <Icon name={item.icon} size={22} />
              </div>
              <div className="grow">
                <div className="l-name">{item.title}</div>
                <div className="l-sub">{item.desc}</div>
              </div>
              <Icon name="chevR" size={18} style={{ color: "var(--txt-3)" }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 8 }} />
    </div>
  );
}

/* ── Sub-header compartido ── */
function SubHeader({ onBack, title, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "8px 8px 8px 4px", gap: 4, borderBottom: "1px solid var(--border)", background: "var(--bg)", position: "sticky", top: 0, zIndex: 10 }}>
      <button className="ab-action" onClick={onBack}><Icon name="back" size={20} /></button>
      <div style={{ fontSize: 15, fontWeight: 700, flex: 1, paddingLeft: 2 }}>{title}</div>
      {right}
    </div>
  );
}

/* ===================== VENTAS DEL EQUIPO ===================== */
function AdminVentasEquipo({ onBack, toast }) {
  const [ventas, setVentas]   = aUseState([]);
  const [loading, setLoading] = aUseState(true);
  const [filtro, setFiltro]   = aUseState("hoy");
  const [vendedorId, setVendedorId] = aUseState(null);
  const [vendors, setVendors] = aUseState([]);

  function rango(f) {
    const hoy = new Date().toISOString().slice(0, 10);
    if (f === "hoy") return { desde: hoy, hasta: hoy };
    const d = new Date(); d.setDate(d.getDate() - (f === "semana" ? 6 : 29));
    return { desde: d.toISOString().slice(0, 10), hasta: hoy };
  }

  function cargar(f, vId) {
    setLoading(true);
    fetchVentasAdmin({ ...rango(f), vendedorId: vId })
      .then(data => { setVentas(data); setLoading(false); })
      .catch(() => { toast("Error cargando ventas", "error"); setLoading(false); });
  }

  aUseEffect(() => {
    fetchVendedores().then(data => setVendors(data)).catch(() => {});
    cargar("hoy", null);
  }, []);

  function cambiarFiltro(f) { setFiltro(f); cargar(f, vendedorId); }
  function cambiarVendedor(vId) { setVendedorId(vId); cargar(filtro, vId); }

  const totalMonto = ventas.reduce((a, v) => a + (v.monto_total || 0), 0);
  const totalUnits = ventas.reduce((a, v) => a + (v.cantidad || 0), 0);
  const PAY_ICO  = { efectivo: "cash", transfer: "bank", qr: "qr" };
  const PAY_LBL  = { efectivo: "Efectivo", transfer: "Transfer.", qr: "QR/MP" };

  return (
    <div className="anim-in" style={{ display: "flex", flexDirection: "column" }}>
      <SubHeader onBack={onBack} title="Ventas del equipo" />
      <div className="pad stack gap-12">
        <div className="chip-row">
          {[["hoy","Hoy"],["semana","7 días"],["mes","30 días"]].map(([id,l]) => (
            <button key={id} className={"chip" + (filtro === id ? " active" : "")} onClick={() => cambiarFiltro(id)}>{l}</button>
          ))}
        </div>
        {vendors.length > 0 && (
          <div className="chip-row">
            <button className={"chip" + (!vendedorId ? " active" : "")} onClick={() => cambiarVendedor(null)}>Todos</button>
            {vendors.map(v => (
              <button key={v.id} className={"chip" + (vendedorId === v.id ? " active" : "")} onClick={() => cambiarVendedor(v.id)}>{v.first}</button>
            ))}
          </div>
        )}
        {!loading && (
          <div className="metric-grid">
            <div className="metric">
              <div className="m-label">Total vendido</div>
              <div className="m-val"><span className="cur">$</span>{ARSc(totalMonto)}</div>
            </div>
            <div className="metric">
              <div className="m-label">Unidades</div>
              <div className="m-val">{totalUnits} <span style={{ fontSize: 13, color: "var(--txt-3)", fontWeight: 600 }}>u.</span></div>
            </div>
          </div>
        )}
        {loading && <div className="empty" style={{ padding: 32 }}><div style={{ width: 28, height: 28, border: "3px solid var(--border)", borderTopColor: "var(--amber)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} /></div>}
        {!loading && ventas.length === 0 && <div className="empty"><Icon name="cart" size={40} /><div>Sin ventas en este período</div></div>}
        {!loading && ventas.length > 0 && (
          <div className="card">
            {ventas.map((v, i) => (
              <div key={v.id}>
                <div className="lrow" style={{ padding: "11px 12px" }}>
                  <div className="l-ava" style={{ background: "var(--green-soft)", color: "var(--green)", borderRadius: 10, width: 38, height: 38, minWidth: 38 }}>
                    <Icon name={PAY_ICO[v.pay] || "cash"} size={16} />
                  </div>
                  <div className="grow">
                    <div style={{ fontSize: 13, fontWeight: 650 }}>{v.vendedor} · {v.cantidad} u.</div>
                    <div style={{ fontSize: 11, color: "var(--txt-3)" }}>{v.fecha} · {v.cliente_nombre || v.lugar || "CF"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 750 }}>{ARS(v.monto_total)}</div>
                    <div style={{ fontSize: 10, color: "var(--txt-3)" }}>{PAY_LBL[v.pay] || v.forma_pago}</div>
                  </div>
                </div>
                {i < ventas.length - 1 && <div className="divider" style={{ marginLeft: 62 }} />}
              </div>
            ))}
          </div>
        )}
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

/* ===================== FINANZAS / GASTOS ===================== */
function AdminFinanzasView({ onBack, toast }) {
  const [gastos, setGastos]   = aUseState([]);
  const [salud, setSalud]     = aUseState(null);
  const [loading, setLoading] = aUseState(true);
  const [nuevoOpen, setNuevoOpen] = aUseState(false);
  const [concepto, setConcepto]   = aUseState("");
  const [monto, setMonto]         = aUseState("");
  const [categoria, setCategoria] = aUseState("general");
  const [saving, setSaving]       = aUseState(false);

  function cargar() {
    setLoading(true);
    Promise.all([fetchGastos(), fetchFinanzasSalud()])
      .then(([g, s]) => { setGastos(g); setSalud(s); setLoading(false); })
      .catch(() => { toast("Error cargando finanzas", "error"); setLoading(false); });
  }

  aUseEffect(() => { cargar(); }, []);

  async function guardar() {
    if (!concepto.trim() || !monto || Number(monto) <= 0) { toast("Completá concepto y monto", "warn"); return; }
    setSaving(true);
    try {
      await crearGasto({ concepto: concepto.trim(), monto: Number(monto), categoria });
      toast("Gasto registrado", "ok");
      setNuevoOpen(false); setConcepto(""); setMonto(""); setCategoria("general");
      cargar();
    } catch { toast("Error al guardar", "error"); }
    finally { setSaving(false); }
  }

  async function borrar(id) {
    try { await eliminarGasto(id); setGastos(g => g.filter(x => x.id !== id)); toast("Eliminado", "ok"); }
    catch { toast("Error", "error"); }
  }

  const CATS = ["general", "insumos", "servicios", "transporte", "personal", "otros"];

  return (
    <div className="anim-in" style={{ display: "flex", flexDirection: "column" }}>
      <SubHeader onBack={onBack} title="Finanzas"
        right={<button className="ab-action" onClick={() => setNuevoOpen(true)}><Icon name="plus" size={20} /></button>} />
      <div className="pad stack gap-14">
        {salud && (
          <div className="card card-pad">
            <div className="section-title" style={{ margin: "0 0 10px" }}>Este mes</div>
            <div className="metric-grid">
              <div className="metric">
                <div className="m-label">Ingresos</div>
                <div className="m-val" style={{ color: "var(--green)", fontSize: 18 }}>{ARS(salud.ingresos_mes || 0)}</div>
              </div>
              <div className="metric">
                <div className="m-label">Gastos</div>
                <div className="m-val" style={{ color: "var(--red)", fontSize: 18 }}>{ARS(salud.costos_mes || 0)}</div>
              </div>
              <div className="metric">
                <div className="m-label">Ganancia</div>
                <div className="m-val" style={{ fontSize: 18 }}>{ARS(salud.ganancia_neta_mes || 0)}</div>
              </div>
              <div className="metric">
                <div className="m-label">Margen</div>
                <div className="m-val" style={{ fontSize: 18 }}>{(salud.margen_mes || 0).toFixed(1)}<span className="cur">%</span></div>
              </div>
            </div>
          </div>
        )}
        {loading && <div className="empty" style={{ padding: 32 }}><div style={{ width: 28, height: 28, border: "3px solid var(--border)", borderTopColor: "var(--amber)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} /></div>}
        {!loading && (
          <div>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div className="section-title" style={{ margin: 0 }}>Gastos recientes</div>
              <button className="btn btn-primary btn-sm" onClick={() => setNuevoOpen(true)}><Icon name="plus" size={14} />Nuevo</button>
            </div>
            <div className="card">
              {gastos.length === 0 && <div className="empty"><Icon name="bank" size={36} /><div>Sin gastos registrados</div></div>}
              {gastos.slice(0, 50).map((g, i) => (
                <div key={g.id}>
                  <div className="lrow" style={{ padding: "11px 12px" }}>
                    <div className="l-ava" style={{ background: "var(--red-soft)", color: "var(--red)", borderRadius: 10, width: 36, height: 36, minWidth: 36 }}>
                      <Icon name="minus" size={16} />
                    </div>
                    <div className="grow">
                      <div style={{ fontSize: 13, fontWeight: 650 }}>{g.concepto}</div>
                      <div style={{ fontSize: 11, color: "var(--txt-3)" }}>{g.categoria} · {g.fecha ? g.fecha.slice(0, 10) : ""}</div>
                    </div>
                    <div className="row gap-8">
                      <div style={{ fontSize: 14, fontWeight: 750 }}>{ARS(g.monto)}</div>
                      <button className="ab-action" style={{ width: 28, height: 28 }} onClick={() => borrar(g.id)}>
                        <Icon name="x" size={14} style={{ color: "var(--red)" }} />
                      </button>
                    </div>
                  </div>
                  {i < Math.min(gastos.length, 50) - 1 && <div className="divider" style={{ marginLeft: 60 }} />}
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ height: 16 }} />
      </div>

      <Sheet open={nuevoOpen} onClose={() => setNuevoOpen(false)} icon="bank" title="Registrar gasto">
        <div className="stack gap-10">
          <input className="input" placeholder="Concepto (ej: Harina 50kg)" value={concepto} onChange={e => setConcepto(e.target.value)} />
          <div className="money"><span className="sgn">$</span><input className="input" type="number" placeholder="0" value={monto} onChange={e => setMonto(e.target.value)} style={{ paddingLeft: 28 }} /></div>
          <select className="select" value={categoria} onChange={e => setCategoria(e.target.value)}>
            {CATS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        <button className={"btn btn-primary btn-block" + (saving ? " loading" : "")} style={{ marginTop: 16 }} onClick={guardar} disabled={saving}>
          {saving ? "Guardando…" : "Guardar gasto"}
        </button>
      </Sheet>
    </div>
  );
}

/* ===================== ALERTAS DE STOCK ===================== */
function AdminAlertasView({ onBack, toast }) {
  const [alertas, setAlertas]   = aUseState([]);
  const [loading, setLoading]   = aUseState(true);
  const [checking, setChecking] = aUseState(false);

  function cargar() {
    setLoading(true);
    fetchAlertas().then(data => { setAlertas(data); setLoading(false); }).catch(() => setLoading(false));
  }

  aUseEffect(() => { cargar(); }, []);

  async function verificar() {
    setChecking(true);
    try { await verificarAlertas(); cargar(); toast("Alertas verificadas", "ok"); }
    catch { toast("Error al verificar", "error"); }
    finally { setChecking(false); }
  }

  async function resolver(id) {
    try { await resolverAlerta(id); setAlertas(a => a.filter(x => x.id !== id)); toast("Resuelta", "ok"); }
    catch { toast("Error", "error"); }
  }

  const PRIO = { alta: "var(--red)", media: "var(--amber-bright)", baja: "var(--blue)" };

  return (
    <div className="anim-in" style={{ display: "flex", flexDirection: "column" }}>
      <SubHeader onBack={onBack} title="Alertas de stock"
        right={<button className={"ab-action" + (checking ? " loading" : "")} onClick={verificar} disabled={checking}><Icon name="check" size={20} /></button>} />
      <div className="pad stack gap-12">
        {loading && <div className="empty" style={{ padding: 32 }}><div style={{ width: 28, height: 28, border: "3px solid var(--border)", borderTopColor: "var(--amber)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} /></div>}
        {!loading && alertas.length === 0 && (
          <div className="empty"><Icon name="check" size={44} style={{ color: "var(--green)", opacity: 1 }} /><div>Sin alertas activas</div></div>
        )}
        {!loading && alertas.length > 0 && (
          <div className="card">
            {alertas.map((a, i) => (
              <div key={a.id}>
                <div className="lrow" style={{ padding: "12px 12px" }}>
                  <div className="l-ava" style={{ background: "var(--red-soft)", color: PRIO[a.prioridad] || "var(--red)", borderRadius: 10, width: 36, height: 36, minWidth: 36 }}>
                    <Icon name="alert" size={16} />
                  </div>
                  <div className="grow">
                    <div style={{ fontSize: 12.5, fontWeight: 650, lineHeight: 1.3 }}>{a.mensaje}</div>
                    <div style={{ fontSize: 10.5, color: "var(--txt-3)", marginTop: 2 }}>{a.modulo} · {a.prioridad || "media"}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ padding: "4px 10px", fontSize: 12, flexShrink: 0 }} onClick={() => resolver(a.id)}>Resolver</button>
                </div>
                {i < alertas.length - 1 && <div className="divider" style={{ marginLeft: 60 }} />}
              </div>
            ))}
          </div>
        )}
        <button className={"btn btn-ghost btn-block" + (checking ? " loading" : "")} onClick={verificar} disabled={checking}>
          <Icon name="check" size={17} />{checking ? "Verificando…" : "Verificar alertas ahora"}
        </button>
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

/* ===================== GESTIÓN DE USUARIOS ===================== */
function AdminUsuariosView({ onBack, toast }) {
  const [users, setUsers]       = aUseState([]);
  const [loading, setLoading]   = aUseState(true);
  const [crearOpen, setCrearOpen]   = aUseState(false);
  const [pinOpen, setPinOpen]       = aUseState(false);
  const [selected, setSelected]     = aUseState(null);
  const [nombre, setNombre]         = aUseState("");
  const [username, setUsername]     = aUseState("");
  const [password, setPassword]     = aUseState("");
  const [rol, setRol]               = aUseState("vendedor");
  const [nuevoPin, setNuevoPin]     = aUseState("");
  const [saving, setSaving]         = aUseState(false);

  function cargar() {
    setLoading(true);
    fetchUsuariosAdmin().then(data => { setUsers(data); setLoading(false); }).catch(() => setLoading(false));
  }

  aUseEffect(() => { cargar(); }, []);

  async function crear() {
    if (!nombre.trim() || !username.trim() || !password) { toast("Completá todos los campos", "warn"); return; }
    setSaving(true);
    try {
      await crearUsuario({ nombre: nombre.trim(), username: username.trim(), password, rol });
      toast("Usuario creado", "ok");
      setCrearOpen(false); setNombre(""); setUsername(""); setPassword(""); setRol("vendedor");
      cargar();
    } catch(e) { toast(e.message || "Error al crear", "error"); }
    finally { setSaving(false); }
  }

  async function resetPin() {
    if (!nuevoPin || nuevoPin.length !== 6 || !/^\d+$/.test(nuevoPin)) { toast("El PIN debe tener 6 dígitos", "warn"); return; }
    setSaving(true);
    try {
      await resetPinUsuario(selected.id, nuevoPin);
      toast("PIN actualizado", "ok");
      setPinOpen(false); setNuevoPin(""); cargar();
    } catch { toast("Error al resetear PIN", "error"); }
    finally { setSaving(false); }
  }

  async function desactivar(u) {
    if (!confirm("¿Desactivar a " + u.nombre + "?")) return;
    try { await desactivarUsuario(u.id); toast("Usuario desactivado", "ok"); cargar(); }
    catch { toast("Error", "error"); }
  }

  const ROL_C = { admin: "var(--purple)", vendedor: "var(--blue)", produccion: "var(--green)" };
  const ROL_L = { admin: "Admin", vendedor: "Vendedor", produccion: "Prod." };

  return (
    <div className="anim-in" style={{ display: "flex", flexDirection: "column" }}>
      <SubHeader onBack={onBack} title="Usuarios"
        right={<button className="ab-action" onClick={() => setCrearOpen(true)}><Icon name="plus" size={20} /></button>} />
      <div className="pad stack gap-12">
        {loading && <div className="empty" style={{ padding: 32 }}><div style={{ width: 28, height: 28, border: "3px solid var(--border)", borderTopColor: "var(--amber)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} /></div>}
        {!loading && (
          <div className="stack gap-10">
            {users.map(u => (
              <div className="card" key={u.id}>
                <div className="lrow" style={{ padding: "13px 14px", cursor: "pointer" }} onClick={() => setSelected(selected?.id === u.id ? null : u)}>
                  <div style={{ width: 42, height: 42, minWidth: 42, borderRadius: "50%", background: "var(--purple-soft)", color: ROL_C[u.rol] || "var(--purple)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>
                    {u.nombre[0].toUpperCase()}
                  </div>
                  <div className="grow">
                    <div className="l-name">{u.nombre}</div>
                    <div className="l-sub">@{u.username}{u.pin_temporal ? ` · PIN: ${u.pin_temporal}` : ""}</div>
                  </div>
                  <span className="badge" style={{ background: (ROL_C[u.rol] || "var(--blue)") + "22", color: ROL_C[u.rol] || "var(--blue)" }}>
                    {ROL_L[u.rol] || u.rol}
                  </span>
                </div>
                {selected?.id === u.id && (
                  <div className="row gap-8" style={{ padding: "0 14px 14px" }}>
                    <button className="btn btn-ghost btn-sm grow" onClick={() => { setSelected(u); setNuevoPin(""); setPinOpen(true); }}>
                      <Icon name="check" size={14} />Resetear PIN
                    </button>
                    <button className="btn btn-ghost btn-sm grow" style={{ color: "var(--red)" }} onClick={() => desactivar(u)}>
                      <Icon name="x" size={14} />Desactivar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-primary btn-block" onClick={() => setCrearOpen(true)}>
          <Icon name="plus" size={18} />Crear usuario
        </button>
        <div style={{ height: 16 }} />
      </div>

      <Sheet open={crearOpen} onClose={() => setCrearOpen(false)} icon="user" title="Crear usuario">
        <div className="stack gap-10">
          <input className="input" placeholder="Nombre completo" value={nombre} onChange={e => setNombre(e.target.value)} />
          <input className="input" placeholder="Username (sin espacios)" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} />
          <input className="input" type="password" placeholder="Contraseña (mín. 6 caracteres)" value={password} onChange={e => setPassword(e.target.value)} />
          <select className="select" value={rol} onChange={e => setRol(e.target.value)}>
            <option value="vendedor">Vendedor</option>
            <option value="produccion">Producción</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <button className={"btn btn-primary btn-block" + (saving ? " loading" : "")} style={{ marginTop: 16 }} onClick={crear} disabled={saving}>
          {saving ? "Creando…" : "Crear usuario"}
        </button>
      </Sheet>

      <Sheet open={pinOpen && !!selected} onClose={() => setPinOpen(false)} icon="check" title={"Resetear PIN — " + (selected?.nombre || "")}>
        <div className="stack gap-10">
          <input className="input" type="number" placeholder="Nuevo PIN (6 dígitos)" value={nuevoPin}
            onChange={e => setNuevoPin(e.target.value.slice(0, 6))} maxLength={6} />
          <div style={{ fontSize: 12, color: "var(--txt-3)" }}>El usuario deberá cambiar su PIN al ingresar.</div>
        </div>
        <button className={"btn btn-primary btn-block" + (saving ? " loading" : "")} style={{ marginTop: 16 }} onClick={resetPin} disabled={saving}>
          {saving ? "Guardando…" : "Confirmar reseteo"}
        </button>
      </Sheet>
    </div>
  );
}

/* ===================== INSUMOS ===================== */
function AdminInsumosView({ onBack, toast }) {
  const [insumos, setInsumos]   = aUseState([]);
  const [loading, setLoading]   = aUseState(true);
  const [search, setSearch]     = aUseState("");
  const [selected, setSelected] = aUseState(null);
  const [loteOpen, setLoteOpen] = aUseState(false);
  const [ltCant, setLtCant]     = aUseState("");
  const [ltCosto, setLtCosto]   = aUseState("");
  const [ltProv, setLtProv]     = aUseState("");
  const [ltVenc, setLtVenc]     = aUseState("");
  const [saving, setSaving]     = aUseState(false);

  function cargar() {
    setLoading(true);
    fetchInsumos().then(data => { setInsumos(data); setLoading(false); }).catch(() => setLoading(false));
  }

  aUseEffect(() => { cargar(); }, []);

  const shown = search
    ? insumos.filter(i => (i.nombre || "").toLowerCase().includes(search.toLowerCase()))
    : insumos;

  function stockColor(ins) {
    if ((ins.stock_actual || 0) <= 0) return "var(--red)";
    if (ins.stock_minimo && ins.stock_actual <= ins.stock_minimo) return "var(--amber-bright)";
    return "var(--green)";
  }

  function abrirLote(ins) {
    setSelected(ins); setLtCant(""); setLtCosto(""); setLtProv(""); setLtVenc(""); setLoteOpen(true);
  }

  async function guardarLote() {
    if (!ltCant || Number(ltCant) <= 0) { toast("Ingresá una cantidad", "warn"); return; }
    setSaving(true);
    try {
      await registrarCompraInsumo(selected.id, {
        cantidad:         Number(ltCant),
        costoUnitario:    Number(ltCosto) || 0,
        proveedor:        ltProv || null,
        fechaVencimiento: ltVenc || null,
        notas:            null,
      });
      toast("Lote registrado", "ok");
      setLoteOpen(false); cargar();
    } catch { toast("Error al registrar lote", "error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="anim-in" style={{ display: "flex", flexDirection: "column" }}>
      <SubHeader onBack={onBack} title="Insumos" />
      <div className="pad stack gap-12">
        <input className="input" placeholder="Buscar insumo…" value={search} onChange={e => setSearch(e.target.value)} />
        {loading && <div className="empty" style={{ padding: 32 }}><div style={{ width: 28, height: 28, border: "3px solid var(--border)", borderTopColor: "var(--amber)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} /></div>}
        {!loading && (
          <div className="card">
            {shown.length === 0 && <div className="empty"><Icon name="box" size={36} /><div>Sin insumos</div></div>}
            {shown.map((ins, i) => (
              <div key={ins.id}>
                <div className="lrow" style={{ padding: "11px 12px" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: stockColor(ins), marginRight: 12, marginTop: 1, flexShrink: 0 }} />
                  <div className="grow">
                    <div style={{ fontSize: 13, fontWeight: 650 }}>{ins.nombre}</div>
                    <div style={{ fontSize: 11, color: "var(--txt-3)" }}>Stock: {ins.stock_actual} {ins.unidad}{ins.stock_minimo ? ` · mín. ${ins.stock_minimo}` : ""}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => abrirLote(ins)}>+ Lote</button>
                </div>
                {i < shown.length - 1 && <div className="divider" style={{ marginLeft: 34 }} />}
              </div>
            ))}
          </div>
        )}
        <div style={{ height: 16 }} />
      </div>

      <Sheet open={loteOpen && !!selected} onClose={() => setLoteOpen(false)} icon="box" title={"Nuevo lote — " + (selected?.nombre || "")}>
        <div className="stack gap-10">
          <div className="row gap-10">
            <div className="grow">
              <div className="lab">Cantidad ({selected?.unidad || "u."})</div>
              <input className="input" type="number" placeholder="0" value={ltCant} onChange={e => setLtCant(e.target.value)} />
            </div>
            <div className="grow">
              <div className="lab">Costo unitario $</div>
              <input className="input" type="number" placeholder="0" value={ltCosto} onChange={e => setLtCosto(e.target.value)} />
            </div>
          </div>
          <input className="input" placeholder="Proveedor (opcional)" value={ltProv} onChange={e => setLtProv(e.target.value)} />
          <div><div className="lab">Vencimiento</div><input className="input" type="date" value={ltVenc} onChange={e => setLtVenc(e.target.value)} /></div>
        </div>
        <button className={"btn btn-primary btn-block" + (saving ? " loading" : "")} style={{ marginTop: 16 }} onClick={guardarLote} disabled={saving}>
          {saving ? "Guardando…" : "Registrar lote"}
        </button>
      </Sheet>
    </div>
  );
}

Object.assign(window, { AdminApp });
