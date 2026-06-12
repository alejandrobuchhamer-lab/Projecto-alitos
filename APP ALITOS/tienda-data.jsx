/* ===================== ALITO'S Tienda · datos + iconos ===================== */
const ARS = n => "$" + Math.round(n).toLocaleString("es-AR");

function TIcon({ name, size = 20, sw = 2 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
    dangerouslySetInnerHTML={{ __html: TICONS[name] || "" }} />;
}
const TICONS = {
  cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l2.4 12.3a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L22 7H6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  truck: '<path d="M1 4h13v11H1zM14 8h4l3 3v4h-7"/><circle cx="5.5" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/>',
  store: '<path d="M3 9 4.5 4h15L21 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/>',
  pin: '<path d="M12 21s-7-6.7-7-11a7 7 0 0 1 14 0c0 4.3-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 10-4 16-9 16Z"/><path d="M11 20c0-5 2-9 7-12"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5Z"/><path d="m9 12 2 2 4-4"/>',
  box: '<path d="M16 3 4 8v8l8 5 8-5V8L8 3M4 8l8 5 8-5"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6Z"/><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor"/>',
  star: '<path d="m12 2 3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.6 3.2L6.7 14l-5-4.8 7-.9Z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  ig: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>',
  wa: '<path d="M3 21l1.9-5A8.5 8.5 0 1 1 12 20.5a8.4 8.4 0 0 1-4.1-1L3 21Z"/><path d="M8.5 8.5c0 4 3 7 6.5 7"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
};

const CATS = [
  { id: "all", name: "Todos" },
  { id: "maicena", name: "Maicena" },
  { id: "cacao", name: "Cacao Intenso" },
  { id: "vainilla", name: "Vainilla y Nuez" },
  { id: "cajas", name: "Cajas y regalos" },
];

/* precio: unit = minorista por unidad; may = mayorista por unidad (caja de minBox) */
const PRODUCTS = [
  { id: "maicena", name: "Alfajor de Maicena", cat: "maicena", catLabel: "Maicena · 80g", img: "assets/photo-maicena.jpg", photo: true,
    desc: "Tapas de almidón de maíz que se deshacen en la boca, dulce de leche repostero y coco. El clásico de siempre.", unit: 1100, may: 800, minBox: 12, tag: "El más vendido", hot: true },
  { id: "cacao", name: "Alfajor Cacao Intenso", cat: "cacao", catLabel: "Cacao Intenso · 65g", img: "assets/photo-choco.jpg", photo: true,
    desc: "Bañado en chocolate semiamargo, con doble dulce de leche. Para los que aman el cacao de verdad.", unit: 1200, may: 870, minBox: 12, tag: null },
  { id: "vainilla", name: "Alfajor Vainilla y Nuez", cat: "vainilla", catLabel: "Vainilla y Nuez · 65g", img: "assets/photo-vainilla.jpg", photo: true,
    desc: "Bañado en chocolate blanco, relleno de dulce de leche y nuez. Suave, elegante, irresistible.", unit: 1250, may: 910, minBox: 12, tag: "Premium" },
];

/* cajas / regalos */
const BOXES = [
  { id: "box-regalo", name: "Caja Regalo x4", cat: "cajas", catLabel: "Regalo", img: "assets/photo-regalo.jpg", photo: true,
    desc: "4 alfajores surtidos en caja dorada con moño. El regalo que enamora.", unit: 5200, may: 4100, units: 4, tag: "Para regalar", hot: true },
  { id: "box-surtida", name: "Caja Surtida x12", cat: "cajas", catLabel: "Caja", img: "assets/photo-box.jpg", photo: true,
    desc: "12 alfajores surtidos de todas las variedades, frescos del día.", unit: 13800, may: 10900, units: 12, tag: "Más elegida" },
  { id: "box-degu", name: "Combo Degustación x6", cat: "cajas", catLabel: "Combo", img: "assets/photo-hero.jpg", photo: true,
    desc: "6 piezas surtidas para probar todos los sabores de la casa.", unit: 6900, may: 5500, units: 6, tag: null },
];

const ALL_ITEMS = [...PRODUCTS, ...BOXES];
const ITEM_BY_ID = Object.fromEntries(ALL_ITEMS.map(i => [i.id, i]));

/* ---------- animaciones: scroll-reveal + count-up (globales, estables) ---------- */
function useScrollReveal(deps) {
  React.useEffect(function () {
    var els = [].slice.call(document.querySelectorAll("[data-reveal]:not(.in)"));
    if (!("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var el = en.target;
          var delay = +(el.dataset.revealDelay || 0);
          setTimeout(function () { el.classList.add("in"); }, delay);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -7% 0px" });
    els.forEach(function (e) { io.observe(e); });
    return function () { io.disconnect(); };
  }, deps || []);
}

function CountUp(props) {
  var value = props.value, duration = props.duration || 1100;
  var ref = React.useRef(null);
  React.useEffect(function () {
    var el = ref.current; if (!el) return;
    var m = String(value).match(/^(\D*)(\d+)(\D*)$/);
    if (!m) { el.textContent = value; return; }
    var pre = m[1], target = +m[2], post = m[3], started = false;
    function run() {
      if (started) return; started = true;
      var t0 = performance.now();
      function tick(now) {
        var p = Math.min(1, (now - t0) / duration);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = pre + Math.round(target * eased) + post;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
    var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting) run(); }, { threshold: 0.5 });
    io.observe(el);
    return function () { io.disconnect(); };
  }, [value]);
  return React.createElement("span", { ref: ref, className: "v" }, value);
}

Object.assign(window, { ARS, TIcon, TICONS, CATS, PRODUCTS, BOXES, ALL_ITEMS, ITEM_BY_ID, useScrollReveal, CountUp });
