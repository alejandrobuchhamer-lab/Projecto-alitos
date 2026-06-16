/* ===================== ALITO'S · Perfil de usuario ===================== */
const { useState: pUseState, useEffect: pUseEffect, useRef: pUseRef } = React;

const ROL_LABEL = { admin: "Administrador", vendedor: "Vendedora", produccion: "Producción" };

function ProfileSheet({ open, onClose, onLogout, user }) {
  const [perfil, setPerfil]     = pUseState(null);
  const [nombre, setNombre]     = pUseState("");
  const [telefono, setTel]      = pUseState("");
  const [bio, setBio]           = pUseState("");
  const [foto, setFoto]         = pUseState(null);
  const [saving, setSaving]     = pUseState(false);
  const [editing, setEditing]   = pUseState(false);
  const fileRef                 = pUseRef(null);
  const toast                   = React.useContext(ToastCtx);

  pUseEffect(() => {
    if (!open) { setEditing(false); return; }
    fetchPerfil().then(p => {
      setPerfil(p);
      setNombre(p.nombre || "");
      setTel(p.telefono || "");
      setBio(p.bio || "");
      setFoto(p.foto || null);
    }).catch(() => {});
  }, [open]);

  function onFotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast("La foto no puede superar 2 MB", "error"); return; }
    const img = new Image();
    const tmpReader = new FileReader();
    tmpReader.onload = ev => { img.src = ev.target.result; };
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxW = 400;
      const scale = img.width > maxW ? maxW / img.width : 1;
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      setFoto(canvas.toDataURL("image/jpeg", 0.80));
      setEditing(true);
    };
    tmpReader.readAsDataURL(file);
  }

  async function guardar() {
    if (!nombre.trim()) { toast("El nombre no puede estar vacío", "error"); return; }
    setSaving(true);
    try {
      const updated = await actualizarPerfil({ nombre: nombre.trim(), telefono, bio, foto });
      setPerfil(updated);
      setEditing(false);
      toast("Perfil actualizado", "success");
    } catch (e) {
      toast(e.message || "Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  const initials = (perfil?.nombre || user?.name || "U")
    .split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const rolLabel = ROL_LABEL[perfil?.rol || user?.rol] || "Usuario";

  return (
    <Sheet open={open} onClose={onClose} title="Mi perfil" icon="👤">
      {/* Foto de perfil */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            width: 88, height: 88, borderRadius: "50%",
            background: foto ? `url(${foto}) center/cover no-repeat` : "var(--amber)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, fontWeight: 800, color: "#fff",
            cursor: "pointer", position: "relative",
            boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
          }}
        >
          {!foto && initials}
          <div style={{
            position: "absolute", bottom: 0, right: 0,
            background: "var(--surface2)", borderRadius: "50%",
            width: 26, height: 26, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 13, border: "2px solid var(--bg)",
          }}>📷</div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFotoChange} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>
            {perfil?.nombre || user?.name || "—"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
            @{perfil?.username || user?.username} · {rolLabel}
          </div>
        </div>
      </div>

      {/* Campos editables */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", marginBottom: 4 }}>Nombre</div>
          <input
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10,
              border: "1.5px solid var(--border)", background: "var(--surface2)",
              color: "var(--text1)", fontSize: 14, outline: "none" }}
            value={nombre}
            onChange={e => { setNombre(e.target.value); setEditing(true); }}
            placeholder="Tu nombre completo"
          />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", marginBottom: 4 }}>Teléfono</div>
          <input
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10,
              border: "1.5px solid var(--border)", background: "var(--surface2)",
              color: "var(--text1)", fontSize: 14, outline: "none" }}
            value={telefono}
            onChange={e => { setTel(e.target.value); setEditing(true); }}
            placeholder="Ej: 11 1234-5678"
            type="tel"
          />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", marginBottom: 4 }}>Bio</div>
          <textarea
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10,
              border: "1.5px solid var(--border)", background: "var(--surface2)",
              color: "var(--text1)", fontSize: 14, outline: "none", resize: "none", fontFamily: "inherit" }}
            rows={3}
            value={bio}
            onChange={e => { setBio(e.target.value.slice(0, 200)); setEditing(true); }}
            placeholder="Algo sobre vos (max 200 caracteres)"
          />
          <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "right", marginTop: 2 }}>{bio.length}/200</div>
        </div>
      </div>

      {/* Botones */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
        {editing && (
          <button
            onClick={guardar}
            disabled={saving}
            style={{
              padding: "13px", borderRadius: 12, border: "none", fontWeight: 700, fontSize: 15,
              background: "var(--amber)", color: "#fff", cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        )}
        <button
          onClick={onLogout}
          style={{
            padding: "12px", borderRadius: 12, border: "1.5px solid #ef4444",
            background: "transparent", color: "#ef4444", fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </Sheet>
  );
}
