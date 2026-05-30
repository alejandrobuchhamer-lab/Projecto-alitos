/* ============================================================
   ALITOS — Main JS
   ============================================================ */

// Sidebar manejado completamente por base.html (setSidebarState)

// ====== THEME ======
function applyTheme(primary, accent, bg) {
  const r = document.documentElement.style;
  if (primary) r.setProperty('--color-primary', primary);
  if (accent)  r.setProperty('--color-accent', accent);
  if (bg)      r.setProperty('--color-bg', bg);
}

function loadTheme() {
  const t = JSON.parse(localStorage.getItem('alitos-theme') || '{}');
  applyTheme(t.primary, t.accent, t.bg);
  if (t.light) document.body.classList.add('light');
}

function saveTheme(primary, accent, bg, light) {
  localStorage.setItem('alitos-theme', JSON.stringify({ primary, accent, bg, light }));
  applyTheme(primary, accent, bg);
  document.body.classList.toggle('light', light);
}

loadTheme();

// ====== MODAL ======
function openModal(id) {
  const m = document.getElementById(id);
  m?.classList.add('active');
}

function closeModal(id) {
  const m = document.getElementById(id);
  m?.classList.remove('active');
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
});

// ====== TOAST ======
let toastContainer = null;

function toast(message, type = 'info', duration = 4000) {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  toastContainer.appendChild(t);

  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(100%)';
    t.style.transition = '0.3s ease';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// ====== API HELPERS ======
async function apiGet(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPost(url, data) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Error desconocido' }));
    throw new Error(err.detail || JSON.stringify(err));
  }
  return r.json();
}

async function apiDelete(url) {
  const r = await fetch(url, { method: 'DELETE' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiCall(method, url, data) {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Error desconocido' }));
    throw new Error(err.detail || JSON.stringify(err));
  }
  return r.json();
}

// ====== CONFIRMACIÓN ======
function confirmar(mensaje, callback) {
  if (confirm(mensaje)) callback();
}

// ====== FORMATTERS ======
function formatCurrency(val, moneda = 'ARS') {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda, maximumFractionDigits: 0 }).format(val);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-AR');
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

// ====== COUNT UP ANIMATION ======
function countUp(el, target, duration = 1100, prefix = '', suffix = '') {
  const isFloat = !Number.isInteger(target);
  const start = performance.now();
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = target * eased;
    el.textContent = prefix + (isFloat ? val.toFixed(2) : Math.round(val).toLocaleString('es-AR')) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function initCountUps() {
  document.querySelectorAll('[data-countup]').forEach(el => {
    const target = parseFloat(el.dataset.countup.replace(/[^0-9.]/g, ''));
    if (isNaN(target)) return;
    const prefix   = el.dataset.prefix || '';
    const suffix   = el.dataset.suffix || '';
    const duration = parseInt(el.dataset.duration || 1100);
    countUp(el, target, duration, prefix, suffix);
  });
}

// ====== FADE IN SECTIONS ======
function initFadeIn() {
  document.querySelectorAll('.fade-in-section').forEach((el, i) => {
    el.style.animationDelay = `${60 + i * 70}ms`;
    el.style.animationFillMode = 'forwards';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initCountUps();
  initFadeIn();
});

// ====== SPARKLINE CHARTS ======
function renderSparkline(containerId, data, maxVal) {
  const container = document.getElementById(containerId);
  if (!container || !data.length) return;

  const max = maxVal || Math.max(...data.map(d => d.total), 1);
  const barsDiv = container.querySelector('.chart-bar-row');
  const labelsDiv = container.querySelector('.chart-labels');

  if (barsDiv) {
    barsDiv.innerHTML = data.map(d => {
      const pct = max > 0 ? (d.total / max) * 100 : 0;
      return `<div class="chart-bar" style="height:${Math.max(pct, 5)}%" title="${d.dia}: ${formatCurrency(d.total)}"></div>`;
    }).join('');
  }

  if (labelsDiv) {
    labelsDiv.innerHTML = data.map(d => `<span>${d.dia}</span>`).join('');
  }
}

// ====== ACTIVE NAV ======
function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(a => {
    const href = a.getAttribute('href');
    if (href && href !== '/' && path.startsWith(href)) {
      a.classList.add('active');
    } else if (href === '/' && path === '/') {
      a.classList.add('active');
    }
  });
}

setActiveNav();

// ====== ALERTAS COUNT ======
async function loadAlertasCount() {
  try {
    const alertas = await apiGet('/alertas/api');
    const badge = document.getElementById('alertas-badge');
    if (badge) {
      badge.textContent = alertas.length;
      badge.style.display = alertas.length > 0 ? 'inline-flex' : 'none';
    }
  } catch (_) {}
}

loadAlertasCount();

// ====== THEME PICKER ======
document.querySelectorAll('[data-theme-preset]').forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = btn.dataset.themePreset;
    const presets = {
      cacao:     { primary: '#8B4A1A', accent: '#D4A017', bg: '#0F0806', light: false },
      caramelo:  { primary: '#A0522D', accent: '#FF8C00', bg: '#0D0802', light: false },
      chocolate: { primary: '#5C2D0E', accent: '#C68642', bg: '#080503', light: false },
      noche:     { primary: '#2D4A6B', accent: '#64B5F6', bg: '#050810', light: false },
      claro:     { primary: '#6D4C41', accent: '#FF7043', bg: '#F9F3EE', light: true },
    };
    if (presets[preset]) {
      const { primary, accent, bg, light } = presets[preset];
      saveTheme(primary, accent, bg, light);
      toast(`Tema "${preset}" aplicado`, 'success');
    }
  });
});
