# Master de costos + Agente de análisis — Diseño

Este documento define cómo calcular el **costo real** y la **ganancia real** de
cada alfajor, y cómo construir el **agente de IA dentro de tu sistema** que
analiza los números, los cruza con inflación y te da recomendaciones.

---

## 1. Modelo de datos (mínimo necesario)

La idea es tener una sola "fuente de verdad" del costo, fechada, para poder
detectar cuándo un costo quedó viejo.

**insumos** — la materia prima que comprás
- `id`
- `nombre` (ej. "harina 0000", "dulce de leche repostero")
- `unidad_compra` (kg, litro, unidad)
- `precio_actual` (en centavos, entero — NO float)
- `fecha_precio` (cuándo actualizaste ese precio)
- `proveedor`

**productos** — los alfajores que vendés
- `id`
- `nombre` (ej. "alfajor de maicena", "alfajor triple chocolate")
- `precio_venta` (centavos)
- `rinde` (cuántas unidades salen de una "tanda" de la receta)

**receta** — cuánto de cada insumo lleva un producto (tabla intermedia)
- `producto_id`
- `insumo_id`
- `cantidad` (por tanda, en la unidad del insumo)

**costos_indirectos** — lo que no es materia prima
- packaging por unidad (caja, papel, etiqueta)
- mano de obra por tanda (tu hora de trabajo cuesta)
- overhead: gas, luz, parte del alquiler — repartido por unidad producida
- merma: % de producto que se pierde/rompe

**ventas** — cada venta guarda un *snapshot*
- `producto_id`, `cantidad`, `fecha`
- `precio_venta_momento` (lo que cobraste ESE día)
- `costo_real_momento` (lo que costaba ESE día)
- Guardar el snapshot es clave: si recalculás con precios de hoy, tu ganancia
  histórica cambia sola y no podés analizar nada.

---

## 2. Fórmulas

```
costo_materia_prima_por_unidad =
    ( Σ (cantidad_insumo × precio_insumo) por receta ) / rinde

costo_real_unitario =
    ( costo_materia_prima_por_unidad
      + packaging_unitario
      + mano_obra_por_tanda / rinde
      + overhead_unitario )
    × (1 + merma)        # la merma encarece cada unidad buena

ganancia_unitaria      = precio_venta − costo_real_unitario
margen_sobre_precio    = ganancia_unitaria / precio_venta        # "markup real"
margen_sobre_costo     = ganancia_unitaria / costo_real_unitario # "cuánto le agregás"
```

**Punto de equilibrio** (cuántas unidades cubren tus costos fijos del mes):
```
punto_equilibrio = costos_fijos_mensuales / ganancia_unitaria_promedio
```

**Ajuste por inflación** (para saber si tu precio quedó atrasado):
```
precio_que_deberías_tener = precio_anterior × (IPC_hoy / IPC_fecha_precio)
```
El IPC sale del INDEC (ver agente, abajo).

---

## 3. El agente de IA dentro del sistema

El agente NO reemplaza estos cálculos: los *usa*. Vos programás las funciones y
se las das como herramientas (tool use). El agente decide cuándo llamarlas,
interpreta los resultados y te escribe en castellano qué hacer.

### Herramientas que le das al agente

1. `obtener_master_costos()` → corre las fórmulas de arriba y devuelve, por
   producto: costo real, precio actual, margen y **antigüedad del costo** (días
   desde `fecha_precio`).
2. `obtener_stock_bajo(umbral)` → lista de productos/insumos por debajo del
   umbral, para reponer.
3. `obtener_ventas(desde, hasta)` → ventas del período con sus snapshots.
4. `buscar_inflacion()` → trae el último IPC del INDEC (web). Fuente estable y
   oficial, a diferencia de scrapear competidores.

### Por qué fuentes oficiales y no scrapear la competencia
Scrapear precios de competidores choca con sus términos de servicio y se rompe
cada vez que cambian la página. El INDEC, tus listas de proveedores y
marketplaces con API pública te dan datos legales y confiables. Para "compararte
con la competencia" conviene cargar a mano unos pocos precios de referencia en
una tabla `precios_referencia`, y que el agente los lea desde ahí.

### Esqueleto en Python (API de Claude con tool use)

```python
import anthropic

client = anthropic.Anthropic()  # la API key va en variable de entorno

TOOLS = [
    {
        "name": "obtener_master_costos",
        "description": "Devuelve costo real, precio, margen y antigüedad del costo por producto.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "obtener_stock_bajo",
        "description": "Lista productos e insumos por debajo del umbral de stock para reponer.",
        "input_schema": {
            "type": "object",
            "properties": {"umbral": {"type": "integer"}},
            "required": ["umbral"],
        },
    },
    {
        "name": "buscar_inflacion",
        "description": "Trae el último IPC mensual e interanual del INDEC.",
        "input_schema": {"type": "object", "properties": {}},
    },
]

# Estas funciones las implementás vos contra TU base de datos:
def obtener_master_costos(): ...
def obtener_stock_bajo(umbral): ...
def buscar_inflacion(): ...

DISPATCH = {
    "obtener_master_costos": obtener_master_costos,
    "obtener_stock_bajo": obtener_stock_bajo,
    "buscar_inflacion": buscar_inflacion,
}

SYSTEM = """Sos el analista financiero de un emprendimiento de alfajores.
Tu trabajo: usar las herramientas para calcular ganancia real, detectar costos
desactualizados, cruzar con inflación y dar recomendaciones concretas de precio
y reposición. Sé directo, mostrá los números y explicá el porqué. No inventes
datos: si te falta algo, decilo y pedí la herramienta que corresponda."""

def consultar_agente(pregunta_usuario):
    messages = [{"role": "user", "content": pregunta_usuario}]
    while True:
        resp = client.messages.create(
            model="claude-sonnet-4-6",   # verificá el ID vigente al implementar
            max_tokens=2000,
            system=SYSTEM,
            tools=TOOLS,
            messages=messages,
        )
        messages.append({"role": "assistant", "content": resp.content})
        if resp.stop_reason != "tool_use":
            return "".join(b.text for b in resp.content if b.type == "text")

        resultados = []
        for bloque in resp.content:
            if bloque.type == "tool_use":
                salida = DISPATCH[bloque.name](**bloque.input)
                resultados.append({
                    "type": "tool_result",
                    "tool_use_id": bloque.id,
                    "content": str(salida),
                })
        messages.append({"role": "user", "content": resultados})
```

Con esto, vos le escribís *"¿qué precios tengo atrasados y cuánto debería
subir?"* y el agente llama a `obtener_master_costos` + `buscar_inflacion`, cruza
todo y te responde con una recomendación fundamentada. *"Armame la lista de
reposición"* → llama a `obtener_stock_bajo`. Y así.

> Nota: confirmá el ID del modelo vigente cuando lo implementes; los nombres de
> modelo cambian con el tiempo.

---

## 4. Orden sugerido para construirlo

1. Tablas `insumos`, `productos`, `receta` → ya podés calcular costo real.
2. Función `obtener_master_costos()` con las fórmulas de la sección 2.
3. Snapshots en `ventas` → habilita ganancia real e histórico.
4. Stock + `obtener_stock_bajo()`.
5. Recién ahí, el agente con tool use encima de todo lo anterior.

El agente es la frutilla del postre: primero tienen que existir y ser confiables
los cálculos que va a usar.
