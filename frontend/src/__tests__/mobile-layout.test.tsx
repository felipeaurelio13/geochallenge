import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Screen } from '../components/Screen';

describe('mobile layout primitives', () => {
  it('renders Screen with header/content/footer slots', () => {
    render(
      <MemoryRouter initialEntries={['/menu']}>
        <Screen header={<div>Header</div>} footer={<div>Footer</div>}>
          <div>Body</div>
        </Screen>
      </MemoryRouter>
    );

    expect(screen.getByText('Header').parentElement).toHaveClass('screen-header');
    expect(screen.getByText('Body').parentElement).toHaveClass('screen-content');
    expect(screen.getByText('Footer').parentElement).toHaveClass('screen-footer');
  });

  it('renders AppFooter by default when footer prop is not provided outside gameplay routes', () => {
    render(
      <MemoryRouter initialEntries={['/menu']}>
        <Screen>
          <div>Body</div>
        </Screen>
      </MemoryRouter>
    );

    expect(screen.getByText(/v\d+\.\d+\.\d+/i)).toHaveClass('app-footer__version');
  });

  it('does not render global footer on gameplay routes', () => {
    render(
      <MemoryRouter initialEntries={['/game/single']}>
        <Screen>
          <div>Body</div>
        </Screen>
      </MemoryRouter>
    );

    expect(screen.queryByText(/GeoChallenge ©/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/v\d+\.\d+\.\d+/i)).not.toBeInTheDocument();
  });
});
