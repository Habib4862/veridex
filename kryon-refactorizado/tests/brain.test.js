import { describe, it, expect } from 'vitest';
import '../js/brain.js';

const { Neuron, Pulse, BrainEngine } = window;

describe('Neuron', () => {
  it('initializes within canvas bounds and bounces off the edges', () => {
    const canvas = { width: 100, height: 100 };
    const n = new Neuron(canvas);
    expect(n.x).toBeGreaterThanOrEqual(0);
    expect(n.x).toBeLessThanOrEqual(100);
    n.x = -5; n.vx = -1;
    n.update(0);
    expect(n.vx).toBe(1); // bounced
  });
});

describe('Pulse', () => {
  it('dies immediately when there are no veins to travel along', () => {
    const p = new Pulse([], { width: 100, height: 100 });
    expect(p.life).toBe(0);
  });

  it('travels along a vein and dies once progress reaches 1', () => {
    const veins = [{ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }];
    const p = new Pulse(veins, { width: 100, height: 100 });
    p.speed = 0.6;
    p.update();
    expect(p.life).toBe(1);
    p.update();
    expect(p.life).toBe(0);
  });
});

describe('BrainEngine.isHealthy', () => {
  it('is unhealthy before init (not running, no neurons)', () => {
    expect(BrainEngine.isHealthy()).toBe(false);
  });

  it('reports healthy once running with neurons present', () => {
    BrainEngine.running = true;
    BrainEngine.neurons = [{}];
    expect(BrainEngine.isHealthy()).toBe(true);
  });
});

describe('BrainEngine.generateVeinPath', () => {
  it('produces seg+1 points between start and end', () => {
    const pts = BrainEngine.generateVeinPath(0, 0, 100, 100, 4);
    expect(pts).toHaveLength(5);
    expect(pts[0].x).toBeGreaterThanOrEqual(-30);
    expect(pts[0].x).toBeLessThanOrEqual(30);
  });
});
