# Alito's — App de gestión + Tienda online

Proyecto de **Alito's** (alfajores artesanales). Incluye dos productos web:

| Archivo | Qué es |
|---|---|
| **`ALITOS App.html`** | App móvil de gestión interna (Administrador / Vendedor-repartidor / Producción). Ingreso por usuario + huella. |
| **`Tienda Alitos.html`** | Tienda online / portal de pedidos (minorista y mayorista) con intro, login, catálogo, carrito y checkout. |

---

## ▶️ Cómo abrirlo en VS Code

El proyecto usa **React + Babel en el navegador** y carga los componentes desde archivos `.jsx` externos.
Por seguridad del navegador (CORS), **NO** funciona abriendo el HTML con doble clic (`file://`).
Hay que servirlo con un **servidor local**. Es muy fácil:

### Opción A — Extensión "Live Server" (recomendada)
1. Abrí la carpeta del proyecto en VS Code (`File → Open Folder…`).
2. Instalá la extensión **Live Server** (de Ritwick Dey) desde el panel de extensiones.
3. Clic derecho sobre `Tienda Alitos.html` (o `ALITOS App.html`) → **"Open with Live Server"**.
4. Se abre en el navegador en `http://127.0.0.1:5500/…` y listo.

### Opción B — Por terminal (si tenés Node o Python)
Desde la carpeta del proyecto:

```bash
# con Node
npx serve .

# o con Python
python -m http.server 5500
```

Luego entrá a `http://localhost:5500/Tienda%20Alitos.html`.

> ⚠️ Necesitás conexión a internet la primera vez: React, Babel y las fuentes de Google se cargan por CDN.

---

## 🗂 Estructura de archivos

### Tienda online (`Tienda Alitos.html`)
```
Tienda Alitos.html      ← punto de entrada (monta <Store/>)
tienda.css              ← todos los estilos de la tienda
tienda-data.jsx         ← datos (productos, cajas, precios) + íconos + helpers de animación
tienda-auth.jsx         ← pantalla de login / registro (particular y comercio)
tienda-app.jsx          ← app completa: intro, hero, catálogo, franjas, carrito, checkout, asistente IA
```

### App de gestión (`ALITOS App.html`)
```
ALITOS App.html         ← punto de entrada (monta <Root/>)
alitos-mobile.css       ← estilos de la app móvil
data.jsx                ← datos compartidos (vendedores, productos, cuentas, movimientos)
ui.jsx                  ← componentes base (Phone, Icon, AppBar, Sheet, Toast, nav)
root.jsx                ← ingreso (usuario → huella) + ruteo por rol
admin.jsx               ← vista Administrador
admin-sheets.jsx        ← modales/hojas del admin
vendor.jsx              ← vista Vendedor-repartidor
vendor-sheets.jsx       ← modales/hojas del vendedor
orders.jsx              ← pedidos
notifs.jsx              ← notificaciones
other-apps.jsx          ← vista Producción
```

### Recursos
```
assets/                 ← imágenes (fotos de alfajores, logo, fondos) y la fuente BoostPlayer.otf
```

---

## 🎨 Marca

- **Tipografía de marca:** `BoostPlayer` (en `assets/BoostPlayer.otf`) — el wordmark "Alito's".
- **Texto:** Inter. **Títulos editoriales de la tienda:** Fraunces (serif).
- **Paleta:** fondo oscuro `#0d0d0d`, cards `#161616`, acento ámbar `#c47820`, crema `#f5e6c0`.

---

## 🤖 Nota sobre el "Asistente de antojos" (IA)
En la tienda hay un asistente que recomienda productos. Usa un helper de IA del entorno de previsualización
(`window.claude.complete`). **Fuera de ese entorno** ese helper no existe, pero el asistente ya tiene un
**plan B** por palabras clave, así que igual recomienda productos sin romperse. Para producción real,
conectá ese llamado a tu propio backend / API.

---

## 📝 Pendientes sugeridos para desarrollo
- Conectar autenticación real (Google + email) y backend de usuarios.
- Definir los **precios mayoristas** desde un panel de administración real.
- Persistir pedidos y movimientos en una base de datos.
- Pasarela de pago real (MercadoPago, transferencia).
