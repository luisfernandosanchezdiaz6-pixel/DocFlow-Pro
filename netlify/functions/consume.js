// Descuenta 1 PDF de la cuenta (plan vigente, gratis o crédito extra) ANTES de que el navegador lo entregue
const { rpc, userFromToken } = require('./lib/db');
const J = (c, o) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
exports.handler = async (e) => {
  try {
    if (e.httpMethod !== 'POST') return J(405, { error: 'Método no permitido' });
    const tok = (e.headers.authorization || '').replace(/^Bearer /i, '');
    const u = tok && (await userFromToken(tok));
    if (!u || !u.id) return J(401, { error: 'Inicia sesión' });
    const r = await rpc('consume_pdf', { uid: u.id });
    if (!r.ok) {
      console.log('consume_pdf falló', JSON.stringify(r.data));
      return J(500, { error: 'Error de base de datos', detail: 'Base de datos: ' + ((r.data && (r.data.message || r.data.error)) || 'sin detalle') });
    }
    if (r.data === 'limit') return J(402, { error: 'Límite alcanzado' });
    if (r.data === 'none') return J(403, { error: 'Perfil no encontrado', detail: 'Tu cuenta no tiene perfil. Escribe a soporte o ejecuta el relleno de perfiles en Supabase.' });
    return J(200, { ok: true, via: r.data });
  } catch (err) {
    console.log('consume error', err);
    return J(500, { error: 'Error del servidor', detail: 'Servidor: ' + String((err && err.message) || err) });
  }
};
