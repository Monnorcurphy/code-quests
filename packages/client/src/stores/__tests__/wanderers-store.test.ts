import { describe, it, expect, beforeEach } from 'vitest';
import { useWanderersStore } from '../wanderers-store';

describe('useWanderersStore', () => {
  beforeEach(() => {
    useWanderersStore.setState({ idleAdventurers: [] });
  });

  it('starts with an empty idle list', () => {
    expect(useWanderersStore.getState().idleAdventurers).toEqual([]);
  });

  it('setIdleAdventurers replaces the list', () => {
    useWanderersStore.getState().setIdleAdventurers([
      { id: 'a1', name: 'Aria' },
      { id: 'a2', name: 'Borin' },
    ]);
    const list = useWanderersStore.getState().idleAdventurers;
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe('Aria');
  });

  it('skips updates when the list is structurally unchanged (referential stability)', () => {
    useWanderersStore.getState().setIdleAdventurers([{ id: 'a1', name: 'Aria' }]);
    const first = useWanderersStore.getState().idleAdventurers;
    useWanderersStore.getState().setIdleAdventurers([{ id: 'a1', name: 'Aria' }]);
    const second = useWanderersStore.getState().idleAdventurers;
    expect(second).toBe(first);
  });

  it('emits a new reference when names change', () => {
    useWanderersStore.getState().setIdleAdventurers([{ id: 'a1', name: 'Aria' }]);
    const first = useWanderersStore.getState().idleAdventurers;
    useWanderersStore.getState().setIdleAdventurers([{ id: 'a1', name: 'Aria the Bold' }]);
    const second = useWanderersStore.getState().idleAdventurers;
    expect(second).not.toBe(first);
    expect(second[0].name).toBe('Aria the Bold');
  });
});
