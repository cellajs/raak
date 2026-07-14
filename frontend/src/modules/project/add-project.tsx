import { ChevronRightIcon, ShrubIcon, SquareMousePointerIcon } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Organization } from 'sdk';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { UnsavedBadge } from '~/modules/common/unsaved-badge';
import { CreateProjectForm } from '~/modules/project/create-project-form';
import { SelectProjectForm } from '~/modules/project/select-project-form';
import { ToggleGroup, ToggleGroupItem } from '~/modules/ui/toggle-group';

interface AddProjectsProps {
  organization?: Organization | null;
  callback?: () => void;
  dialog?: boolean;
  mode?: 'create' | 'select' | null;
}

const AddProjects = ({ mode: baseMode }: AddProjectsProps) => {
  //organization, callback, dialog: isDialog,
  const { t } = useTranslation();

  const [createMode, setCreateMode] = useState(baseMode);

  const updateMode = (mode: string | string[]) => {
    const baseTitle = t('c:add_resource', { resource: t('c:project').toLowerCase() });

    // If mode is empty, go back to initial state
    const modes = Array.isArray(mode) ? mode : [mode];
    modes[0] ? setCreateMode(modes[0] as 'create' | 'select') : setCreateMode(null);

    // Update dialog title
    useDialoger.getState().update('create-project', {
      titleContent: (
        <div className="flex items-center gap-2 max-sm:justify-center">
          {mode[0] ? (
            <button type="button" aria-label="Go back" onClick={() => updateMode([])}>
              {baseTitle}
            </button>
          ) : (
            <div className="flex items-center gap-2 max-sm:justify-center">
              <UnsavedBadge title={baseTitle} />
            </div>
          )}
          <AnimatePresence>
            {mode[0] && (
              <motion.span
                className="flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              >
                <ChevronRightIcon className="opacity-50" />
                <UnsavedBadge title={mode[0] === 'select' ? t('c:select') : t('c:create')} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      ),
    });
  };

  return (
    <MotionConfig transition={{ type: 'spring', bounce: 0, duration: 0.4 }}>
      <AnimatePresence mode="popLayout">
        {!createMode && (
          <motion.div
            key="initial"
            initial={{ x: 0, scale: 0.9, opacity: 0 }}
            animate={{ x: 0, scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <ToggleGroup
              type="multiple"
              onValueChange={updateMode}
              className="w-full items-stretch gap-2 py-3 max-sm:flex-col sm:h-40 sm:gap-3"
            >
              <ToggleGroupItem
                size="tile"
                variant="tile"
                value="create"
                aria-label="Create project"
                className="w-auto grow py-6 sm:py-10"
                id="create-project-option"
              >
                <ShrubIcon className="size-12" strokeWidth={1} />
                <div className="flex flex-col truncate pl-3">
                  <p className="">{t('c:create_project.text')}</p>
                  <div className="mt-1 flex flex-row items-center truncate opacity-50 transition-opacity group-hover:opacity-100">
                    <strong>{t('c:continue')}</strong>
                    <ChevronRightIcon className="ml-1" />
                  </div>
                </div>
              </ToggleGroupItem>
              <ToggleGroupItem
                size="tile"
                variant="tile"
                value="select"
                aria-label="Select project"
                className="w-auto grow py-6 sm:py-10"
              >
                <SquareMousePointerIcon className="size-12" strokeWidth={1} />
                <div className="flex flex-col truncate pl-3">
                  <div className="">{t('c:select_project')}</div>
                  <div className="mt-1 flex flex-row items-center truncate opacity-50 transition-opacity group-hover:opacity-100">
                    <strong>{t('c:continue')}</strong>
                    <ChevronRightIcon className="ml-1" />
                  </div>
                </div>
              </ToggleGroupItem>
            </ToggleGroup>
          </motion.div>
        )}
        {createMode && (
          <motion.div
            key="add-form"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col gap-4"
          >
            {createMode === 'create' ? <CreateProjectForm dialog /> : <SelectProjectForm dialog />}
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
};

export { AddProjects };
