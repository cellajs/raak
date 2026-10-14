import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDownIcon, TagIcon, UserXIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { type UseFormProps, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Attachment } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { useDraftStore } from '~/modules/common/form-draft/draft-store';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { BlockNoteContentFormField as BlockNoteContent } from '~/modules/common/form-fields/blocknote';
import { Spinner } from '~/modules/common/spinner';
import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import { usePrimaryLabels } from '~/modules/label/use-primary-labels';
import { useProjectMembers } from '~/modules/project/use-project-members';
import { cachedTasks } from '~/modules/task/helpers/active-task';
import {
  closeCreateTaskForm,
  createTaskFormSchema,
  type NewTaskFormValues,
  newTaskFormDefaults,
  newTaskFormIsDirty,
} from '~/modules/task/helpers/create-task';
import { focusTask } from '~/modules/task/helpers/focus-task';
import { getNewTaskOrder } from '~/modules/task/helpers/order-helpers';
import { handleTaskDropdownClick } from '~/modules/task/helpers/task-dropdown';
import { useTaskFilePanelProps } from '~/modules/task/hooks/use-task-file-panel-props';
import { useUploadAttachments } from '~/modules/task/hooks/use-upload-attachments';
import { useTaskCreateMutation } from '~/modules/task/query';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { statusOptionsByValue, TaskStatus } from '~/modules/task/task-properties';
import type { Task, TaskStatusType } from '~/modules/task/types';
import { AvatarGroup, AvatarGroupList, AvatarOverflowIndicator } from '~/modules/ui/avatar';
import { Button, buttonVariants } from '~/modules/ui/button';
import { Chip } from '~/modules/ui/chip';
import { Form, FormControl, FormField, FormItem, FormMessage } from '~/modules/ui/field';
import { ToggleGroup, ToggleGroupItem } from '~/modules/ui/toggle-group';
import { useCurrentUser } from '~/modules/user/user-store';
import { COALESCED } from '~/query/offline/prepared-mutation';
import { cn } from '~/utils/cn';

const exitDurationS = 0.3;
const exitFallbackMs = exitDurationS * 1000 + 200;

interface CreateTaskFormProps {
  projectId: string;
  organizationId: string;
  className?: string;
  dialog?: boolean;
  onSuccess?: (task: Task) => void;
  onStatusChange?: (status: TaskStatusType) => void;
}

function CreateTaskForm({ projectId, organizationId, className, dialog: isDialog, onSuccess, onStatusChange }: CreateTaskFormProps) {
  const { t } = useTranslation();
  const user = useCurrentUser();

  const { tenantId } = useOrganizationLayoutContext();

  const isMobile = useBreakpointBelow('sm');
  const setForm = useDraftStore((state) => state.setForm);

  const formId = `create-task-${projectId}`;
  const isFocused = useTaskInteractionStore((s) => s.focusedTaskId === formId);

  const [defaultId] = useState(generateId());
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [editorKey, setEditorKey] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const pendingCloseRef = useRef(false);

  const projectMembers = useProjectMembers(projectId, tenantId, organizationId);
  const { attachmentsCreationCallback } = useUploadAttachments();

  const taskMutation = useTaskCreateMutation(tenantId, organizationId);

  const formOptions: UseFormProps<NewTaskFormValues> = useMemo(
    () => ({ resolver: zodResolver(createTaskFormSchema), defaultValues: { ...newTaskFormDefaults, id: defaultId, projectId } }),
    [],
  );

  // Form with draft in local storage
  const form = useFormWithDraft<NewTaskFormValues>(formId, { formOptions });

  // Subscribe for render: the form only re-renders when isDirty *toggles*, so
  // render-time form.getValues() reads of these fields go stale once dirty
  const watchedStatus = useWatch({ control: form.control, name: 'status' });

  // Default the primary label to the project's first entry once the set has loaded
  const primaryLabels = usePrimaryLabels(projectId);
  const watchedPrimaryLabelId = useWatch({ control: form.control, name: 'primaryLabelId' });
  useEffect(() => {
    if (!watchedPrimaryLabelId && primaryLabels[0]) form.setValue('primaryLabelId', primaryLabels[0].id);
  }, [watchedPrimaryLabelId, primaryLabels, form.setValue]);

  // Field watchers key the JSON-based dirty check to relevant changes.
  const [watchedAssignedTo, watchedLabels, watchedDescription] = useWatch({ control: form.control, name: ['assignedTo', 'labels', 'description'] });
  const isDirty = form.isDirty && newTaskFormIsDirty({ assignedTo: watchedAssignedTo, labels: watchedLabels, description: watchedDescription });

  const baseFilePanelProps = useTaskFilePanelProps(projectId, tenantId, organizationId, setAttachments);

  const handleCloseForm = () => {
    if (isDialog) useDialoger.getState().remove();
    else closeCreateTaskForm(projectId);
  };

  // Runs once per submit, from the exit animation or its timeout fallback: the form can unmount mid-exit
  // (the virtualized list re-sorts as the new task lands) and an unmounted motion.div never completes.
  const closeAfterExit = () => {
    if (!pendingCloseRef.current) return;
    pendingCloseRef.current = false;
    handleCloseForm();
  };

  const onSubmit = async (values: NewTaskFormValues) => {
    if (pendingCloseRef.current) return;
    const tasks = cachedTasks();

    // Only add user if task start and it's not already assigned
    const fullAssignedTo =
      values.status === TaskStatus.Started ? [...new Map([user, ...values.assignedTo].map((u) => [u.id, u])).values()] : values.assignedTo;

    const newTask = {
      // Task variables
      ...values,
      id: defaultId,
      // Empty until primaries load; the server then falls back to the project default
      primaryLabelId: values.primaryLabelId || undefined,
      labels: values.labels.map(({ id }) => id),
      assignedTo: fullAssignedTo.map(({ id }) => id),
      displayOrder: getNewTaskOrder(values.status, tasks, projectId),
      // Mutation variables
      fullLabels: values.labels,
      fullAssignedTo,
    };

    // Resetting to the submitted values clears the stored draft and its badge now, while the values stay visible
    // through the exit animation; a failed create restores the draft in the catch below.
    form.reset(values);
    pendingCloseRef.current = true;
    setIsExiting(true);
    setTimeout(closeAfterExit, exitFallbackMs);

    // Persist the stashed upload rows; task linkage rides the description's attachmentId props.
    if (attachments.length) {
      attachmentsCreationCallback({ organizationId, tenantId, projectId })(attachments);
    }

    // Backend handles label usedCount side-effects atomically
    await taskMutation
      .mutateAsync(newTask)
      // Creates never coalesce, so this always resolves to the created tasks; the guard narrows the type.
      .then((createdTasks) => createdTasks !== COALESCED && onSuccess?.(createdTasks[0]))
      .catch(() => {
        const { description, status, fullLabels: labels, fullAssignedTo: assignedTo } = newTask;
        setForm(formId, { description, status, primaryLabelId: values.primaryLabelId, labels, assignedTo });
      });
  };

  const handleStatusChange = (onChange: (status: TaskStatusType) => void) => (status: TaskStatusType) => {
    flushSync(() => onChange(status));
    setTimeout(() => onStatusChange?.(status));
  };

  const handleFormClick = () => {
    if (isDialog || isFocused || isMobile) return;
    focusTask(formId);
  };

  if (form.loading) return null;

  return (
    <motion.div
      animate={isExiting ? { height: 0, opacity: 0 } : { height: 'auto', opacity: 1 }}
      transition={{ duration: exitDurationS, ease: 'easeInOut' }}
      onAnimationComplete={closeAfterExit}
      className={cn(isExiting && 'overflow-hidden', isDialog && 'flex min-h-0 grow flex-col')}
    >
      <Form {...form}>
        <form
          id={formId}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: to handle focus on tasks change by hotkeys
          tabIndex={0}
          onClick={handleFormClick}
          onKeyDown={() => {}}
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(
            className,
            'flex flex-col gap-2 sm:p-3 sm:pl-11',
            isDialog && 'min-h-0 grow',
            !isDialog &&
              'relative border-b before:pointer-events-none before:absolute before:inset-y-0 before:left-px before:w-[3px] before:rounded-full before:bg-primary before:opacity-0',
            !isDialog && isFocused && 'before:opacity-100',
            isFocused ? 'is-focused focus-visible:outline-none focus-visible:ring-0' : 'focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          <Suspense fallback={<Spinner className="my-16 h-6 w-6 opacity-50" noDelay />}>
            <BlockNoteContent
              key={editorKey}
              control={form.control}
              name="description"
              containerClassName={isDialog ? 'grow min-h-0' : undefined}
              baseBlockNoteProps={{
                id: `blocknote-${defaultId}`,
                editable: isFocused || isDialog,
                // Tasks open for editing on a single click, Google Keep style: no toolbar on a text selection.
                formattingToolbar: false,
                members: projectMembers,
                className: cn('min-h-16 [&>.bn-editor]:min-h-16', isDialog && 'grow [&>.bn-editor]:grow'),
                baseFilePanelProps,
                trailingBlock: false,
                onEnterClick: form.handleSubmit(onSubmit),
              }}
            />
          </Suspense>

          <FormField
            control={form.control}
            name="primaryLabelId"
            render={({ field: { value, onChange } }) => {
              return (
                <FormItem>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      variant="merged"
                      className="w-full gap-0"
                      value={value}
                      onValueChange={(newValue: string | string[]) => {
                        if (typeof newValue === 'string' && newValue) onChange(newValue);
                      }}
                    >
                      {primaryLabels.map((label) => (
                        <ToggleGroupItem tabIndex={0} size="sm" value={label.id} className="group min-w-0 flex-1 shrink font-normal" key={label.id}>
                          <PrimaryLabelIcon label={label} />
                          <span className="ml-2 min-w-0 truncate opacity-75 group-data-pressed:font-medium group-data-pressed:opacity-100">
                            {label.name}
                          </span>
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="labels"
            render={({ field: { onChange, value: labels } }) => {
              return (
                <FormItem>
                  <div
                    className={cn(
                      buttonVariants({ variant: 'input', size: 'sm', press: false }),
                      'relative flex h-auto min-h-9 w-full justify-start py-1 hover:bg-accent/20',
                    )}
                  >
                    <FormControl>
                      <button
                        type="button"
                        aria-label={t('c:set_resource', { resource: t('c:label_other').toLowerCase() })}
                        id={`labels-${formId}`}
                        className="focus-effect absolute inset-0 rounded-md"
                        onClick={({ currentTarget }) =>
                          handleTaskDropdownClick({
                            dropdownType: 'labels',
                            value: labels,
                            projectId,
                            onChange,
                            triggerId: currentTarget.id,
                            triggerRef: { current: currentTarget },
                            triggerWidth: currentTarget.clientWidth,
                          })
                        }
                      />
                    </FormControl>
                    <div className="pointer-events-none relative flex min-w-0 flex-wrap items-center gap-1 font-normal">
                      {labels.length > 0 ? (
                        labels.map(({ name, id }) => (
                          <Chip
                            key={id}
                            onRemove={() => onChange(labels.filter((l) => l.id !== id))}
                            removeLabel={t('c:remove_resource', { resource: name })}
                          >
                            {name}
                          </Chip>
                        ))
                      ) : (
                        <>
                          <TagIcon className="opacity-75" />
                          <span className="opacity-75">{t('c:select_resource', { resource: t('c:label_other').toLowerCase() })}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="assignedTo"
            render={({ field: { onChange, value } }) => {
              return (
                <FormItem>
                  <FormControl>
                    <Button
                      aria-label={t('c:assign_to')}
                      variant="input"
                      size="sm"
                      className="relative flex justify-start"
                      id={`assignedTo-${formId}`}
                      type="button"
                      onClick={({ currentTarget }) =>
                        handleTaskDropdownClick({
                          dropdownType: 'assignedTo',
                          value,
                          projectId,
                          onChange,
                          triggerId: currentTarget.id,
                          triggerRef: { current: currentTarget },
                          triggerWidth: currentTarget.clientWidth,
                        })
                      }
                    >
                      {value.length ? (
                        <>
                          <AvatarGroup limit={3}>
                            <AvatarGroupList>
                              {value.map((user) => (
                                <EntityAvatar
                                  type="user"
                                  key={user.id}
                                  id={user.id}
                                  name={user.name}
                                  url={user.thumbnailUrl}
                                  className="h-6 w-6 text-xs"
                                />
                              ))}
                            </AvatarGroupList>
                            <AvatarOverflowIndicator className="h-6 w-6 text-xs" />
                          </AvatarGroup>
                          <span className="truncate">
                            {value.length === 0 && t('c:assign_to')}
                            {value.length === 1 && value[0].name}
                            {value.length === 2 && value.map(({ name }) => name).join(', ')}
                            {value.length > 2 && t('c:count_assigned', { count: value.length })}
                          </span>
                        </>
                      ) : (
                        <>
                          <UserXIcon className="h-4 w-4 opacity-75" /> <span className="font-normal opacity-75">{t('c:assign_to')}</span>
                        </>
                      )}
                    </Button>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <div className="flex flex-col gap-2 py-2 sm:flex-row">
            <div className="[&:not(.absolute)]:active:press flex">
              <Button type="submit" disabled={!isDirty} press={false} className="grow rounded-none rounded-l">
                <span>
                  {t('c:create')}
                  {watchedStatus === TaskStatus.Unstarted ? '' : ` & ${statusOptionsByValue[watchedStatus].status}`}
                </span>
              </Button>

              <FormField
                control={form.control}
                name="status"
                render={({ field: { onChange } }) => {
                  return (
                    <FormItem className="w-10 gap-0">
                      <FormControl>
                        <Button
                          type="button"
                          disabled={!isDirty}
                          aria-label={t('c:set_resource', { resource: t('c:status').toLowerCase() })}
                          variant={'default'}
                          press={false}
                          className="relative rounded-none rounded-r border-l border-l-background/25"
                          id={`status-${formId}`}
                          onClick={({ currentTarget }) =>
                            handleTaskDropdownClick({
                              dropdownType: 'status',
                              value: form.getValues('status'),
                              onChange: handleStatusChange(onChange),
                              triggerId: currentTarget.id,
                              triggerRef: { current: currentTarget },
                            })
                          }
                        >
                          <ChevronDownIcon />
                        </Button>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="reset"
                variant="secondary"
                className={isDirty ? '' : 'hidden'}
                aria-label={t('c:cancel')}
                onClick={() => {
                  form.reset();
                  setEditorKey((k) => k + 1);
                }}
              >
                {t('c:cancel')}
              </Button>
              <Button type="button" variant="secondary" aria-label={t('c:close')} onClick={handleCloseForm} className={isDirty ? 'hidden' : ''}>
                {t('c:close')}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </motion.div>
  );
}

export { CreateTaskForm };
