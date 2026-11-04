import { useTranslation } from 'react-i18next';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { Badge } from '~/modules/ui/badge';

interface ProjectReadOnlyBadgeProps {
  projectId: string;
}

/** Tells a guest in the project page header that the project is read only. */
export function ProjectReadOnlyBadge({ projectId }: ProjectReadOnlyBadgeProps) {
  const { t } = useTranslation();
  const isReadOnly = useIsProjectReadOnly(projectId);

  if (!isReadOnly) return null;

  return (
    // The look of the cover's upload button: its edge and translucent fill
    <Badge variant="outline" size="sm" className="border-foreground/20 bg-background/50 dark:bg-background/75 max-sm:hidden">
      {t('c:read_only')}
    </Badge>
  );
}
