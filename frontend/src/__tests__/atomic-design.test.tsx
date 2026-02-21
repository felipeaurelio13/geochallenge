import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Badge, Button, FormField, Header, Input, Modal, PageTemplate } from '../components';

const routerFutureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

describe('Atomic design components', () => {
  it('renderiza átomos reutilizables con estilos base', () => {
    render(
      <>
        <Button>Acción</Button>
        <Input placeholder="correo" />
        <Badge tone="primary">Nuevo</Badge>
      </>
    );

    expect(screen.getByRole('button', { name: 'Acción' })).toHaveClass('bg-primary');
    expect(screen.getByPlaceholderText('correo')).toHaveClass('rounded-xl');
    expect(screen.getByText('Nuevo')).toHaveClass('rounded-full');
  });

  it('evita prop drilling en FormField usando compound components', () => {
    render(
      <form>
        <FormField.Root id="email" error="Campo inválido">
          <FormField.Label>Email</FormField.Label>
          <FormField.Input name="email" />
        </FormField.Root>
      </form>
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('id', 'email');
    expect(input).toHaveClass('border-red-500/70');
    expect(screen.getByText('Campo inválido')).toBeInTheDocument();
  });

  it('compone template + organisms para layout de página mobile-first', () => {
    const onClose = vi.fn();

    render(
      <MemoryRouter future={routerFutureConfig}>
        <PageTemplate
          header={<Header actions={<Button size="sm">Salir</Button>} />}
        >
          <Modal.Root isOpen onClose={onClose}>
            <Modal.Panel>
              <p>Contenido modal</p>
              <Modal.CloseButton>Cerrar modal</Modal.CloseButton>
            </Modal.Panel>
          </Modal.Root>
        </PageTemplate>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument();
    expect(screen.getByText('Contenido modal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar modal' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mantiene estructura sin scroll global accidental y safe-area en header mobile', () => {
    const { container } = render(
      <MemoryRouter future={routerFutureConfig}>
        <PageTemplate header={<Header />}>
          <div>Contenido</div>
        </PageTemplate>
      </MemoryRouter>
    );

    expect(container.firstChild).toHaveClass('app-shell');
    expect(screen.getByRole('banner').className).toContain('safe-area-inset-top');
    expect(container.querySelector('main')?.className).toContain('flex-1');
  });
});
