import { describe, it, expect, beforeEach } from 'vitest';
import '../js/connections.js';

const { ConnectionsManager, APIQueue, CONNECTIONS_REGISTRY } = window;

describe('ConnectionsManager', () => {
  beforeEach(() => localStorage.clear());

  it('lists all 10 registered connections, none configured by default', () => {
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
