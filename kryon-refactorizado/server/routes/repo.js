/**
 * routes/repo.js — Permite al asistente del panel leer y escribir el código
 * fuente real de KRYON: cada escritura es un commit directo (vía la API de
 * contenidos de GitHub) a la rama configurada, que Vercel despliega
 * automáticamente en cuanto llega. Decisión explícita del usuario: sin paso
 * de confirmación intermedio, a cambio de poder pedirle arreglos de código
 * al asistente como si fuera Claude Code.
 *
 * GITHUB_TOKEN/GITHUB_REPO/GITHUB_BRANCH viven solo como variables de
 * entorno de este backend (Vercel) — nunca llegan por la conversación con
 * Claude, igual que ninguna otra clave de API. Todo queda restringido a
 * ROOT_PREFIX (esta misma app) para no poder tocar el resto del repositorio.
 */
const express = require('express');
const router = express.Router();

const ROOT_PREFIX = 'kryon-refactorizado/';

function resolvePath(relPath) {
  const clean = String(relPath || '').replace(/^\/+/, '');
  if (clean.includes('..')) return null;
  return ROOT_PREFIX + clean;
}

function githubHeaders() {
  return {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };
}

function repoConfig(res) {
  if (!process.env.GITHUB_TOKEN) { res.status(500).json({ ok: false, error: 'Falta GITHUB_TOKEN en el backend' }); return null; }
  if (!process.env.GITHUB_REPO) { res.status(500).json({ ok: false, error: 'Falta GITHUB_REPO en el backend' }); return null; }
  return { repo: process.env.GITHUB_REPO, branch: process.env.GITHUB_BRANCH || 'main' };
}

router.post('/read-file', async (req, res) => {
  const cfg = repoConfig(res);
  if (!cfg) return;
  const fullPath = resolvePath(req.body?.path);
  if (!fullPath) return res.status(400).json({ ok: false, error: 'Ruta inválida' });
  try {
    const r = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${fullPath}?ref=${cfg.branch}`, { headers: githubHeaders() });
    const data = await r.json();
    if (!r.ok) return res.json({ ok: false, error: data?.message || `GitHub respondió ${r.status}` });
    res.json({ ok: true, path: req.body.path, content: Buffer.from(data.content, 'base64').toString('utf8'), sha: data.sha });
  } catch {
    res.status(502).json({ ok: false, error: 'No se pudo contactar con GitHub' });
  }
});

router.post('/list-dir', async (req, res) => {
  const cfg = repoConfig(res);
  if (!cfg) return;
  const fullPath = resolvePath(req.body?.path || '') || ROOT_PREFIX.replace(/\/$/, '');
  try {
    const r = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${fullPath}?ref=${cfg.branch}`, { headers: githubHeaders() });
    const data = await r.json();
    if (!r.ok) return res.json({ ok: false, error: data?.message || `GitHub respondió ${r.status}` });
    const entries = (Array.isArray(data) ? data : [data]).map((e) => ({ name: e.name, type: e.type, path: e.path.slice(ROOT_PREFIX.length) }));
    res.json({ ok: true, entries });
  } catch {
    res.status(502).json({ ok: false, error: 'No se pudo contactar con GitHub' });
  }
});

router.post('/write-file', async (req, res) => {
  const cfg = repoConfig(res);
  if (!cfg) return;
  const { content, message } = req.body || {};
  const fullPath = resolvePath(req.body?.path);
  if (!fullPath) return res.status(400).json({ ok: false, error: 'Ruta inválida' });
  if (typeof content !== 'string') return res.status(400).json({ ok: false, error: 'Falta el contenido del archivo' });
  try {
    let sha;
    const existing = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${fullPath}?ref=${cfg.branch}`, { headers: githubHeaders() });
    if (existing.ok) sha = (await existing.json()).sha;

    const r = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${fullPath}`, {
      method: 'PUT',
      headers: githubHeaders(),
      body: JSON.stringify({
        message: message || `Asistente KRYON: actualiza ${req.body.path}`,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch: cfg.branch,
        ...(sha ? { sha } : {})
      })
    });
    const data = await r.json();
    if (!r.ok) return res.json({ ok: false, error: data?.message || `GitHub respondió ${r.status}` });
    res.json({ ok: true, path: req.body.path, commitSha: data.commit?.sha, commitUrl: data.commit?.html_url });
  } catch {
    res.status(502).json({ ok: false, error: 'No se pudo contactar con GitHub' });
  }
});

module.exports = router;
