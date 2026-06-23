/**
 * routes/crud.js — Factoría de router REST genérico para una tabla de
 * Supabase. Evita repetir el mismo CRUD en projects.js, clients.js,
 * apps.js, opportunities.js y logs.js.
 */
const express = require('express');
const db = require('../lib/supabase');

function createCrudRouter(table) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const { project_id, limit = 50 } = req.query;
      const query = `${project_id ? `project_id=eq.${project_id}&` : ''}order=created_at.desc&limit=${limit}`;
      res.json(await db.list(table, query));
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const created = await db.insert(table, req.body);
      res.status(201).json(created);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.patch('/:id', async (req, res) => {
    try {
      res.json(await db.update(table, req.params.id, req.body));
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await db.remove(table, req.params.id);
      res.status(204).end();
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  return router;
}

module.exports = createCrudRouter;
