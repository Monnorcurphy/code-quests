import { describe, it, expect } from 'vitest';
import { app } from './index';

describe('app', () => {
  it('exports an express application', () => {
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
  });

  it('has a /health route registered', () => {
    const routes = app._router?.stack
      .filter((layer: { route?: { path: string } }) => layer.route)
      .map((layer: { route: { path: string } }) => layer.route.path);
    expect(routes).toContain('/health');
  });
});
