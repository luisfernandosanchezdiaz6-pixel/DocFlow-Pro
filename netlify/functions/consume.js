// Descuenta 1 PDF de la cuenta (plan vigente, gratis o crédito extra) ANTES de que el navegador lo entregue
const { rpc, userFromToken } = require('./lib/db');
const J = (c, o) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
exports.handler = async (e) => {
  if (e.httpMethod !== 'POST') return J(405, { error: 'Método no permitido' });
  const tok = (e.headers.authorization || '').replace(/^Bearer /i, '');
  const u = tok && (await userFromToken(tok));
  if (!u || !u.id) return J(401, { error: 'Inicia sesión' });
  const r = await rpc('consume_pdf', { uid: u.id });
  if (!r.ok) return J(500, { error: 'Error de base de datos' });
  if (r.data === 'limit') return J(402, { error: 'Límite alcanzado' });
  if (r.data === 'none') return J(403, { error: 'Perfil no encontrado' });
  return J(200, { ok: true, via: r.data });
};
