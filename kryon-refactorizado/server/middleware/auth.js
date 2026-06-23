/**
 * auth.js — Autenticación simple con contraseña maestra. El frontend
 * reenvía la misma contraseña usada para entrar a KRYON en la cabecera
 * `x-admin-password` (o `Authorization: Bearer <password>`).
 */
function auth(req, res, next) {
  const header = req.headers['x-admin-password'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const expected = process.env.ADMIN_CODE || 'kryon2026';
  if (!header || header !== expected) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

module.exports = auth;
