/* ===================== ALITO'S · Iconos + Datos compartidos ===================== */
/* Feather-style stroke icons */
function Icon({ name, size = 20, sw = 2, style }) {
  const p = ICONS[name] || "";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}
      dangerouslySetInnerHTML={{ __html: p }} />
  );
}
const ICONS = {
  home: '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
  pin: '<path d="M12 21s-7-6.7-7-11a7 7 0 0 1 14 0c0 4.3-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H3Z"/><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H4"/><circle cx="16.5" cy="12.5" r="1.2" fill="currentColor" stroke="none"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.4 12.3a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L22 7H6"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  truck: '<path d="M1 4h13v11H1zM14 8h4l3 3v4h-7"/><circle cx="5.5" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkBig: '<path d="M20 6 9 17l-5-5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  bank: '<path d="M3 21h18M4 10h16M5 21V10M19 21V10M12 3 4 8h16Z"/><path d="M9 21V14M15 21V14"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h3M21 17v4"/>',
  transfer: '<path d="M16 3l4 4-4 4M20 7H8M8 21l-4-4 4-4M4 17h12"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevR: '<path d="m9 6 6 6-6 6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  trend: '<path d="M3 17 9 11l4 4 8-8"/><path d="M17 7h4v4"/>',
  store: '<path d="M3 9 4.5 4h15L21 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  star: '<path d="m12 2 3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.6 3.2L6.7 14l-5-4.8 7-.9Z"/>',
  receipt: '<path d="M5 3v18l2.5-1.5L10 21l2-1.5L14 21l2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5Z"/><path d="M9 8h6M9 12h6"/>',
  edit: '<path d="M11 4H4v16h16v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4Z"/>',
  camera: '<path d="M4 7h3l2-2h6l2 2h3v13H4Z"/><circle cx="12" cy="13" r="3.5"/>',
  route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H14a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  package: '<path d="M16 3 4 8v8l8 5 8-5V8L8 3M4 8l8 5 8-5"/>',
  flame: '<path d="M12 2c1 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 1.5-4 .5 2 1.5 2.5 1.5 2.5C9 8 10 5 12 2Z"/>',
  factory: '<path d="M3 21h18M4 21V10l5 3V10l5 3V7l5 3v11"/><path d="M9 21v-4h4v4"/>',
  tag: '<path d="M12 2H7a2 2 0 0 0-2 2v5L2 12l3 3v5a2 2 0 0 0 2 2h5l7-7V4a2 2 0 0 0-2-2h-5Z"/><circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none"/>',
  chart: '<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6"/><rect x="13" y="7" width="3" height="10"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.7 7.7 0 0 0 .1-2l1.7-1.3-2-3.4-2 .8a8 8 0 0 0-1.7-1l-.3-2.1H8.9l-.3 2.1a8 8 0 0 0-1.7 1l-2-.8-2 3.4L4.6 11a7.7 7.7 0 0 0 0 2l-1.7 1.3 2 3.4 2-.8a8 8 0 0 0 1.7 1l.3 2.1h4.2l.3-2.1a8 8 0 0 0 1.7-1l2 .8 2-3.4Z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M3 12h18"/>',
  fingerprint: '<path d="M12 11a2 2 0 0 0-2 2c0 1.5.5 3.5-1 5"/><path d="M8 11a4 4 0 0 1 8 0c0 2.5 0 4-1 6"/><path d="M5.5 10a6.5 6.5 0 0 1 12.9-1"/><path d="M12 13c0 3-1 6-2.5 8"/><path d="M16 13c0 2-.3 4-1 5.5"/>',
};

/* ===================== HELPERS ===================== */
const ARS = n => "$" + Math.round(n).toLocaleString("es-AR");
const ARSc = n => Math.round(n).toLocaleString("es-AR");

/* ===================== DATA ===================== */
const PRODUCTS = [
  { id: "maicena",  name: "Alfajor de Maicena",         price: 850,  img: "assets/alfajor-maicena.png" },
  { id: "choco",    name: "Alfajor de Chocolate Negro", price: 1100, img: "assets/alfajor-choco.png" },
  { id: "dulce",    name: "Alfajor de Dulce de Leche",  price: 950,  img: "assets/alfajor-dulce.png" },
  { id: "triple",   name: "Alfajor Triple",             price: 1450, img: "assets/alfajor-triple.png" },
  { id: "conitos",  name: "Conitos de Dulce de Leche",  price: 600,  img: "assets/alfajor-conitos.png" },
];
const PROD_BY_ID = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));

const ACCOUNTS = {
  efectivo: { name: "Efectivo en caja", short: "Efectivo", emoji: "💵", icon: "cash", color: "var(--green)", soft: "var(--green-soft)", balance: 45200 },
  banco:    { name: "Banco / Transferencia", short: "Banco", emoji: "🏦", icon: "bank", color: "var(--blue)", soft: "var(--blue-soft)", balance: 128500 },
  mp:       { name: "MercadoPago", short: "MercadoPago", emoji: "📱", icon: "phone", color: "var(--purple)", soft: "var(--purple-soft)", balance: 67300 },
};

const VENDORS = [
  { id: "martin", name: "Martín Gómez",    first: "Martín", role: "Repartidor", roleTag: "rep", online: true,  stockUnits: 320, sales: 58400, pending: 42000, visited: 6, route: 9, avatar: "MG", color: "#4a90e2" },
  { id: "lucia",  name: "Lucía Fernández", first: "Lucía",  role: "Repartidora", roleTag: "rep", online: true,  stockUnits: 280, sales: 71200, pending: 0,     visited: 8, route: 11, avatar: "LF", color: "#c47820" },
  { id: "diego",  name: "Diego Quiroga",   first: "Diego",  role: "Tomador de pedidos", roleTag: "tom", online: false, stockUnits: 0, sales: 24600, pending: 18500, visited: 4, route: 7, avatar: "DQ", color: "#9173e0" },
];
const VEND_BY_ID = Object.fromEntries(VENDORS.map(v => [v.id, v]));

/* negocios / clientes en el mapa */
const PLACES = [
  { id: 1, name: "Kiosco Don Pedro",     addr: "Av. Rivadavia 1820, Morón",  prod: "maicena", qty: 48, exp: "24/06", days: 16, vendor: "martin", type: "ok",   x: 24, y: 30, debt: 0 },
  { id: 2, name: "Despensa Santa Rita",  addr: "San Martín 210, Haedo",      prod: "choco",   qty: 60, exp: "02/07", days: 24, vendor: "martin", type: "ok",   x: 63, y: 22, debt: 0 },
  { id: 3, name: "Estación YPF Ruta 7",  addr: "Acceso Oeste km 22",         prod: "dulce",   qty: 90, exp: "28/06", days: 20, vendor: "martin", type: "ok",   x: 80, y: 56, debt: 14200 },
  { id: 4, name: "Súper Día %",          addr: "Gaona 2450, Morón",          prod: "triple",  qty: 75, exp: "05/07", days: 27, vendor: "martin", type: "ok",   x: 45, y: 68, debt: 0 },
  { id: 5, name: "Bar El Fortín",        addr: "Las Heras 88, Haedo",        prod: "choco",   qty: 36, exp: "30/06", days: 22, vendor: "lucia",  type: "ok",   x: 33, y: 51, debt: 8400 },
  { id: 6, name: "Almacén La Esquina",   addr: "Belgrano 540, Castelar",     prod: "triple",  qty: 30, exp: "11/06", days: 3,  vendor: "lucia",  type: "warn", x: 71, y: 39, debt: 0 },
  { id: 7, name: "Maxikiosco El Trébol", addr: "Yrigoyen 3300, Morón",       prod: "conitos", qty: 24, exp: "10/06", days: 2,  vendor: "lucia",  type: "warn", x: 53, y: 44, debt: 0 },
  { id: 8, name: "Panadería La Espiga",  addr: "Sarmiento 760, Ituzaingó",   prod: "maicena", qty: 40, exp: "09/06", days: 1,  vendor: "lucia",  type: "warn", x: 16, y: 71, debt: 5600 },
];
const DRIVERS = [
  { vendor: "martin", x: 57, y: 33 },
  { vendor: "lucia",  x: 38, y: 60 },
];

/* movimientos de caja (admin) — más recientes primero */
const MOVEMENTS_SEED = [
  { date: "08/06 12:15", concept: "Transferencia Súper Día %",            sub: "Cobranza mayorista",        account: "banco",    type: "in",  amount: 34000 },
  { date: "08/06 11:30", concept: "Pago harina · Molino Campodónico",     sub: "Proveedor",                 account: "banco",    type: "out", amount: 64000 },
  { date: "08/06 10:05", concept: "Venta QR Maxikiosco El Trébol",        sub: "MercadoPago",               account: "mp",       type: "in",  amount: 8900  },
  { date: "08/06 09:12", concept: "Cobranza Kiosco Don Pedro",            sub: "Martín Gómez · reparto",    account: "efectivo", type: "in",  amount: 28400 },
  { date: "07/06 17:40", concept: "Combustible camioneta",                sub: "Reparto zona Oeste",        account: "efectivo", type: "out", amount: 15200 },
  { date: "07/06 16:10", concept: "Cobranza Despensa Santa Rita",         sub: "Martín Gómez · reparto",    account: "efectivo", type: "in",  amount: 19600 },
  { date: "07/06 14:25", concept: "Sueldo quincena · Diego Q.",           sub: "Personal",                  account: "banco",    type: "out", amount: 95000 },
  { date: "06/06 18:00", concept: "Venta QR Panadería La Espiga",         sub: "MercadoPago",               account: "mp",       type: "in",  amount: 12300 },
  { date: "06/06 11:20", concept: "Compra dulce de leche · La Vascongada",sub: "Proveedor",                 account: "banco",    type: "out", amount: 48500 },
  { date: "05/06 19:30", concept: "Cobranza Bar El Fortín",               sub: "Lucía Fernández · reparto", account: "efectivo", type: "in",  amount: 22700 },
];

/* stock cargado del vendedor (Lucía, demo) */
const VENDOR_STOCK_SEED = [
  { id: "maicena", loaded: 80, sold: 32 },
  { id: "choco",   loaded: 60, sold: 24 },
  { id: "dulce",   loaded: 70, sold: 28 },
  { id: "triple",  loaded: 40, sold: 12 },
  { id: "conitos", loaded: 60, sold: 22 },
];

/* ventas de hoy del vendedor */
const VENDOR_SALES_SEED = [
  { time: "11:20", place: "Maxikiosco El Trébol", units: 24, amount: 14400, pay: "qr" },
  { time: "10:05", place: "Bar El Fortín",        units: 18, amount: 10800, pay: "efectivo" },
  { time: "09:30", place: "Almacén La Esquina",   units: 30, amount: 19500, pay: "transfer" },
];

const ROLES = [
  { id: "admin",  name: "Administrador",      sub: "Dueño · acceso total",        icon: "chart",  color: "var(--amber-bright)", soft: "var(--amber-soft)" },
  { id: "vendedor", name: "Vendedor", sub: "Reparto, cobranza y pedidos", icon: "truck", color: "var(--blue)", soft: "var(--blue-soft)" },
  { id: "produccion", name: "Producción",      sub: "Fábrica · elaboración",      icon: "factory", color: "var(--green)", soft: "var(--green-soft)" },
];

/* Usuarios creados/administrados desde el panel de Admin.
   Cada cuenta tiene una VISTA asignada: al ingresar, abre solo esa vista. */
const USERS = [
  { id: "ruben",  name: "Rubén Alitos",     first: "Rubén",  avatar: "RA", color: "var(--amber)", view: "admin",      roleLabel: "Administrador",         sub: "Acceso total a la fábrica",   icon: "chart",   iconColor: "var(--amber-bright)", soft: "var(--amber-soft)" },
  { id: "lucia",  name: "Lucía Fernández",  first: "Lucía",  avatar: "LF", color: "#c47820",     view: "vendedor",   roleLabel: "Vendedora repartidora", sub: "Reparto, cobranza y pedidos", icon: "truck",   iconColor: "var(--blue)",   soft: "var(--blue-soft)" },
  { id: "diego",  name: "Diego Quiroga",    first: "Diego",  avatar: "DQ", color: "#9173e0",     view: "vendedor",   roleLabel: "Tomador de pedidos",    sub: "Toma pedidos (sin reparto)", icon: "list",    iconColor: "var(--purple)", soft: "var(--purple-soft)" },
  { id: "carlos", name: "Carlos Sosa",      first: "Carlos", avatar: "CS", color: "var(--green)", view: "produccion", roleLabel: "Producción",             sub: "Fábrica · elaboración",      icon: "factory", iconColor: "var(--green)",  soft: "var(--green-soft)" },
];

Object.assign(window, { Icon, ICONS, ARS, ARSc, PRODUCTS, PROD_BY_ID, ACCOUNTS, VENDORS, VEND_BY_ID, PLACES, DRIVERS, MOVEMENTS_SEED, VENDOR_STOCK_SEED, VENDOR_SALES_SEED, ROLES, USERS });
