// IPN de PayPal: valida con PayPal y activa el plan de la cuenta indicada en el campo "custom"
const { rpc } = require('./lib/db');
const PLAN = { '2.50': 'basic', '5.00': 'pro' }; // USD -> plan
exports.handler = async (e) => {
  const raw = e.isBase64Encoded ? Buffer.from(e.body, 'base64').toString() : e.body || '';
  const v = await fetch('https://ipnpb.paypal.com/cgi-bin/webscr', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'cmd=_notify-validate&' + raw,
  });
  if ((await v.text()) !== 'VERIFIED') return { statusCode: 400, body: 'no verificado' };
  const p = Object.fromEntries(new URLSearchParams(raw));
  if (p.txn_type !== 'subscr_payment' || p.payment_status !== 'Completed') return { statusCode: 200, body: 'ignored' };
  if ((p.receiver_email || '').toLowerCase() !== (process.env.PAYPAL_EMAIL || '').toLowerCase() || p.mc_currency !== 'USD')
    return { statusCode: 200, body: 'receptor o moneda inválidos' };
  const kind = PLAN[Number(p.mc_gross).toFixed(2)], uid = p.custom || '';
  if (!kind || !/^[0-9a-f-]{36}$/i.test(uid)) { console.log('IPN SIN DATOS VÁLIDOS', p.txn_id, p.mc_gross, uid); return { statusCode: 200, body: 'datos inválidos' }; }
  const r = await rpc('apply_payment', { pid: p.txn_id, prov: 'paypal', uid, kind });
  return { statusCode: r.ok ? 200 : 500, body: r.ok ? String(r.data) : 'error' };
};
