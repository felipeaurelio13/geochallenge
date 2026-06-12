import { useTranslation } from 'react-i18next';
import { Modal } from '../organisms/Modal';
import { Button } from '../atoms/Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reemplazo accesible de window.confirm(): respeta dark mode, es usable en
 * móvil y mantiene el focus trap del Modal. Usar vía useConfirmDialog().
 */
export function ConfirmDialog({
  isOpen,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal.Root isOpen={isOpen} onClose={onCancel}>
      <Modal.Panel>
        <Modal.Title>{message}</Modal.Title>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onConfirm}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </div>
      </Modal.Panel>
    </Modal.Root>
  );
}
