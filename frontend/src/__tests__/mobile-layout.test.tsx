import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Screen } from '../components/Screen';

describe('mobile layout primitives', () => {
  it('renders Screen with header/content/footer slots', () => {
    render(
      <Screen header={<div>Header</div>} footer={<div>Footer</div>}>
        <div>Body</div>
      </Screen>
    );

    expect(screen.getByText('Header').parentElement).toHaveClass('screen-header');
    expect(screen.getByText('Body').parentElement).toHaveClass('screen-content');
    expect(screen.getByText('Footer').parentElement).toHaveClass('screen-footer');
  });
});
