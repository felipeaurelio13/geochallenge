import { useTranslation } from 'react-i18next';
import { FullScreenError } from '../components/molecules/FullScreenError';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <FullScreenError
      title={t('notFound.title')}
      message={t('notFound.message')}
      backTo="/menu"
      backLabel={t('notFound.backToMenu')}
    />
  );
}
