import '@blocknote/shadcn/style.css';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dispatchCustomEvent } from '~/lib/custom-events';
import { BlockNote } from '~/modules/common/blocknote';
import CreateSubtaskForm from '~/modules/tasks/create-subtask-form';
import { handleEditorFocus, updateImageSourcesFromDataUrl, useHandleUpdateHTML } from '~/modules/tasks/helpers';
import Subtask from '~/modules/tasks/subtask';
import UppyFilePanel from '~/modules/tasks/task-dropdowns/uppy-file-panel';
import { Button } from '~/modules/ui/button';
import { useWorkspaceQuery } from '~/modules/workspaces/helpers/use-workspace';
import type { Mode } from '~/store/theme';
import type { Task } from '~/types/app';
import { env } from '../../../env';
import type { TaskStates } from './types';

interface TaskContentProps {
  task: Task;
  mode: Mode;
  state: TaskStates;
  isSheet?: boolean;
}

const TaskDescription = ({ task, mode, state, isSheet }: TaskContentProps) => {
  const { t } = useTranslation();

  const taskContentRef = useRef<HTMLDivElement>(null);
  const [createSubtask, setCreateSubtask] = useState(false);

  const expandedStyle = 'min-h-16 [&>.bn-editor]:min-h-16 w-full bg-transparent border-none pl-9';

  const {
    data: { members },
  } = useWorkspaceQuery();

  const { handleUpdateHTML } = useHandleUpdateHTML();
  const updateDescription = (html: string) => handleUpdateHTML(task, html, isSheet);

  const onClickOnTask = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const target = e.target;
    if (target instanceof HTMLImageElement) {
      const allImages = Array.from(taskContentRef.current?.querySelectorAll('img') || []);
      const index = allImages.findIndex((img) => img.src === target.src);
      dispatchCustomEvent('openCarousel', {
        slide: index,
        slides: allImages.map((img) => ({ src: img.src })),
      });
    }
  };

  useEffect(() => {
    if (state !== 'expanded') return;
    updateImageSourcesFromDataUrl();
  }, [task.description, state]);

  return (
    <div className="flex flex-col grow gap-2">
      {state === 'folded' ? (
        <div className="mt-1.5 mb-1 ml-1 leading-none inline items-center">
          <div
            // biome-ignore lint/security/noDangerouslySetInnerHtml: is sanitized by backend
            dangerouslySetInnerHTML={{ __html: task.summary }}
            data-color-scheme={mode}
            className="bn-container bn-shadcn leading-none inline"
          />
          <SummaryButtons task={task} />
        </div>
      ) : (
        <>
          {state === 'editing' || state === 'unsaved' ? (
            <BlockNote
              id={`blocknote-${task.id}`}
              members={members}
              defaultValue={task.description}
              className={expandedStyle}
              onFocus={() => handleEditorFocus(task.id)}
              updateData={updateDescription}
              onEnterClick={() => dispatchCustomEvent('changeTaskState', { taskId: task.id, state: 'expanded', sheet: isSheet })}
              onTextDifference={() => {
                dispatchCustomEvent('changeTaskState', { taskId: task.id, state: 'unsaved', sheet: isSheet });
              }}
              filePanel={UppyFilePanel({
                taskId: task.id,
                organizationId: task.organizationId,
                projectId: task.projectId,
              })}
              trailingBlock={false}
              updateDataOnBeforeLoad
            />
          ) : (
            <div ref={taskContentRef} className={`${expandedStyle} bn-container bn-shadcn`} data-color-scheme={mode}>
              <div
                // biome-ignore lint/security/noDangerouslySetInnerHtml: is sanitized by backend
                dangerouslySetInnerHTML={{ __html: task.description }}
                onKeyDown={() => {}}
                onClick={onClickOnTask}
              />
            </div>
          )}

          <div id={`subtask-container-${task.id}`} className="-mx-2 my-1 w-[calc(100%+1.25rem)]">
            <motion.div>
              {task.subtasks.map((task) => (
                <motion.div key={task.id} layout="position" transition={{ duration: 0.3 }}>
                  <Subtask mode={mode} key={task.id} task={task} members={members} />
                </motion.div>
              ))}
            </motion.div>

            <AnimatePresence mode="wait">
              {createSubtask ? (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                  <CreateSubtaskForm setFormState={(value) => setCreateSubtask(value)} parentTask={task} />
                </motion.div>
              ) : (
                <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                  <Button variant="ghost" size="sm" className="w-full pl-11 justify-start rounded-none" onClick={() => setCreateSubtask(true)}>
                    <Plus size={16} />
                    <span className="ml-1 font-normal">{t('app:todo')}</span>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
};

export default TaskDescription;

const SummaryButtons = ({ task }: { task: Task }) => {
  return (
    <>
      {(task.expandable || task.subtasks.length > 0) && (
        <div className="inline gap-1 items-center opacity-80 group-hover/task:opacity-100 group-[.is-focused]/task:opacity-100 -mt-[0.15rem]">
          {task.expandable && <div className="inline-flex px-1 text-sm cursor-pointer py-0 h-5">...</div>}
          {task.subtasks.length > 0 && (
            <div className="inline-flex py-0.5 text-xs h-5 ml-2 gap-[.1rem] cursor-pointer">
              <span className="text-success">{task.subtasks.filter((t) => t.status === 6).length}</span>
              <span className="font-light">/</span>
              <span className="font-light">{task.subtasks.length}</span>
            </div>
          )}
          {/* <Button variant="ghost" size="micro" onClick={() => setIsExpanded(true)} className="inline-flex py-0 h-5 ml-1 gap-[.07rem]">
         <Paperclip size={10} className="transition-transform -rotate-45" />
         <span>3</span>
       </Button> */}
        </div>
      )}
      {/*  in debug mode: show order number to debug drag */}
      {env.VITE_DEBUG_UI && <span className="ml-2 opacity-15 text-sm text-center font-light">#{task.order}</span>}
    </>
  );
};
