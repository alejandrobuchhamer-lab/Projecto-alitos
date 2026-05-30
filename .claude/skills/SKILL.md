---
name: auditoria-sistema
description: >
  Audita de forma sistemática el sistema de gestión de finanzas, ventas y stock
  del emprendimiento de alfajores. Úsala SIEMPRE que el usuario pida "revisá el
  sistema", "qué le falta", "auditá esto", "está bien armado?", "qué mejorarías",
  o cuando se sume una feature nueva y convenga chequear que no haya quedado nada
  flojo. También úsala de forma proactiva antes de dar por cerrada una parte
  importante del código (cálculo de precios, costos, stock, cierres de caja),
  aunque el usuario no lo pida explícitamente.
---

# Auditoría del sistema

El objetivo de esta skill es que dejes de mirar solo "lo que está a la vista" y
recorras un checklist completo, dominio por dominio, reportando con criterio qué
falta, qué está flojo y qué priorizar. El usuario tiene un emprendimiento de
alfajores y maneja plata real, así que un error silencioso le cuesta dinero.

## Cómo trabajar

1. Primero entendé el alcance: ¿auditamos todo el sistema o un módulo puntual
   (precios, costos, stock, ventas, caja)? Si no está claro, asumí "todo" pero
   avisá que vas a hacer una pasada general.
2. Recorré las categorías de abajo que apliquen. No inventes problemas que no
   existen, pero tampoco des por hecho que algo está resuelto sin verlo en el
   código.
3. Para cada hallazgo, clasificá la severidad: **Crítico** (puede dar números
   mal o perder plata/datos), **Importante** (riesgo real pero no inmediato),
   **Mejora** (calidad de vida / mantenibilidad).
4. Terminá con un resumen priorizado: qué arreglar primero y por qué.

No hace falta que el código sea perfecto. La idea es darle al usuario un mapa
honesto del estado y dejarlo decidir.

## Checklist por dominio

### Cálculos financieros (lo más sensible)
- ¿Los montos usan enteros en centavos o `Decimal`, en vez de `float`? Con
  `float` los redondeos te arruinan los totales.
- ¿Hay un único lugar donde se calcula costo, margen y precio, o está repetido y
  puede desincronizarse?
- ¿Se contempla inflación / actualización de costos por fecha? En Argentina un
  costo de hace dos meses ya no sirve para calcular ganancia real.
- ¿El margen es bruto o neto, y queda claro cuál es cuál? ¿Se restan comisiones,
  impuestos, packaging, flete?
- ¿Qué pasa con división por cero (margen sobre costo cero, etc.)?

### Stock
- ¿Se puede dejar stock en negativo? ¿Debería poder?
- ¿El descuento de stock al vender es atómico (no se pisa con ventas en paralelo)?
- ¿Hay un umbral de "stock bajo" configurable y un reporte de reposición?
- ¿Se distingue unidad / caja / docena sin mezclar las cuentas?

### Ventas y caja
- ¿Una venta puede quedar a medias (se cobró pero no se descontó stock, o al
  revés)? Buscá si hay transacciones envolviendo esas operaciones.
- ¿Se guarda el precio y el costo al momento de la venta (snapshot), o se
  recalcula con valores de hoy? Tiene que ser snapshot, si no la ganancia
  histórica cambia sola.
- ¿Los cierres de caja cuadran? ¿Hay forma de detectar descuadres?

### Datos y persistencia
- ¿Hay validación de entrada (precios negativos, cantidades raras, fechas)?
- ¿Hay backups o al menos un export de los datos?
- ¿Las migraciones de la base son reproducibles?

### Errores y robustez
- ¿Los errores se manejan o el sistema explota y el usuario pierde lo cargado?
- ¿Hay logs útiles para entender qué pasó cuando algo falla?
- Casos borde: catálogo vacío, producto sin costo cargado, primera venta del día.

### Seguridad básica (si tiene acceso web / multiusuario)
- ¿Hay credenciales o claves hardcodeadas en el código?
- ¿Las entradas del usuario se sanitizan (inyección SQL, etc.)?
- ¿Quién puede ver/editar precios y costos?

### Mantenibilidad
- ¿La lógica de negocio está separada de la interfaz?
- ¿Hay tests, aunque sea de los cálculos de plata?
- ¿Los nombres reflejan el dominio (costo, margen, CMV) o son genéricos?

## Formato del reporte

Usá siempre esta estructura:

```
# Auditoría — [módulo o "sistema completo"]

## Críticos
- [hallazgo]: por qué importa + dónde está (archivo/función) + sugerencia.

## Importantes
- ...

## Mejoras
- ...

## Prioridad sugerida
1. ...
2. ...
```

Si no encontrás nada en una categoría, decilo explícitamente ("Stock: sin
hallazgos") para que quede claro que la revisaste y no que la salteaste.
