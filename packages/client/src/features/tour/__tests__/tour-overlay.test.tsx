import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TourOverlay from '../tour-overlay';
import { useTourStore } from '../../../stores/tour-store';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

function resetStore() {
  useTourStore.setState({ active: false, step: 1 });
}

function renderOverlay() {
  return render(
    <MemoryRouter>
      <TourOverlay />
    </MemoryRouter>,
  );
}

describe('TourOverlay', () => {
  beforeEach(resetStore);

  it('renders nothing when tour is inactive', () => {
    renderOverlay();
    expect(screen.queryByTestId('tour-overlay')).toBeNull();
  });

  it('renders overlay when tour is active', () => {
    useTourStore.getState().startTour();
    renderOverlay();
    expect(screen.getByTestId('tour-overlay')).toBeDefined();
  });

  it('shows step counter', () => {
    useTourStore.getState().startTour();
    renderOverlay();
    expect(screen.getByText(/step 1 of 12/i)).toBeDefined();
  });

  it('Next button advances step', () => {
    useTourStore.getState().startTour();
    renderOverlay();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(useTourStore.getState().step).toBe(2);
  });

  it('Back button not shown on first step', () => {
    useTourStore.getState().startTour();
    renderOverlay();
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });

  it('Back button shown on steps > 1', () => {
    useTourStore.setState({ active: true, step: 3 });
    renderOverlay();
    expect(screen.getByRole('button', { name: /back/i })).toBeDefined();
  });

  it('Back button decrements step', () => {
    useTourStore.setState({ active: true, step: 3 });
    renderOverlay();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(useTourStore.getState().step).toBe(2);
  });

  it('shows "Finish Tour" on last step', () => {
    useTourStore.setState({ active: true, step: 12 });
    renderOverlay();
    expect(screen.getByRole('button', { name: /finish tour/i })).toBeDefined();
  });

  it('"Finish Tour" exits tour', () => {
    useTourStore.setState({ active: true, step: 12 });
    renderOverlay();
    fireEvent.click(screen.getByRole('button', { name: /finish tour/i }));
    expect(useTourStore.getState().active).toBe(false);
  });

  it('Close button exits tour', () => {
    useTourStore.getState().startTour();
    renderOverlay();
    fireEvent.click(screen.getByRole('button', { name: /close tour/i }));
    expect(useTourStore.getState().active).toBe(false);
  });

  it('has role=region without aria-modal (non-modal overlay, review-4)', () => {
    useTourStore.getState().startTour();
    renderOverlay();
    const region = screen.getByRole('region');
    expect(region.getAttribute('aria-modal')).toBeNull();
  });

  it('ArrowRight advances step (review-2)', () => {
    useTourStore.getState().startTour();
    renderOverlay();
    expect(useTourStore.getState().step).toBe(1);
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(useTourStore.getState().step).toBe(2);
  });

  it('ArrowLeft goes back a step (review-2)', () => {
    useTourStore.setState({ active: true, step: 3 });
    renderOverlay();
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(useTourStore.getState().step).toBe(2);
  });

  it('ArrowLeft is no-op on first step (review-2)', () => {
    useTourStore.getState().startTour();
    renderOverlay();
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(useTourStore.getState().step).toBe(1);
  });

  it('restores focus to trigger element on exit (review-3)', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open Tour';
    document.body.appendChild(trigger);
    trigger.focus();

    useTourStore.getState().startTour();
    const { unmount } = renderOverlay();

    expect(document.activeElement).not.toBe(trigger);

    unmount();

    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});
