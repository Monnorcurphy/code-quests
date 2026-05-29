import { describe, it, expect, beforeEach } from 'vitest';
import { useTourStore } from '../tour-store';

function resetStore() {
  useTourStore.setState({ active: false, step: 1 });
}

describe('useTourStore', () => {
  beforeEach(resetStore);

  it('starts inactive at step 1', () => {
    const { active, step, totalSteps } = useTourStore.getState();
    expect(active).toBe(false);
    expect(step).toBe(1);
    expect(totalSteps).toBe(12);
  });

  it('startTour() activates and resets to step 1', () => {
    useTourStore.setState({ step: 5 });
    useTourStore.getState().startTour();
    expect(useTourStore.getState().active).toBe(true);
    expect(useTourStore.getState().step).toBe(1);
  });

  it('nextStep() increments step', () => {
    useTourStore.getState().startTour();
    useTourStore.getState().nextStep();
    expect(useTourStore.getState().step).toBe(2);
  });

  it('nextStep() does not exceed totalSteps', () => {
    useTourStore.setState({ active: true, step: 12 });
    useTourStore.getState().nextStep();
    expect(useTourStore.getState().step).toBe(12);
  });

  it('prevStep() decrements step', () => {
    useTourStore.setState({ active: true, step: 5 });
    useTourStore.getState().prevStep();
    expect(useTourStore.getState().step).toBe(4);
  });

  it('prevStep() does not go below 1', () => {
    useTourStore.setState({ active: true, step: 1 });
    useTourStore.getState().prevStep();
    expect(useTourStore.getState().step).toBe(1);
  });

  it('exitTour() deactivates', () => {
    useTourStore.setState({ active: true });
    useTourStore.getState().exitTour();
    expect(useTourStore.getState().active).toBe(false);
  });

  it('goToStep() sets exact step', () => {
    useTourStore.setState({ active: true, step: 1 });
    useTourStore.getState().goToStep(7);
    expect(useTourStore.getState().step).toBe(7);
  });
});
