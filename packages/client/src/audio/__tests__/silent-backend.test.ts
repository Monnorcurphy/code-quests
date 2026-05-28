import { describe, it, expect, beforeEach } from 'vitest';
import { SilentBackend } from '../silent-backend';

describe('SilentBackend', () => {
  let backend: SilentBackend;

  beforeEach(() => {
    backend = new SilentBackend();
  });

  it('starts with no recorded calls', () => {
    expect(backend.calls).toHaveLength(0);
  });

  it('records preload with event list', async () => {
    await backend.preload(['TOWN', 'COMBAT']);
    expect(backend.calls).toHaveLength(1);
    expect(backend.calls[0]).toEqual({ method: 'preload', args: [['TOWN', 'COMBAT']] });
  });

  it('preload resolves without throwing', async () => {
    await expect(backend.preload(['TOWN'])).resolves.toBeUndefined();
  });

  it('records play with event and opts', () => {
    backend.play('COMBAT', { loop: true, volume: 0.8 });
    expect(backend.calls[0]).toEqual({ method: 'play', args: ['COMBAT', { loop: true, volume: 0.8 }] });
  });

  it('records play without opts', () => {
    backend.play('VICTORY_STINGER');
    expect(backend.calls[0]).toEqual({ method: 'play', args: ['VICTORY_STINGER', undefined] });
  });

  it('records stop', () => {
    backend.stop('TOWN');
    expect(backend.calls[0]).toEqual({ method: 'stop', args: ['TOWN'] });
  });

  it('records stopAll', () => {
    backend.stopAll();
    expect(backend.calls[0]).toEqual({ method: 'stopAll', args: [] });
  });

  it('records setMasterVolume', () => {
    backend.setMasterVolume(0.5);
    expect(backend.calls[0]).toEqual({ method: 'setMasterVolume', args: [0.5] });
  });

  it('records setMuted', () => {
    backend.setMuted(true);
    expect(backend.calls[0]).toEqual({ method: 'setMuted', args: [true] });
  });

  it('records dispose', () => {
    backend.dispose();
    expect(backend.calls[0]).toEqual({ method: 'dispose', args: [] });
  });

  it('accumulates multiple calls in order', () => {
    backend.play('TOWN', { loop: true });
    backend.setMuted(false);
    backend.stopAll();
    expect(backend.calls).toHaveLength(3);
    expect(backend.calls[0].method).toBe('play');
    expect(backend.calls[1].method).toBe('setMuted');
    expect(backend.calls[2].method).toBe('stopAll');
  });

  it('each SilentBackend instance has independent call log', () => {
    const other = new SilentBackend();
    backend.play('BOSS');
    expect(other.calls).toHaveLength(0);
  });
});
