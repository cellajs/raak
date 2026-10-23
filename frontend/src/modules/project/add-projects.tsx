import { ChevronRightIcon, ShrubIcon, SquareMousePointerIcon } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dialoger } from '~/modules/common/dialoger/use-dialoger';
import type { IconComponent } from '~/modules/common/icons/types';
import { UnsavedBadge } from '~/modules/common/unsaved-badge';
import { CreateProjectForm } from '~/modules/project/create-project-form';
import { SelectProjectForm } from '~/modules/project/select-project-form';
import { ToggleGroup, ToggleGroupItem } from '~/modules/ui/toggle-group';

interface AddProjectsProps {
  mode?: 'create' | 'select';
}

interface AddProjectsOptionProps {
  value: 'create' | 'select';
  icon: IconComponent;
  label: string;
  ariaLabel: string;
}

function AddProjectsOption({ value, icon: Icon, label, ariaLabel }: AddProjectsOptionProps) {
  const { t } = useTranslation();

  return (
    <ToggleGroupItem size="tile" variant="tile" value={value} aria-label={ariaLabel} className="w-auto grow py-6 sm:py-10">
      <Icon className="size-12" strokeWidth={1} />
      <div className="flex flex-col truncate pl-3">
        <p>{label}</p>
        <div className="mt-1 flex items-center truncate opacity-50 transition-opacity group-hover/toggle:opacity-100">
          <strong>{t('c:continue')}</strong>
          <ChevronRightIcon className="ml-1" />
        </div>
      </div>
    </ToggleGroupItem>
  );
}

interface AddProjectsTitleProps {
  mode: 'create' | 'select' | null;
  onBack: () => void;
}

function AddProjectsTitle({ mode, onBack }: AddProjectsTitleProps) {
  const { t } = useTranslation();
  const baseTitle = t('c:add_resource', { resource: t('c:project').toLowerCase() });

  return (
    <div className="flex items-center gap-2 max-sm:justify-center">
      {mode ? (
        <button type="button" aria-label={t('c:back')} onClick={onBack}>
          {baseTitle}
        </button>
      ) : (
        <UnsavedBadge title={baseTitle} />
      )}
      <AnimatePresence>
        {mode && (
          <motion.span
            className="flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          >
            <ChevronRightIcon className="opacity-50" />
            <UnsavedBadge title={mode === 'select' ? t('c:select') : t('c:create')} />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AddProjects({ mode: baseMode }: AddProjectsProps) {
  const { t } = useTranslation();

  const [createMode, setCreateMode] = useState<'create' | 'select' | null>(baseMode ?? null);

  const updateMode = (mode: string | string[]) => {
    const nextMode = mode === 'create' || mode === 'select' ? mode : null;
    setCreateMode(nextMode);

    dialoger.getState().update('create-project', { titleContent: <AddProjectsTitle mode={nextMode} onBack={() => updateMode('')} /> });
  };

  return (
    <MotionConfig reducedMotion="user" transition={{ type: 'spring', bounce: 0, duration: 0.4 }}>
      <AnimatePresence mode="popLayout">
        {!createMode && (
          <motion.div
            key="initial"
            initial={{ x: 0, scale: 0.9, opacity: 0 }}
            animate={{ x: 0, scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <ToggleGroup type="single" onValueChange={updateMode} className="w-full items-stretch gap-2 py-3 max-sm:flex-col sm:h-40 sm:gap-3">
              <AddProjectsOption
                value="create"
                icon={ShrubIcon}
                label={t('c:create_project.text')}
                ariaLabel={t('c:create_resource', { resource: t('c:project').toLowerCase() })}
              />
              <AddProjectsOption
                value="select"
                icon={SquareMousePointerIcon}
                label={t('c:select_project')}
                ariaLabel={t('c:select_resource', { resource: t('c:project').toLowerCase() })}
              />
            </ToggleGroup>
          </motion.div>
        )}
        {createMode && (
          <motion.div key="add-form" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col gap-4">
            {createMode === 'create' ? <CreateProjectForm /> : <SelectProjectForm />}
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
