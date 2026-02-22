import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UniversalGameLayout } from '../components/UniversalGameLayout';

describe('UniversalGameLayout', () => {
  it('mide la altura real del tray y la expone en --action-tray-h', () => {
    class ResizeObserverMock {
      observe = vi.fn();
      disconnect = vi.fn();
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock as unknown as typeof ResizeObserver);

    const offsetHeightSpy = vi
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockImplementation(function mockOffsetHeight(this: HTMLElement) {
        return this.dataset.testid === 'universal-layout-footer' ? 96 : 0;
      });

    render(
      <UniversalGameLayout
        header={<div>Header</div>}
        content={<div>Content</div>}
        footer={<div>Footer</div>}
      />
    );

    const root = screen.getByText('Header').closest('.universal-layout') as HTMLElement | null;
    expect(root?.style.getPropertyValue('--action-tray-h')).toBe('96px');

    offsetHeightSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
