// Utilidades para hablar con Supabase usando la clave de servicio (solo en el servidor)
const U = process.env.SUPABASE_URL, K = String(process.env.SUPABASE_SERVICE_KEY || '');
const A = process.env.SUPABASE_ANON_KEY || K; // clave publishable (pública), para validar el token del usuario
// Las claves nuevas (sb_secret_...) no son JWT: van solo en "apikey". Las legacy (service_role) también como Bearer.
const H = { apikey: K, 'Content-Type': 'application/json' };
if (!K.startsWith('sb_secret_')) H.Authorization = 'Bearer ' + K;
exports.rpc = async (fn, args) => {
  const r = await fetch(`${U}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(args) });
  const t = await r.text();
  return { ok: r.ok, data: t ? JSON.parse(t) : null };
};
exports.userFromToken = async (tok) => {
  const r = await fetch(`${U}/auth/v1/user`, { headers: { apikey: A, Authorization: 'Bearer ' + tok } });
  return r.ok ? r.json() : null;
};
exports.userIdByEmail = async (email) => {
  const r = await fetch(`${U}/rest/v1/profiles?select=id&email=eq.${encodeURIComponent(email.toLowerCase())}`, { headers: H });
  const a = await r.json();
  return (Array.isArray(a) && a[0] && a[0].id) || null;
};
