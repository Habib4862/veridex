/**
 * server.js — Punto de entrada del backend Express de AXIOM CORE / KRYON.
 * Expone /api/* protegido por contraseña maestra (excepto /api/health),
 * con rate limiting básico y persistencia opcional en Supabase.
 *
 * También sirve el frontend estático (index.html/css/js) desde el mismo
 * proceso: en producción (Vercel) esa parte nunca se ejecuta porque
 * vercel.json ya enruta los estáticos directamente y solo manda /api/* aquí,
 * pero en local o en entornos de un solo puerto (ej. bolt.new) permite
 * levantar todo con un único comando sin montar un servidor estático aparte.
 */
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const auth = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');

const projectsRoute = require('./routes/projects');
const clientsRoute = require('./routes/clients');
const appsRoute = require('./routes/apps');
const opportunitiesRoute = require('./routes/opportunities');
const logsRoute = require('./routes/logs');
const metricsRoute = require('./routes/metrics');
const claudeRoute = require('./routes/claude');
const pushRoute = require('./routes/push');
const connectionsRoute = require('./routes/connections');
const stripeRoute = require('./routes/stripe');
const leadsRoute = require('./routes/leads');
const emailsRoute = require('./routes/emails');
const resendRoute = require('./routes/resend');
const repoRoute = require('./routes/repo');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit);

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'kryon-backend' }));

app.use('/api', auth);
app.use('/api/projects', projectsRoute);
app.use('/api/clients', clientsRoute);
app.use('/api/apps', appsRoute);
app.use('/api/opportunities', opportunitiesRoute);
app.use('/api/logs', logsRoute);
app.use('/api/metrics', metricsRoute);
app.use('/api/claude', claudeRoute);
app.use('/api/push', pushRoute);
app.use('/api/connections', connectionsRoute);
app.use('/api/stripe', stripeRoute);
app.use('/api/leads', leadsRoute);
app.use('/api/emails', emailsRoute);
app.use('/api/resend', resendRoute);
app.use('/api/repo', repoRoute);
app.use('/api', (req, res) => res.status(404).json({ error: 'No encontrado' }));

const FRONTEND_DIR = path.join(__dirname, '..');
app.use(express.static(FRONTEND_DIR));
app.get('*', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));

app.listen(PORT, () => {
  console.log(`KRYON backend escuchando en http://localhost:${PORT}`);
});

module.exports = app;
