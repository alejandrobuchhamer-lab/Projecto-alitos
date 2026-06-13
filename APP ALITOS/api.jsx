/* ===================== ALITO'S · API client =====================
   Todas las llamadas al backend FastAPI (http://localhost:8000).
   Transforma campos del backend al formato que espera la app.
   Auth: JWT Bearer token guardado en localStorage.
================================================================ */

// URL de producción en Railway (se actualiza una vez al hacer deploy)
const RAILWAY_URL = "http://76.13.160.217:8000";

// Capacitor sirve con protocolo capacitor:// → siempre usar Railway
// En red local (dev) → usar el host actual en puerto 8000
const _proto = window.location.protocol;
const _host  = window.location.hostname;
const API_BASE = (_proto === "capacitor:" || _proto === "ionic:")
  ? RAILWAY_URL
  : (_host === "localhost" || _host === "127.0.0.1")
    ? "http://localhost:8000"
    : "http://" + _host + ":8000";
const TOKEN_KEY = "alitos_token";

// ── Token helpers ─────────────────────────────────────────────
function getToken()    { return localStorage.getItem(TOKEN_KEY); }
function setToken(t)   { localStorage.setItem(TOKEN_KEY, t); }
function clearToken()  { localStorage.removeItem(TOKEN_KEY); }

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
  return data;
}

function logoutUser() { clearToken(); }

function isLoggedIn() { return !!getToken(); }

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
    stockUnits: 0,
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

async function agregarMovimiento({ cuentaId, tipo, monto, concepto, descripcion }) {
  return apiPost("/cuentas/api/movimientos", {
    cuenta_id:   cuentaId,
    tipo,
    monto,
    concepto,
    descripcion: descripcion || "",
  });
}

// ── Producción ────────────────────────────────────────────────
async function fetchEtapasProduccion() {
  const data = await apiGet("/produccion/api/etapas");
  const STAGE_IDX = { masa: 0, tapas: 1, armado: 2 };
  return data.map(p => ({
    id:       p.id,
    prod:     p.producto,
    qty:      p.cantidad,
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
  tipoCliente, clienteNombre, clienteLocalidad,
  fechaEntrega, formaPago, descuentoPct, montoLista,
}) {
  return apiPost("/pedidos/api", {
    place,
    negocioId:         negocioId || null,
    units:             units || 0,
    amount:            amount || 0,
    productos:         productos || [],
    notas:             notas || "",
    tipo_cliente:      tipoCliente || "consumidor_final",
    cliente_nombre:    clienteNombre || "",
    cliente_localidad: clienteLocalidad || "",
    fecha_entrega:     fechaEntrega || null,
    forma_pago:        formaPago || null,
    descuento_pct:     descuentoPct || 0,
    monto_lista:       montoLista || amount || 0,
  });
}

async function actualizarPedidoEstado(pedidoId, estado) {
  return apiPut("/pedidos/api/" + pedidoId + "/estado", { estado });
}

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
async function avanzarEtapaProduccion(produccionId) {
  return apiPost("/produccion/api/" + produccionId + "/avanzar-etapa-mobile", {});
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

