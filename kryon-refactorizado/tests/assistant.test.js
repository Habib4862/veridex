import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../js/assistant.js';

const { AssistantService } = window;

describe('AssistantService', () => {
  it('exposes the tool definitions and system prompt as static getters', () => {
    const names = AssistantService.tools.map((t) => t.name);
    expect(AssistantService.tools.length).toBeGreaterThan(0);
    expect(names).toContain('get_panel_status');
    expect(names).toContain('set_theme');
    expect(names).toContain('set_agents_enabled');
    expect(names).toContain('add_watchlist');
    expect(names).toContain('remove_watchlist');
    expect(names).toContain('opt_out_client');
    expect(names).toContain('switch_project');
    expect(names).toContain('create_project');
    expect(AssistantService.systemPrompt).toContain('Anthropic/Resend/Stripe');
  });

  it('never exposes a tool that could read or set an API key/credential', () => {
    const names = AssistantService.tools.map((t) => t.name);
    expect(names.some((n) => /key|password|credential/i.test(n))).toBe(false);
  });

  describe('send', () => {
    beforeEach(() => { global.fetch = vi.fn(); });

    it('throws without calling the backend if no backend url is configured', async () => {
      const svc = new AssistantService('');
      await expect(svc.send([{ role: 'user', content: 'hola' }], 'sk-ant-real')).rejects.toThrow('backend');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('throws without calling the backend if no Anthropic key is given', async () => {
      const svc = new AssistantService('http://localhost:3001');
      await expect(svc.send([{ role: 'user', content: 'hola' }], '')).rejects.toThrow('Anthropic');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('sends the master password header, the messages, tools and system prompt, and returns the raw response', async () => {
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'hola' }] }) });
      const svc = new AssistantService('http://localhost:3001');
      svc.setAuthPassword('secret123');
      const messages = [{ role: 'user', content: 'hola' }];
      const data = await svc.send(messages, 'sk-ant-real');
      expect(data.content[0].text).toBe('hola');
      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe('http://localhost:3001/api/claude/chat');
      expect(opts.headers['x-admin-password']).toBe('secret123');
      const body = JSON.parse(opts.body);
      expect(body.key).toBe('sk-ant-real');
      expect(body.messages).toEqual(messages);
      expect(body.tools).toEqual(AssistantService.tools);
      expect(body.system).toBe(AssistantService.systemPrompt);
    });

    it('throws the backend error message when the request fails', async () => {
      global.fetch.mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: 'Anthropic respondió 529' }) });
      const svc = new AssistantService('http://localhost:3001');
      await expect(svc.send([{ role: 'user', content: 'hola' }], 'sk-ant-real')).rejects.toThrow('Anthropic respondió 529');
    });
  });
});
