import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../js/claude.js';

const { ClaudeService } = window;

describe('ClaudeService.compressPrompt', () => {
  it('strips comments and collapses whitespace', () => {
    const svc = new ClaudeService();
    const compressed = svc.compressPrompt('/* nota */  Hola   mundo\n\n\n<!-- html comment -->fin');
    expect(compressed).toBe('Hola mundo\nfin');
  });
});

describe('ClaudeService.generateAppCode', () => {
  beforeEach(() => { global.fetch = vi.fn(); });

  it('falls back to the local template when no backend url is configured', async () => {
    const svc = new ClaudeService('');
    const html = await svc.generateAppCode({ name: 'Ana', sector: 'Salud' });
    expect(html).toBe('<h1>Demo para Ana</h1>');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends the master password header and uses the backend response when available', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ html: '<h1>Backend demo</h1>' }) });
    const svc = new ClaudeService('http://localhost:3001');
    svc.setAuthPassword('secret123');
    const html = await svc.generateAppCode({ name: 'Carlos', sector: 'Ecommerce' });
    expect(html).toBe('<h1>Backend demo</h1>');
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers['x-admin-password']).toBe('secret123');
  });

  it('falls back to the local template if the backend call fails', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));
    const svc = new ClaudeService('http://localhost:3001');
    const html = await svc.generateAppCode({ name: 'Lucia', sector: 'Legaltech' });
    expect(html).toBe('<h1>Demo para Lucia</h1>');
  });

  it('caches results so identical prompts do not hit the backend twice', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ html: '<h1>Cacheado</h1>' }) });
    const svc = new ClaudeService('http://localhost:3001');
    const client = { name: 'Marta', sector: 'Salud' };
    await svc.generateAppCode(client);
    await svc.generateAppCode(client);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
