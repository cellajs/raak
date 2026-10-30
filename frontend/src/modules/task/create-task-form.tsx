import { ChevronDownIcon, TagIcon, UserXIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { type KeyboardEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { type UseFormProps, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { generateId } from 'shared/utils/entity-id';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useOrganizationLayoutContext } from '~/hooks/use-organization-layout-context';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { useDraftStore } from '~/modules/common/form-draft/draft-store';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { BlockNoteContentFormField as BlockNoteContent } from '~/modules/common/form-fields/blocknote';
import { InputTriggerButton, InputTriggerChevron } from '~/modules/common/form-fields/input-trigger-button';
import { useOverlayClose } from '~/modules/common/overlay-close';
import { Spinner } from '~/modules/common/spinner';
import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import { usePrimaryLabels } from '~/modules/label/use-primary-labels';
import { useProjectMembers } from '~/modules/project/use-project-members';
import { useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import { cachedTasks } from '~/modules/task/helpers/active-task';
import {
  closeCreateTaskForm,
  createTaskFormId,
  createTaskFormSchema,
  type NewTaskFormValues,
  newTaskFormDefaults,
  newTaskFormIsDirty,
} from '~/modules/task/helpers/create-task';
import { createTaskUploadPersister } from '~/modules/task/helpers/create-task-upload-persister';
import { setCurrentItem, takePendingFocus } from '~/modules/task/helpers/focus-item';
import { openTaskDropdown } from '~/modules/task/helpers/open-task-dropdown';
import { getNewTaskOrder } from '~/modules/task/helpers/order-helpers';
import { revealTask } from '~/modules/task/helpers/panel-scroll-registry';
import { useTaskFilePanelProps } from '~/modules/task/hooks/use-task-file-panel-props';
import { useTaskCreateMutation } from '~/modules/task/query';
import { statusOptionsByValue, TaskStatus } from '~/modules/task/task-properties';
import { itemFocusBarClass } from '~/modules/task/task-styles';
import type { Task, TaskStatusType } from '~/modules/task/types';
import { AvatarGroup, AvatarGroupList, AvatarOverflowIndicator } from '~/modules/ui/avatar';
import { Button, buttonVariants } from '~/modules/ui/button';
import { Chip } from '~/modules/ui/chip';
import { Form, FormControl, FormField, FormItem, FormMessage } from '~/modules/ui/field';
import { SegmentedControl, SegmentedControlItem } from '~/modules/ui/segmented-control';
import { useCurrentUser } from '~/modules/user/user-store';
import { coalescedResult } from '~/query/offline/prepared-mutation';
import { cn } from '~/utils/cn';
import { formResolver } from '~/utils/form-resolver';

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

export function CreateTaskForm({ projectId, organizationId, className, dialog: isDialog, onSuccess, onStatusChange }: CreateTaskFormProps) {
  const { t } = useTranslation();
  const overlay = useOverlayClose();
  const user = useCurrentUser();

  const { tenantId } = useOrganizationLayoutContext();

  const isMobile = useBreakpointBelow('sm');
  const setForm = useDraftStore((state) => state.setForm);

  const formId = createTaskFormId(projectId);
  const isFocused = useBoardFocusStore((state) => state.currentItemId === formId);

  const [defaultId] = useState(generateId());
  const [editorKey, setEditorKey] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const pendingCloseRef = useRef(false);

  const projectMembers = useProjectMembers(projectId, tenantId, organizationId);

  const taskMutation = useTaskCreateMutation(tenantId, organizationId);

  const formOptions: UseFormProps<NewTaskFormValues> = {
    resolver: formResolver(createTaskFormSchema),
    defaultValues: { ...newTaskFormDefaults, id: defaultId, projectId },
  };

  const form = useFormWithDraft<NewTaskFormValues>(formId, { formOptions });

  // Subscribe for render: the form only re-renders when isDirty *toggles*, so
  // render-time form.getValues() reads of these fields go stale once dirty
  const watchedStatus = useWatch({ control: form.control, name: 'status' });

  const primaryLabels = usePrimaryLabels(projectId);
  const watchedPrimaryLabelId = useWatch({ control: form.control, name: 'primaryLabelId' });
  useEffect(() => {
    // Read live: the draft restore sets it after the render that watched it
    const current = form.getValues('primaryLabelId');
    if (primaryLabels[0] && !primaryLabels.some(({ id }) => id === current)) form.setValue('primaryLabelId', primaryLabels[0].id);
  }, [watchedPrimaryLabelId, primaryLabels, form.setValue, form.getValues]);

  // Field watchers key the JSON-based dirty check to relevant changes.
  const [watchedAssignedTo, watchedLabels, watchedDescription] = useWatch({ control: form.control, name: ['assignedTo', 'labels', 'description'] });
  const isDirty = form.isDirty && newTaskFormIsDirty({ assignedTo: watchedAssignedTo, labels: watchedLabels, description: watchedDescription });

  // Rows are created at upload, as in the update form, so a draft closed or reloaded before submit keeps every upload.
  const baseFilePanelProps = useTaskFilePanelProps(
    projectId,
    tenantId,
    organizationId,
    createTaskUploadPersister({ organizationId, tenantId, projectId }),
  );

  const handleCloseForm = () => {
    if (isDialog) overlay?.close();
    else closeCreateTaskForm(projectId);
  };

  // Also run from a timeout: the list re-sort can unmount the form mid-exit, and an unmounted motion.div never completes.
  const closeAfterExit = () => {
    if (!pendingCloseRef.current) return;
    pendingCloseRef.current = false;
    handleCloseForm();
    // The dialog's scroll lock puts the board back where it was as the dialog unmounts
    if (isDialog) requestAnimationFrame(() => revealTask(projectId, defaultId));
  };

  const handleFormSubmit = async (values: NewTaskFormValues) => {
    if (pendingCloseRef.current) return;
    const tasks = cachedTasks();

    const fullAssignedTo =
      values.status === TaskStatus.Started
        ? [...new Map([user, ...values.assignedTo].map((assignee) => [assignee.id, assignee])).values()]
        : values.assignedTo;

    const newTask = {
      ...values,
      id: defaultId,
      // Empty until primaries load; the server then falls back to the project default
      primaryLabelId: values.primaryLabelId || undefined,
      labels: values.labels.map(({ id }) => id),
      assignedTo: fullAssignedTo.map(({ id }) => id),
      displayOrder: getNewTaskOrder(values.status, tasks, projectId),
      fullLabels: values.labels,
      fullAssignedTo,
    };

    // Clears the stored draft now while the values stay visible through the exit animation; a failed create restores it below.
    form.reset(values);
    pendingCloseRef.current = true;
    setIsExiting(true);
    setTimeout(closeAfterExit, exitFallbackMs);

    await taskMutation
      .mutateAsync(newTask)
      // Creates never coalesce, so this always resolves to the created tasks; the guard narrows the type.
      .then((createdTasks) => createdTasks !== coalescedResult && onSuccess?.(createdTasks[0]))
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
    setCurrentItem(formId);
  };

  // Takes the focus requested while loading; memoized because this component is not compiled and a new ref callback would re-run every render
  const takeFocus = useCallback((element: HTMLFormElement | null) => takePendingFocus(formId, element), [formId]);

  // On the board the form is an item like a task card: arrows pass over it and Enter steps into its editor
  const handleFormKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (isDialog || event.key !== 'Enter' || event.target !== event.currentTarget) return;
    event.preventDefault();
    event.currentTarget.querySelector<HTMLElement>('[contenteditable="true"]')?.focus();
  };

  if (form.loading) return null;

  return (
    <motion.div
      animate={isExiting ? { height: 0, opacity: 0 } : { height: 'auto', opacity: 1 }}
      transition={{ duration: exitDurationS, ease: 'easeInOut' }}
      onAnimationComplete={closeAfterExit}
      className={cn(isExiting && 'overflow-hidden', isDialog && 'flex grow flex-col')}
    >
      <Form {...form}>
        <form
          noValidate
          id={formId}
          ref={takeFocus}
          tabIndex={isDialog || isFocused ? 0 : -1}
          onClick={handleFormClick}
          onKeyDown={handleFormKeyDown}
          onSubmit={form.handleSubmit(handleFormSubmit)}
          className={cn(
            'flex flex-col gap-2 sm:p-3 sm:pl-11',
            isDialog && 'grow',
            !isDialog &&
              'relative border-b before:pointer-events-none before:absolute before:inset-y-0 before:left-px before:w-1 before:bg-primary before:opacity-0 sm:before:-left-px',
            !isDialog && itemFocusBarClass,
            isFocused ? 'is-focused focus-visible:outline-none focus-visible:ring-0' : 'focus-visible:ring-1 focus-visible:ring-ring',
            className,
          )}
        >
          <Suspense fallback={<Spinner className="my-16" noDelay />}>
            <BlockNoteContent
              key={editorKey}
              control={form.control}
              name="description"
              containerClassName={isDialog ? 'grow' : undefined}
              baseBlockNoteProps={{
                id: `blocknote-${defaultId}`,
                editable: isFocused || isDialog,
                // Tasks open for editing on a single click, Google Keep style: no toolbar on a text selection.
                formattingToolbar: false,
                members: projectMembers,
                className: cn('min-h-16 [&>.bn-editor]:min-h-16', isDialog && 'grow [&>.bn-editor]:grow'),
                baseFilePanelProps,
                trailingBlock: false,
                onCmdEnter: form.handleSubmit(handleFormSubmit),
              }}
            />
          </Suspense>

          <FormField
            control={form.control}
            name="primaryLabelId"
            render={({ field: { value, onChange } }) => (
              <FormItem>
                <FormControl>
                  <SegmentedControl size="sm" className="w-full" value={value} onValueChange={onChange}>
                    {primaryLabels.map((label) => (
                      <SegmentedControlItem value={label.id} className="flex-1" key={label.id}>
                        <PrimaryLabelIcon label={label} />
                        <span className="min-w-0 truncate">{label.name}</span>
                      </SegmentedControlItem>
                    ))}
                  </SegmentedControl>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="labels"
            render={({ field: { onChange, value: labels } }) => (
              <FormItem>
                <div
                  className={cn(buttonVariants({ variant: 'input', size: 'sm', press: false }), 'relative flex h-auto min-h-9 justify-start py-1')}
                >
                  <FormControl>
                    <button
                      type="button"
                      aria-label={t('c:set_resource', { resource: t('c:label_other') })}
                      id={`labels-${formId}`}
                      className="focus-effect absolute inset-0 rounded-md"
                      onClick={({ currentTarget }) =>
                        openTaskDropdown({
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
                          onRemove={() => onChange(labels.filter((label) => label.id !== id))}
                          removeLabel={t('c:remove_resource', { resource: name })}
                        >
                          {name}
                        </Chip>
                      ))
                    ) : (
                      <>
                        <TagIcon className="text-faint-foreground" />
                        <span className="ml-1 text-faint-foreground">{t('c:select_resource', { resource: t('c:label_other') })}</span>
                      </>
                    )}
                  </div>
                  <InputTriggerChevron className="ml-auto size-4" />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="assignedTo"
            render={({ field: { onChange, value } }) => (
              <FormItem>
                <FormControl>
                  <InputTriggerButton
                    aria-label={t('c:assign_to')}
                    size="sm"
                    className="flex"
                    id={`assignedTo-${formId}`}
                    type="button"
                    onClick={({ currentTarget }) =>
                      openTaskDropdown({
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
                    <span className="flex min-w-0 items-center gap-1.5">
                      {value.length ? (
                        <>
                          <AvatarGroup limit={3}>
                            <AvatarGroupList>
                              {value.map((assignee) => (
                                <EntityAvatar
                                  type="user"
                                  key={assignee.id}
                                  id={assignee.id}
                                  name={assignee.name}
                                  url={assignee.thumbnailUrl}
                                  className="size-6"
                                />
                              ))}
                            </AvatarGroupList>
                            <AvatarOverflowIndicator className="size-6 text-xs" />
                          </AvatarGroup>
                          <span className="truncate">
                            {value.length === 1 && value[0].name}
                            {value.length === 2 && value.map(({ name }) => name).join(', ')}
                            {value.length > 2 && t('c:count_assigned', { count: value.length })}
                          </span>
                        </>
                      ) : (
                        <>
                          <UserXIcon className="size-4 text-faint-foreground" />{' '}
                          <span className="ml-0.5 font-normal text-faint-foreground">{t('c:assign_to')}</span>
                        </>
                      )}
                    </span>
                  </InputTriggerButton>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-col gap-2 py-2 sm:flex-row">
            <div className="active:press flex">
              <Button type="submit" disabled={!isDirty} press={false} className="grow rounded-none rounded-l">
                <span>
                  {t('c:create')}
                  {watchedStatus === TaskStatus.Unstarted ? '' : ` & ${t(`c:${statusOptionsByValue[watchedStatus].status}`)}`}
                </span>
              </Button>

              <FormField
                control={form.control}
                name="status"
                render={({ field: { onChange } }) => (
                  <FormItem className="w-10 gap-0">
                    <FormControl>
                      <Button
                        type="button"
                        disabled={!isDirty}
                        aria-label={t('c:set_resource', { resource: t('c:status') })}
                        press={false}
                        className="rounded-none rounded-r border-l-background/25"
                        id={`status-${formId}`}
                        onClick={({ currentTarget }) =>
                          openTaskDropdown({
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
                )}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="reset"
                variant="secondary"
                className={isDirty ? '' : 'hidden'}
                onClick={() => {
                  form.reset();
                  setEditorKey((count) => count + 1);
                }}
              >
                {t('c:cancel')}
              </Button>
              <Button type="button" variant="secondary" onClick={handleCloseForm} className={isDirty ? 'hidden' : ''}>
                {t('c:close')}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </motion.div>
  );
}
