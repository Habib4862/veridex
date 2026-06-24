import { describe, it, expect, beforeEach } from 'vitest';
import '../js/connections.js';

const { ConnectionsManager, APIQueue, CONNECTIONS_REGISTRY } = window;

describe('ConnectionsManager', () => {
  beforeEach(() => localStorage.clear());

  it('lists all registered connections, none configured by default', () => {
    const mgr = new ConnectionsManager(null);
    const list = mgr.list();
    expect(list).toHaveLength(CONNECTIONS_REGISTRY.length);
    expect(list.every(c => c.configured === false)).toBe(true);
  });

  it('marks a connection as configured once a key is stored', () => {
    const mgr = new ConnectionsManager(null);
    mgr.setKey('anthropic', 'sk-test');
    expect(mgr.isConfigured('anthropic')).toBe(true);
    expect(mgr.configuredRatio()).toBeCloseTo(1 / CONNECTIONS_REGISTRY.length);
  });

  it('removing a key un-configures the connection', () => {
    const mgr = new ConnectionsManager(null);
    mgr.setKey('resend', 'r-key');
    mgr.setKey('resend', '');
    expect(mgr.isConfigured('resend')).toBe(false);
  });

  it('reflects the cloud client connected flag', () => {
    expect(new ConnectionsManager({ connected: true }).isCloudConnected()).toBe(true);
    expect(new ConnectionsManager({ connected: false }).isCloudConnected()).toBe(false);
    expect(new ConnectionsManager(null).isCloudConnected()).toBe(false);
  });

  it('validates key format against each integration pattern', () => {
    const mgr = new ConnectionsManager(null);
    expect(mgr.validateFormat('anthropic', 'sk-ant-abc123')).toBe(true);
    expect(mgr.validateFormat('anthropic', 'not-a-key')).toBe(false);
    expect(mgr.validateFormat('resend', 're_abc123')).toBe(true);
    expect(mgr.validateFormat('resend', 'abc123')).toBe(false);
    expect(mgr.validateFormat('stripe', 'sk_test_abcdefghij')).toBe(true);
    expect(mgr.validateFormat('stripe', 'short')).toBe(false);
    expect(mgr.validateFormat('anthropic', '')).toBe(false);
    expect(mgr.validateFormat('ga4', '{"client_email":"a@b.iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----\\n...","property_id":"123456789"}')).toBe(true);
    expect(mgr.validateFormat('ga4', '{"property_id":"123"}')).toBe(false);
    expect(mgr.validateFormat('google_places', 'AIza' + 'a'.repeat(35))).toBe(true);
    expect(mgr.validateFormat('google_places', 'not-a-key')).toBe(false);
  });

  it('reports which integrations support a real live test vs. format-only', () => {
    const mgr = new ConnectionsManager(null);
    expect(mgr.supportsLiveTest('supabase')).toBe(true);
    expect(mgr.supportsLiveTest('resend')).toBe(true);
    expect(mgr.supportsLiveTest('anthropic')).toBe(true);
    expect(mgr.supportsLiveTest('stripe')).toBe(true);
    expect(mgr.supportsLiveTest('meta')).toBe(true);
    expect(mgr.supportsLiveTest('tiktok')).toBe(true);
    expect(mgr.supportsLiveTest('linkedin')).toBe(true);
    expect(mgr.supportsLiveTest('x')).toBe(true);
    expect(mgr.supportsLiveTest('google_ads')).toBe(false);
    expect(mgr.supportsLiveTest('ga4')).toBe(true);
    expect(mgr.supportsLiveTest('google_places')).toBe(true);
    expect(mgr.supportsLiveTest('hunter')).toBe(true);
  });

  it('returns the stored key value via getKey', () => {
    const mgr = new ConnectionsManager(null);
    expect(mgr.getKey('resend')).toBe('');
    mgr.setKey('resend', 're_abc123');
    expect(mgr.getKey('resend')).toBe('re_abc123');
  });
});

describe('APIQueue', () => {
  it('runs tasks respecting the concurrency limit', async () => {
    const queue = new APIQueue(1);
    const order = [];
    const slow = () => new Promise(r => setTimeout(() => { order.push('slow'); r('slow'); }, 20));
    const fast = () => { order.push('fast'); return Promise.resolve('fast'); };
    const p1 = queue.push(slow, 0);
    const p2 = queue.push(fast, 0);
    await Promise.all([p1, p2]);
    expect(order).toEqual(['slow', 'fast']); // concurrency=1 forces FIFO-ish execution
  });

  it('runs higher-priority tasks before lower-priority ones queued at the same time', async () => {
    const queue = new APIQueue(1);
    const order = [];
    const blocked = queue.push(() => new Promise(r => setTimeout(() => { order.push('blocker'); r(); }, 10)), 0);
    const low = () => { order.push('low'); return Promise.resolve(); };
    const high = () => { order.push('high'); return Promise.resolve(); };
    const lowDone = queue.push(low, 0);
    const highDone = queue.push(high, 5);
    await Promise.all([blocked, highDone, lowDone]);
    expect(order[0]).toBe('blocker');
    expect(order.indexOf('high')).toBeLessThan(order.indexOf('low'));
  });
});
