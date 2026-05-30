---
name: dominio-alfajores
description: >
  Conocimiento del dominio del emprendimiento de alfajores: vocabulario, unidades,
  estructura de costos, definiciones de margen y reglas del negocio. Úsala SIEMPRE
  que se trabaje sobre código de costos, precios, márgenes, ganancia, stock o
  ventas de este sistema, para que los cálculos respeten cómo funciona realmente
  el negocio y no se usen supuestos genéricos. También úsala al modelar tablas,
  nombrar variables o escribir tests de la lógica de plata.
---

# Dominio: emprendimiento de alfajores

Este sistema gestiona finanzas, ventas y stock de un emprendimiento que produce
y vende alfajores. Acá está el conocimiento del negocio para que el código hable
el mismo idioma que el dueño y los cálculos sean correctos.

## Vocabulario

- **Insumo / materia prima**: lo que se compra para producir (harina, dulce de
  leche, chocolate, coco).
- **Receta**: cuánto de cada insumo lleva un producto. Se define por **tanda**
  (una preparación completa), no por unidad.
- **Rinde**: cuántas unidades salen de una tanda. El costo unitario de materia
  prima es `costo_tanda / rinde`.
- **Merma**: porcentaje que se pierde por rotura, mal sellado o descarte. Encarece
  cada unidad buena: `costo / (1 - merma)` o `costo × (1 + merma)` según cómo se
  modele; definir UNA convención y documentarla.
- **CMV** (costo de mercadería vendida): el costo real de lo que se vendió, no de
  lo que se produjo.

## Unidades — no mezclar

Los alfajores se manejan en distintas presentaciones y es un error clásico
sumarlas mal:
- **unidad**: un alfajor.
- **caja / pack**: un conjunto (ej. caja de 6 o de 12).
- **docena**: 12 unidades.

Toda cantidad debe llevar su unidad explícita. Nunca sumar unidades con cajas sin
convertir. El packaging cambia según la presentación (una caja de 6 tiene su
propio costo de packaging).

## Estructura de costos

El costo real unitario NO es solo la materia prima. Incluye:
1. Materia prima (vía receta y rinde).
2. Packaging (papel, caja, etiqueta) — varía por presentación.
3. Mano de obra — el tiempo de producción tiene valor; repartir por tanda/rinde.
4. Overhead — gas, luz, parte del alquiler; prorratear por unidad producida.
5. Merma — ajuste final que encarece la unidad buena.

Un cálculo que solo sume ingredientes está subestimando el costo y dando una
ganancia falsamente alta. Si el código calcula "costo" como solo materia prima,
señalalo.

## Definiciones de margen (importante distinguir)

- **margen sobre precio** = ganancia / precio_venta. Es el que se usa para saber
  qué % de cada venta es ganancia.
- **margen sobre costo** (markup) = ganancia / costo. Es cuánto se le agrega
  arriba del costo.
- **margen bruto**: precio − CMV (no descuenta gastos fijos).
- **margen neto**: después de descontar también gastos fijos, impuestos y
  comisiones.

Cuando el negocio dice "ganancia real" se refiere al **margen neto** o al menos
a un margen que ya descuenta packaging, mano de obra y overhead — no al simple
precio menos materia prima. Ante la duda, preguntar cuál se quiere.

## Reglas del negocio

- **Contexto Argentina**: alta inflación. Los costos se desactualizan rápido. Todo
  costo debe estar fechado y el sistema debe poder marcar un costo como "viejo".
  Calcular ganancia con costos de hace meses da números engañosos.
- **Snapshot en ventas**: cada venta guarda el precio y el costo del momento. No
  recalcular ventas pasadas con precios de hoy.
- **Dinero en enteros**: representar montos en centavos (enteros) o `Decimal`,
  nunca `float`, para evitar errores de redondeo que descuadran totales.
- **Stock**: distinguir stock de insumos (materia prima) y stock de producto
  terminado. Producir descuenta insumos; vender descuenta producto terminado.

## Al escribir código

- Nombrá las variables con el vocabulario del dominio: `costo_real_unitario`,
  `margen_sobre_precio`, `cmv`, `rinde`, `merma` — no `cost1`, `total`, `x`.
- Centralizá el cálculo de costo y margen en un solo módulo; que ventas, reportes
  y el agente lean de ahí.
- Si escribís tests, priorizá los de la lógica de plata: costo unitario, margen,
  y el caso de costo desactualizado.
