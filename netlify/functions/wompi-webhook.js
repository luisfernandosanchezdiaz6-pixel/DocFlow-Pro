// Webhook de Wompi: activa plan o suma un crédito cuando una transacción queda APROBADA
const crypto = require('crypto');
const { rpc, userIdByEmail } = require('./lib/db');
// Monto en centavos de COP -> qué se compró. Si cambias un precio en Wompi, cámbialo aquí.
const KIND = { 999900: 'basic', 1990000: 'pro', 200000: 'extra' };
exports.handler = async (e) => {
  let b; try { b = JSON.parse(e.body); } catch { return { statusCode: 400, body: 'bad request' }; }
  const sig = b.signature || {}, t = b.data && b.data.transaction;
  if (!t) return { statusCode: 200, body: 'ignored' };
  // Verificación de firma (SHA256 de las propiedades + timestamp + secreto de eventos)
  const base = (sig.properties || []).map((p) => p.split('.').reduce((o, k) => (o ? o[k] : undefined), b.data)).join('')
    + b.timestamp + process.env.WOMPI_EVENTS_SECRET;
  if (crypto.createHash('sha256').update(base).digest('hex') !== sig.checksum) return { statusCode: 401, body: 'firma inválida' };
  if (b.event !== 'transaction.updated' || t.status !== 'APPROVED') return { statusCode: 200, body: 'ignored' };
  const kind = KIND[t.amount_in_cents];
  if (!kind) { console.log('MONTO DESCONOCIDO', t.id, t.amount_in_cents); return { statusCode: 200, body: 'monto desconocido' }; }
  const uid = await userIdByEmail(t.customer_email || '');
  if (!uid) { console.log('PAGO SIN CUENTA (revisar a mano):', t.id, t.customer_email, kind); return { statusCode: 200, body: 'sin cuenta' }; }
  const r = await rpc('apply_payment', { pid: String(t.id), prov: 'wompi', uid, kind });
  return { statusCode: r.ok ? 200 : 500, body: r.ok ? String(r.data) : 'error' };
};
