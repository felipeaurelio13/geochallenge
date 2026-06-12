import { useCallback, useState } from 'react';
import { ConfirmDialog } from '../components/molecules/ConfirmDialog';

interface PendingConfirm {
  message: string;
  resolve: (confirmed: boolean) => void;
}

/**
 * Confirmación con la misma ergonomía que window.confirm pero con UI propia:
 *
 *   const { confirm, confirmDialog } = useConfirmDialog();
 *   ...
 *   if (await confirm(t('game.confirmExit'))) navigate('/menu');
 *   ...
 *   return (<>{confirmDialog}<RestoDeLaPagina /></>);
 */
export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (message: string) =>
      new Promise<boolean>((resolve) => {
        setPending({ message, resolve });
      }),
    []
  );

  const settle = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  const confirmDialog = (
    <ConfirmDialog
      isOpen={pending !== null}
      message={pending?.message ?? ''}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, confirmDialog };
}
