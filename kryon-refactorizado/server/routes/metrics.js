/**
 * routes/metrics.js — Métricas agregadas de un proyecto (no es una tabla,
 * es una vista calculada a partir de opportunities/clients/apps/portfolio).
 */
const express = require('express');
const db = require('../lib/supabase');
const router = express.Router();

router.get('/', async (req, res) => {
  const { project_id } = req.query;
  if (!project_id) return res.status(400).json({ error: 'project_id requerido' });
  try {
    const [opportunities, clients, apps, portfolio] = await Promise.all([
      db.list('opportunities', `project_id=eq.${project_id}&select=id`),
      db.list('clients', `project_id=eq.${project_id}&select=id,stage`),
      db.list('apps', `project_id=eq.${project_id}&select=id,status`),
      db.list('portfolio', `project_id=eq.${project_id}&limit=1`)
    ]);
    res.json({
      opportunities: opportunities.length,
      clients: clients.length,
      apps: apps.length,
      clientsByStage: clients.reduce((acc, c) => { acc[c.stage] = (acc[c.stage] || 0) + 1; return acc; }, {}),
      portfolio: portfolio[0]?.data || null
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
