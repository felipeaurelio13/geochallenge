import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Screen } from '../components/Screen';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

function LockHarness({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLockBodyScroll(ref, active);
  return <div ref={ref}>Contenido modal</div>;
}

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

  it('locks and restores body scroll while active', () => {
    const { rerender, unmount } = render(<LockHarness active />);

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.touchAction).toBe('none');
    expect(document.body.style.overscrollBehavior).toBe('none');

    rerender(<LockHarness active={false} />);
    expect(document.body.style.overflow).toBe('');

    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
