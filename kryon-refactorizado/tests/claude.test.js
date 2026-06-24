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

  it('falls back to an honest placeholder when there is no Anthropic key, without calling the backend', async () => {
    const svc = new ClaudeService('http://localhost:3001');
    const html = await svc.generateAppCode({ name: 'Ana', sector: 'Salud' });
    expect(html).toContain('Demo para Ana');
    expect(html).toContain('marcador de posición');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to the local template when no backend url is configured, even with a key', async () => {
    const svc = new ClaudeService('');
    const html = await svc.generateAppCode({ name: 'Ana', sector: 'Salud' }, 'sk-ant-real');
    expect(html).toContain('Demo para Ana');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends the master password header and the real Anthropic key, and uses the backend response when available', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ html: '<h1>Backend demo</h1>' }) });
    const svc = new ClaudeService('http://localhost:3001');
    svc.setAuthPassword('secret123');
    const html = await svc.generateAppCode({ name: 'Carlos', sector: 'Ecommerce' }, 'sk-ant-real');
    expect(html).toBe('<h1>Backend demo</h1>');
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers['x-admin-password']).toBe('secret123');
    expect(JSON.parse(opts.body).key).toBe('sk-ant-real');
  });

  it('falls back to the local template if the backend call fails', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));
    const svc = new ClaudeService('http://localhost:3001');
    const html = await svc.generateAppCode({ name: 'Lucia', sector: 'Legaltech' }, 'sk-ant-real');
    expect(html).toContain('Demo para Lucia');
  });

  it('caches results per key so identical prompts do not hit the backend twice', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ html: '<h1>Cacheado</h1>' }) });
    const svc = new ClaudeService('http://localhost:3001');
    const client = { name: 'Marta', sector: 'Salud' };
    await svc.generateAppCode(client, 'sk-ant-real');
    await svc.generateAppCode(client, 'sk-ant-real');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
