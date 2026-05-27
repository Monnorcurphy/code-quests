import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './app';

describe('App', () => {
  it('renders the main heading', () => {
    render(<App />);
    const heading = screen.getByRole('heading', { name: 'Code Quests' });
    expect(heading).toBeDefined();
  });

  it('renders a main landmark', () => {
    render(<App />);
    const main = screen.getByRole('main');
    expect(main).toBeDefined();
  });
});
