import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './app';

function renderApp(initialPath = '/town') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  it('renders the town page at /town', () => {
    renderApp('/town');
    expect(screen.getByRole('heading', { name: 'The Town', level: 1 })).toBeDefined();
  });

  it('redirects unknown routes to /town', () => {
    renderApp('/unknown-route');
    expect(screen.getByRole('heading', { name: 'The Town', level: 1 })).toBeDefined();
  });

  it('renders a main landmark', () => {
    renderApp();
    expect(screen.getByRole('main')).toBeDefined();
  });
});
