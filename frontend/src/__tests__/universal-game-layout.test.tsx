import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UniversalGameLayout } from '../components/UniversalGameLayout';

describe('UniversalGameLayout', () => {
  it('usa shell de tres filas sin overlays para header/content/footer', () => {
    render(
      <UniversalGameLayout
        header={<div>Header</div>}
        progress={<div>Progress</div>}
        content={<div>Content</div>}
        footer={<button type="button">Confirmar</button>}
      />
    );

    const layout = screen.getByText('Header').closest('.universal-layout');
    const header = screen.getByTestId('universal-layout-header');
    const content = screen.getByTestId('universal-layout-main');
    const footer = screen.getByTestId('universal-layout-footer');

    expect(layout).toBeInTheDocument();
    expect(header).toContainElement(screen.getByText('Progress'));
    expect(content).toContainElement(screen.getByText('Content'));
    expect(footer).toContainElement(screen.getByRole('button', { name: 'Confirmar' }));
    expect(content.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
