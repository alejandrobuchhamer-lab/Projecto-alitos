/* ===================== ALITO'S · API client =====================
   Todas las llamadas al backend FastAPI (http://localhost:8000).
   Transforma campos del backend al formato que espera la app.
   Auth: JWT Bearer token — cifrado en Android Keystore (SecureStoragePlugin)
         con fallback a localStorage en el navegador.
================================================================ */

// URL del VPS de producción
const RAILWAY_URL = "http://76.13.160.217";

// Capacitor 6 Android: sirve desde http://localhost sin puerto (puerto vacío = 80)
// Desarrollo local: http://localhost:5500
const _isNative = typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();
const _proto = window.location.protocol;
const _host  = window.location.hostname;
const _port  = window.location.port;
const API_BASE = (_isNative || _proto === "capacitor:" || _proto === "ionic:" || (_host === "localhost" && !_port))
  ? RAILWAY_URL
  : (_host === "localhost" || _host === "127.0.0.1")
    ? "http://localhost:8000"
    : "http://" + _host + ":8000";
const TOKEN_KEY   = "alitos_token";

// ── Secure storage (Android Keystore en nativo, localStorage en web) ──
// El plugin "capacitor-secure-storage-plugin" cifra con Android Keystore.
// Si no está disponible (web / APK sin plugin), usa localStorage como fallback.
const _SSP = () => _isNative && window?.Capacitor?.Plugins?.SecureStoragePlugin;

// Cache en memoria — evita llamadas async en cada render
let _memToken = null;
let _memUser  = null;

// Llama una vez al arrancar la app para cargar token/usuario desde storage seguro.
async function _initStorage() {
  const ssp = _SSP();
  if (ssp) {
    // Migrar valores viejos de localStorage a Keystore (una sola vez)
    const oldTok = localStorage.getItem(TOKEN_KEY);
    const oldUsr = localStorage.getItem("alitos_remember");
    if (oldTok) {
      await ssp.set({ key: TOKEN_KEY, value: oldTok }).catch(() => {});
      localStorage.removeItem(TOKEN_KEY);
      _memToken = oldTok;
    } else {
      _memToken = await ssp.get({ key: TOKEN_KEY }).then(r => r.value).catch(() => null);
    }
    if (oldUsr) {
      await ssp.set({ key: "alitos_remember", value: oldUsr }).catch(() => {});
      localStorage.removeItem("alitos_remember");
      try { _memUser = JSON.parse(oldUsr); } catch { _memUser = null; }
    } else {
      const raw = await ssp.get({ key: "alitos_remember" }).then(r => r.value).catch(() => null);
      try { _memUser = raw ? JSON.parse(raw) : null; } catch { _memUser = null; }
    }
  } else {
    _memToken = localStorage.getItem(TOKEN_KEY);
    try { _memUser = JSON.parse(localStorage.getItem("alitos_remember")); } catch { _memUser = null; }
  }
}

// Promise que Root espera antes de renderizar
window._storageReady = _initStorage();

// ── Token helpers (sincrónicos — usan cache en memoria) ───────────
function getToken()   { return _memToken; }
function setToken(t)  {
  _memToken = t;
  const ssp = _SSP();
  if (ssp) { ssp.set({ key: TOKEN_KEY, value: t }).catch(() => {}); localStorage.removeItem(TOKEN_KEY); }
  else      { localStorage.setItem(TOKEN_KEY, t); }
}
function clearToken() {
  _memToken = null;
  const ssp = _SSP();
  if (ssp) { ssp.remove({ key: TOKEN_KEY }).catch(() => {}); }
  localStorage.removeItem(TOKEN_KEY);
}

// ── Fetch base ────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(API_BASE + path, { ...opts, headers });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(err || `HTTP ${res.status}`);
  }
  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

function apiGet(path)        { return apiFetch(path); }
function apiPost(path, body) { return apiFetch(path, { method: "POST", body: JSON.stringify(body) }); }
function apiPut(path, body)  { return apiFetch(path, { method: "PUT",  body: JSON.stringify(body) }); }

// ── Auth ──────────────────────────────────────────────────────
async function fetchUsuarios() {
  const data = await apiGet("/api/mobile/usuarios");
  // Colores y avatares por rol (el backend no los tiene)
  const COLORS = ["#c47820", "#2e7d32", "#1565c0", "#6a1b9a", "#ad1457"];
  return data.map((u, i) => ({
    ...u,
    avatar: u.first[0].toUpperCase(),
    color:  COLORS[i % COLORS.length],
    sub:    u.roleLabel,
    icon:   u.rol === "admin" ? "shield" : u.rol === "vendedor" ? "truck" : "factory",
    iconColor: "#c47820",
    soft:   "#c4782022",
  }));
}

async function loginUser(username, password) {
  const data = await apiPost("/api/mobile/login", { username, password });
  setToken(data.access_token);
  return data; // incluye must_change_password
}

function saveRememberedUser(userData) {
  _memUser = userData;
  const val = JSON.stringify(userData);
  const ssp = _SSP();
  if (ssp) { ssp.set({ key: "alitos_remember", value: val }).catch(() => {}); localStorage.removeItem("alitos_remember"); }
  else      { localStorage.setItem("alitos_remember", val); }
}
function getRememberedUser()  { return _memUser; }
function clearRememberedUser() {
  _memUser = null;
  const ssp = _SSP();
  if (ssp) { ssp.remove({ key: "alitos_remember" }).catch(() => {}); }
  localStorage.removeItem("alitos_remember");
}

function logoutUser() { clearToken(); clearRememberedUser(); }

function isLoggedIn() { return !!getToken(); }

async function checkBiometricAvailable() {
  const plugin = window?.Capacitor?.Plugins?.BiometricAuth;
  if (!plugin) return false;
  try {
    const check = await plugin.checkBiometry();
    return !!check.isAvailable;
  } catch { return false; }
}

async function triggerBiometric(reason) {
  const plugin = window?.Capacitor?.Plugins?.BiometricAuth;
  if (!plugin) throw new Error("no-biometry");
  try {
    const check = await plugin.checkBiometry();
    if (!check.isAvailable) throw new Error("no-biometry");
  } catch(e) {
    throw new Error("no-biometry");
  }
  await plugin.authenticate({
    reason: reason || "Verificá tu identidad para ingresar a Alito's",
    cancelTitle: "Cancelar",
    androidTitle: "Alito's",
    androidSubtitle: "Confirmá tu identidad",
    allowDeviceCredential: false,
  });
}

// ── Vendedores ────────────────────────────────────────────────
async function fetchVendedores() {
  const data = await apiGet("/vendedores/api/vendedores");
  return data.map(v => ({
    id:         v.id,
    name:       v.nombre,
    first:      v.nombre.split(" ")[0],
    role:       v.rol,
    roleTag:    v.rol === "admin" ? "Admin" : "Repartidor",
    online:     v.online || false,
    stockUnits: v.stock_total || 0,
    sales:      0,
    pending:    0,
    visited:    0,
    ultimaActividad: v.ultima_actividad || null,
    avatar:     v.nombre[0],
    color:      "#c47820",
    route:      [],
  }));
}

// ── Stock vendedor ────────────────────────────────────────────
const _IMG_MAP = {
  maicena: "assets/alfajor-maicena.png",
  chocolate: "assets/alfajor-choco.png",
  choco: "assets/alfajor-choco.png",
  dulce: "assets/alfajor-dulce.png",
  triple: "assets/alfajor-triple.png",
  conitos: "assets/alfajor-conitos.png",
};
function _guessImg(nombre) {
  const n = (nombre || "").toLowerCase();
  for (const [k, v] of Object.entries(_IMG_MAP)) { if (n.includes(k)) return v; }
  return "assets/alfajor-maicena.png";
}

async function fetchMiStock() {
  const data = await apiGet("/vendedores/api/stock");
  return data.map(s => ({
    id:         String(s.producto_id),
    name:       s.producto,
    img:        _guessImg(s.producto),
    loaded:     s.cantidad_asignada || 0,
    sold:       (s.cantidad_asignada || 0) - (s.cantidad_disponible || 0),
    precio:     s.precio_unitario || 0,
    svId:       s.id,
    productoId: s.producto_id,
  }));
}

// ── Ventas del día ────────────────────────────────────────────
async function fetchMisVentas() {
  const data = await apiGet("/vendedores/api/mis-ventas");
  return data.map(v => ({
    id:              v.id,
    time:            v.hora,
    hora:            v.hora,
    place:           v.lugar || v.cliente_nombre || "—",
    lugar:           v.lugar || "",
    units:           v.cantidad,
    cantidad:        v.cantidad,
    amount:          v.monto_total,
    monto_total:     v.monto_total,
    pay:             v.forma_pago === "qr" ? "qr" : v.forma_pago === "transferencia" ? "transfer" : "efectivo",
    forma_pago:      v.forma_pago,
    producto:        v.producto,
    productoId:      v.producto_id,
    estado_pago:     v.estado_pago || "completo",
    monto_pendiente: v.monto_pendiente || 0,
    cliente_nombre:  v.cliente_nombre || "",
    tipo_cliente:    v.tipo_cliente || "consumidor_final",
    ganancia_bruta:  v.ganancia_bruta || 0,
  }));
}

async function fetchResumen() {
  return apiGet("/vendedores/api/resumen-vendedor");
}

// ── Registrar venta directa ───────────────────────────────────
async function registrarVenta({
  svId, productoId, cantidad, precio, lugar,
  tipoCliente, clienteId, clienteNombre,
  pagos, formaPago, estadoPago, montoPendiente,
  descuentoPct, descuentoMonto, montoOriginal,
}) {
  return apiPost("/vendedores/api/venta-directa", {
    stock_vendedor_id: svId || null,
    producto_id:       productoId,
    cantidad,
    precio_unitario:   precio,
    lugar:             lugar || null,
    tipo_cliente:      tipoCliente || "consumidor_final",
    cliente_id:        clienteId || null,
    cliente_nombre:    clienteNombre || null,
    pagos:             pagos || [],
    forma_pago:        formaPago || "efectivo",
    estado_pago:       estadoPago || "completo",
    monto_pendiente:   montoPendiente || 0,
    descuento_pct:     descuentoPct || 0,
    descuento_monto:   descuentoMonto || 0,
    monto_original:    montoOriginal || (cantidad * precio),
  });
}

// ── Clientes ──────────────────────────────────────────────────
async function fetchClientes() {
  const data = await apiGet("/clientes/api");
  return data.map(c => ({
    id:       c.id,
    nombre:   c.nombre_completo || c.nombre,
    empresa:  c.empresa || null,
    telefono: c.telefono || null,
  }));
}

async function crearCliente({ nombre, apellido, telefono, empresa, direccion }) {
  return apiPost("/clientes/api", { nombre, apellido, telefono, empresa, direccion });
}

// ── Ventas pendientes de cobro ────────────────────────────────
async function fetchVentasPendientes() {
  return apiGet("/vendedores/api/ventas-pendientes");
}

async function completarPago(ventaId, { formaPago, monto }) {
  return apiPut("/vendedores/api/ventas/" + ventaId + "/completar-pago", {
    forma_pago: formaPago || "efectivo",
    monto:      monto || 0,
  });
}

// ── Negocios (lugares de entrega) ─────────────────────────────
async function fetchNegocios() {
  const data = await apiGet("/vendedores/api/negocios");
  return data.map(n => ({
    id:      n.id,
    name:    n.nombre,
    addr:    n.direccion || "",
    prod:    "alfajor",
    qty:     0,
    exp:     null,
    days:    null,
    vendor:  null,
    type:    "ok",
    x:       n.lng || 0,
    y:       n.lat || 0,
    debt:    0,
    foto:    n.foto || null,
    contacto: n.contacto || null,
    telefono: n.telefono || null,
  }));
}

async function fetchEntregas(soloActivas = false) {
  const data = await apiGet("/vendedores/api/entregas" + (soloActivas ? "?activas=true" : ""));
  return data.map(e => ({
    id:         e.id,
    negocioId:  e.negocio_id,
    place:      e.negocio || "—",
    units:      e.cantidad || 0,
    debt:       (!e.cobrado && !e.retirado) ? (e.precio_unitario || 0) * (e.cantidad || 0) : 0,
    exp:        e.vencimiento || null,
    days:       e.dias_restantes,
    type:       (e.dias_restantes !== null && e.dias_restantes <= 3) ? "warn" : "ok",
    cobrado:    e.cobrado,
    retirado:   e.retirado,
    vendedor:   e.vendedor,
    vendedorId: e.vendedor_id,
    producto:   e.producto,
    alerta:     e.alerta_vencimiento || false,
  }));
}

// ── Cuentas financieras ───────────────────────────────────────
function _cuentaKey(nombre, tipo) {
  const n = (nombre || "").toLowerCase();
  const t = (tipo   || "").toLowerCase();
  if (n.includes("efectivo") || t === "efectivo") return "efectivo";
  if (n.includes("banco") || n.includes("transfer") || t === "banco") return "banco";
  if (n.includes("mercado") || n.includes("mp") || t === "mercadopago") return "mp";
  return n.replace(/\s+/g, "_").slice(0, 20) || "otra";
}

async function fetchCuentas() {
  const data = await apiGet("/cuentas/api/cuentas");
  const map = {};
  for (const c of data) {
    const key = _cuentaKey(c.nombre, c.tipo);
    map[key] = {
      id:       c.id,
      name:     c.nombre,
      short:    c.nombre.slice(0, 3).toUpperCase(),
      balance:  c.saldo || 0,
      movimientos: (c.movimientos || []).map(m => ({
        date:    m.fecha ? m.fecha.slice(0, 16) : "",
        concept: m.concepto || "Movimiento",
        sub:     m.descripcion || "",
        account: key,
        type:    m.tipo === "entrada" ? "in" : "out",
        amount:  m.monto,
      })),
    };
  }
  return map;
}

async function agregarMovimiento({ cuentaId, tipo, monto, concepto, referencia }) {
  return apiPost("/cuentas/api/movimientos", {
    cuenta_id: cuentaId,
    tipo,
    monto,
    concepto,
    referencia: referencia || null,
  });
}

// ── Producción ────────────────────────────────────────────────
async function fetchEtapasProduccion() {
  const data = await apiGet("/produccion/api/etapas");
  const STAGE_IDX = { masa: 0, tapas: 1, armado: 2 };
  return data.map(p => ({
    id:       p.id,
    tipo:     p.tipo,
    prod:     p.producto,
    qty:      p.cantidad,
    unidad:   p.unidad,
    stage:    STAGE_IDX[p.tipo] !== undefined ? STAGE_IDX[p.tipo] : 0,
    progress: Math.round(((STAGE_IDX[p.tipo] || 0) / 3) * 100),
    etapa:    p.etapa_label,
    operario: p.operario,
  }));
}

// ── Ping online ───────────────────────────────────────────────
function pingOnline() {
  apiPost("/vendedores/api/ping", {}).catch(() => {});
}

// ── Cobrar entrega ────────────────────────────────────────────
async function cobrarEntrega(entregaId, formaPago) {
  return apiPut("/vendedores/api/entregas/" + entregaId + "/cobrar", {
    forma_pago: formaPago || "efectivo",
  });
}

// ── Asignar stock a vendedor ──────────────────────────────────
async function asignarStock({ vendedorId, productoId, cantidad, precioUnitario }) {
  return apiPost("/vendedores/api/stock", {
    vendedor_id:    vendedorId,
    producto_id:    productoId,
    cantidad:       cantidad,
    precio_unitario: precioUnitario || null,
  });
}

// ── Transferencia entre cuentas ───────────────────────────────
async function transferirCuentas({ cuentaOrigenId, cuentaDestinoId, monto, concepto }) {
  return apiPost("/cuentas/api/movimientos", {
    cuenta_id:          cuentaOrigenId,
    cuenta_destino_id:  cuentaDestinoId,
    tipo:               "transferencia",
    monto:              monto,
    concepto:           concepto || "Transferencia interna",
  });
}

// ── Pedidos ───────────────────────────────────────────────────
async function fetchPedidos(estado) {
  const qs = estado ? "?estado=" + estado : "";
  return apiGet("/pedidos/api" + qs);
}

async function crearPedido({
  place, negocioId, units, amount, productos, notas,
  tipoCliente, clienteId, clienteNombre, clienteLocalidad,
  fechaEntrega, formaPago, descuentoPct, montoLista, listaPrecio,
}) {
  return apiPost("/pedidos/api", {
    place,
    negocioId:         negocioId || null,
    units:             units || 0,
    amount:            amount || 0,
    productos:         productos || [],
    notas:             notas || "",
    tipo_cliente:      tipoCliente || "cliente",
    cliente_id:        clienteId || null,
    cliente_nombre:    clienteNombre || "",
    cliente_localidad: clienteLocalidad || "",
    fecha_entrega:     fechaEntrega || null,
    forma_pago:        formaPago || null,
    descuento_pct:     descuentoPct || 0,
    monto_lista:       montoLista || amount || 0,
    lista_precio:      listaPrecio || "cliente",
  });
}

async function actualizarPedidoEstado(pedidoId, estado) {
  return apiPut("/pedidos/api/" + pedidoId + "/estado", { estado });
}

async function fetchListasPrecio() {
  return apiGet("/pedidos/api/precios");
}

async function actualizarListaPrecio(slug, { precioDocena, precioMedia }) {
  return apiPut("/pedidos/api/precios/" + slug, { precio_docena: precioDocena, precio_media: precioMedia });
}

async function buscarClientesPedido(q) {
  return apiGet("/pedidos/api/clientes" + (q ? "?q=" + encodeURIComponent(q) : ""));
}

async function asignarPedido(pedidoId, { vendedorId, vendedorNombre }) {
  return apiPut("/pedidos/api/" + pedidoId + "/asignar", {
    vendedor_id: vendedorId || null,
    vendedor_nombre: vendedorNombre || "",
  });
}

async function entregarPedido(pedidoId, { formaCobro, montoCobrado, montoDeuda }) {
  return apiPut("/pedidos/api/" + pedidoId + "/entregar", {
    forma_cobro:   formaCobro || "efectivo",
    monto_cobrado: montoCobrado || 0,
    monto_deuda:   montoDeuda || 0,
  });
}

// Aliases usados por admin.jsx y orders.jsx
const fetchPedidosAdmin = fetchPedidos;
const actualizarPedido  = actualizarPedidoEstado;
const fetchEventos      = () => Promise.resolve([]);

// ── Productos terminados (fábrica) ────────────────────────────
async function fetchProductos() {
  return apiGet("/productos/api");
}

// ── Analytics móvil ───────────────────────────────────────────
async function fetchAnalytics(dias) {
  const qs = dias ? "?dias=" + dias : "";
  return apiGet("/api/dashboard/analytics-mobile" + qs);
}

// ── Producción: avanzar etapa desde móvil ─────────────────────
async function avanzarEtapaProduccion(produccionId, data = {}) {
  return apiPost("/produccion/api/" + produccionId + "/avanzar-etapa-mobile", data || {});
}

// ── Stock de alfajores terminados (fábrica) ───────────────────
async function fetchStockTerminado() {
  return apiGet("/produccion/api/stock-terminado");
}

// ── Web Push: suscripción automática post-login ───────────────
async function _setupPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    // Obtener clave pública VAPID
    const { publicKey } = await apiGet("/api/push/vapid-key");
    if (!publicKey) return;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;
    const reg = await navigator.serviceWorker.ready;
    // Verificar si ya hay suscripción activa
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const raw = publicKey.replace(/-/g, "+").replace(/_/g, "/");
      const pad = raw + "=".repeat((4 - raw.length % 4) % 4);
      const bin = atob(pad);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: arr,
      });
    }
    const s = sub.toJSON();
    await apiPost("/api/push/subscribe", {
      endpoint: s.endpoint,
      keys: { p256dh: s.keys.p256dh, auth: s.keys.auth },
    });
  } catch(e) {}
}

async function loginAndSetupPush(username, password) {
  const data = await loginUser(username, password);
  _setupPushSubscription();
  return data;
}

// ── Insumos (materias primas) ─────────────────────────────────────
async function fetchInsumos() {
  return apiGet("/insumos/api");
}

// ── Recetas activas ────────────────────────────────────────────────
async function fetchRecetasActivas() {
  return apiGet("/recetas/api");
}

// ── Lotes disponibles para producción ─────────────────────────────
async function fetchLotesMasaDisp() {
  return apiGet("/produccion/api/lotes/masa");
}

async function fetchLotesTapasDisp() {
  return apiGet("/produccion/api/lotes/tapas");
}

// ── Iniciar producción desde móvil ────────────────────────────────
async function iniciarProduccion({ tipo, recetaId, cantidadRecetas, operario, notas, pesoMasaG, pesoTapaObjetivoG, pesoTapaMinG, pesoTapaMaxG, loteOrigenId, cantidadTapasAUsar }) {
  return apiPost("/produccion/api/iniciar", {
    tipo_produccion:       tipo,
    receta_version_id:     recetaId || null,
    cantidad_recetas:      cantidadRecetas || 1,
    operario:              operario || null,
    notas:                 notas || null,
    peso_masa_total_g:     pesoMasaG || null,
    peso_tapa_objetivo_g:  pesoTapaObjetivoG || null,
    peso_tapa_min_g:       pesoTapaMinG || null,
    peso_tapa_max_g:       pesoTapaMaxG || null,
    lote_origen_id:        loteOrigenId || null,
    cantidad_tapas_a_usar: cantidadTapasAUsar || null,
  });
}

// ── Registrar ingreso de compra ────────────────────────────────────
async function registrarCompraInsumo(insumoId, {
  cantidad, costoUnitario, proveedor, fechaVencimiento, notas, numeroLote,
  tipoPresentacion, cantidadBultos, unidadesPorBulto, precioPorBulto,
}) {
  const numLote = numeroLote || ("MOB-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + (Math.random()*1000|0));
  return apiPost("/insumos/" + insumoId + "/lotes", {
    insumo_id:          insumoId,
    numero_lote:        numLote,
    cantidad_inicial:   cantidad,
    costo_unitario:     costoUnitario || 0,
    proveedor:          proveedor || null,
    fecha_vencimiento:  fechaVencimiento || null,
    notas:              notas || null,
    tipo_presentacion:  tipoPresentacion || "unidad",
    cantidad_bultos:    cantidadBultos || null,
    unidades_por_bulto: unidadesPorBulto || null,
    precio_por_bulto:   precioPorBulto || null,
  });
}

// ── Ingreso masivo con flete ───────────────────────────────────────
async function registrarIngresoMasivo({ proveedor, notas, flete, items }) {
  return apiPost("/insumos/api/ingreso-masivo", {
    proveedor_global: proveedor || null,
    notas:            notas || null,
    costo_extra:      flete || 0,
    tipo_costo_extra: "flete",
    items:            items.map(it => ({
      insumo_id:          it.insumoId,
      tipo_presentacion:  it.tipoPresentacion || "unidad",
      cantidad_bultos:    it.cantidadBultos || 1,
      unidades_por_bulto: it.unidadesPorBulto || 1,
      precio_por_bulto:   it.precioPorBulto || 0,
      proveedor:          it.proveedor || null,
      fecha_vencimiento:  it.fechaVencimiento || null,
      numero_lote:        it.numeroLote || null,
      notas:              it.notas || null,
    })),
  });
}

// ── Admin: todas las ventas del equipo ───────────────────────────
async function fetchVentasAdmin({ desde, hasta, vendedorId } = {}) {
  const qs = new URLSearchParams();
  if (desde) qs.set("desde", desde);
  if (hasta) qs.set("hasta", hasta);
  if (vendedorId) qs.set("vendedor_id", vendedorId);
  const q = qs.toString();
  const data = await apiGet("/vendedores/api/ventas-admin" + (q ? "?" + q : ""));
  return data.map(v => ({
    ...v,
    pay: v.forma_pago === "qr" ? "qr" : v.forma_pago === "transferencia" ? "transfer" : "efectivo",
  }));
}

// ── Finanzas: gastos ──────────────────────────────────────────────
async function fetchGastos({ desde, hasta } = {}) {
  const qs = new URLSearchParams();
  if (desde) qs.set("desde", desde);
  if (hasta) qs.set("hasta", hasta);
  const q = qs.toString();
  return apiGet("/finanzas/api/gastos" + (q ? "?" + q : ""));
}

async function crearGasto({ concepto, monto, categoria }) {
  return apiPost("/finanzas/api/gastos", { concepto, monto: Number(monto), categoria: categoria || "general" });
}

async function eliminarGasto(id) {
  return apiFetch("/finanzas/api/gastos/" + id, { method: "DELETE" });
}

async function fetchFinanzasSalud() {
  return apiGet("/finanzas/api/salud");
}

// ── Alertas de stock ──────────────────────────────────────────────
async function fetchAlertas() {
  return apiGet("/alertas/api");
}

async function resolverAlerta(id) {
  return apiPost("/alertas/api/" + id + "/resolver", {});
}

async function verificarAlertas() {
  return apiPost("/alertas/api/verificar", {});
}

// ── Gestión de usuarios (admin) ───────────────────────────────────
async function fetchUsuariosAdmin() {
  return apiGet("/api/mobile/admin/usuarios_pins");
}

async function crearUsuario({ nombre, username, password, rol }) {
  return apiPost("/api/mobile/admin/crear-usuario", { nombre, username, password, rol: rol || "vendedor" });
}

async function actualizarUsuario(id, data) {
  return apiFetch("/api/mobile/admin/usuarios/" + id, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function desactivarUsuario(id) {
  return apiFetch("/api/mobile/admin/usuarios/" + id, { method: "DELETE" });
}

async function resetPinUsuario(userId, nuevoPin) {
  return apiPost("/api/mobile/admin/reset_pin", { user_id: userId, nuevo_pin: nuevoPin });
}

// ── Cambiar contraseña ────────────────────────────────────────────
async function cambiarPassword(passwordActual, passwordNueva) {
  return apiFetch("/api/mobile/cambiar-password", {
    method: "POST",
    body: JSON.stringify({ password_actual: passwordActual, password_nueva: passwordNueva }),
  });
}

// ── Perfil de usuario ─────────────────────────────────────────
async function fetchPerfil() {
  return apiFetch("/api/mobile/perfil");
}

async function actualizarPerfil(data) {
  return apiFetch("/api/mobile/perfil", { method: "PATCH", body: JSON.stringify(data) });
}

Object.assign(window, { cambiarPassword,
  saveRememberedUser, getRememberedUser, clearRememberedUser, triggerBiometric, checkBiometricAvailable,
  loginUser, logoutUser, isLoggedIn, loginAndSetupPush, apiPost,
  fetchUsuarios, fetchVendedores, fetchMiStock, fetchMisVentas,
  fetchNegocios, fetchVentasPendientes, fetchCuentas, registrarVenta,
  cobrarEntrega, crearPedido, fetchPedidosAdmin, actualizarPedido,
  fetchResumen, agregarMovimiento, fetchEventos, fetchEtapasProduccion, pingOnline,
  fetchProductos, avanzarEtapaProduccion, fetchStockTerminado,
  fetchPerfil, actualizarPerfil,
  fetchInsumos, fetchRecetasActivas,
  fetchLotesMasaDisp, fetchLotesTapasDisp,
  iniciarProduccion, registrarCompraInsumo, registrarIngresoMasivo,
  fetchListasPrecio, actualizarListaPrecio,
  buscarClientesPedido, asignarPedido, entregarPedido,
  fetchClientes, crearCliente,
  fetchVentasAdmin, fetchGastos, crearGasto, eliminarGasto, fetchFinanzasSalud,
  fetchAlertas, resolverAlerta, verificarAlertas,
  fetchUsuariosAdmin, crearUsuario, actualizarUsuario, desactivarUsuario, resetPinUsuario,
});
