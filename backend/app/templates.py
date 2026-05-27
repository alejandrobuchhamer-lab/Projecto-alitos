from pathlib import Path
import jinja2
from fastapi.responses import HTMLResponse

PROJECT_ROOT = Path(__file__).parent.parent.parent
TEMPLATES_DIR = str(PROJECT_ROOT / "frontend" / "templates")

# Usar Jinja2 directamente para evitar bug de cache en Starlette 1.0 + Python 3.14
_env = jinja2.Environment(
    loader=jinja2.FileSystemLoader(TEMPLATES_DIR),
    autoescape=jinja2.select_autoescape(["html"]),
)

# ── Filtros personalizados ──────────────────────────────────────────────────
def _unique_filter(iterable):
    """Equivalente a Python's dict.fromkeys() para preservar orden."""
    seen = set()
    result = []
    for item in iterable:
        key = item if not isinstance(item, dict) else id(item)
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result

_env.filters["unique"] = _unique_filter

# ── Tests personalizados ────────────────────────────────────────────────────
def _in_test(value, sequence):
    """Permite usar: valor is in [lista]  dentro de selectattr/Jinja2."""
    return value in sequence

_env.tests["in"] = _in_test


class _Templates:
    """Wrapper simple que replica la interfaz de Jinja2Templates sin cache problemático."""

    @property
    def env(self):
        return _env

    def TemplateResponse(self, name: str, context: dict, status_code: int = 200) -> HTMLResponse:
        template = _env.get_template(name)
        request = context.get("request")
        # Auto-inject current user from request.state
        if request and "user" not in context:
            context["user"] = getattr(getattr(request, "state", None), "user", None)
        content = template.render(**context)
        return HTMLResponse(content=content, status_code=status_code)


templates = _Templates()

