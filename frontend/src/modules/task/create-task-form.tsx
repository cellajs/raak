import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDownIcon, TagIcon, UserXIcon, XIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type React from 'react';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { type UseFormProps, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { generateId } from 'shared/entity-id';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { useDraftStore } from '~/modules/common/form-draft/draft-store';
import { useFormWithDraft } from '~/modules/common/form-draft/use-draft-form';
import { BlockNoteContentFormField as BlockNoteContent } from '~/modules/common/form-fields/blocknote';
import { Spinner } from '~/modules/common/spinner';
import type { UploadedUppyFile } from '~/modules/common/uploader/types';
import { NotSelected } from '~/modules/task/dropdowns/point-icons/not-selected';
import { SelectLabels } from '~/modules/task/dropdowns/select-labels';
import { cachedTasks } from '~/modules/task/helpers/active-task';
import {
  createTaskFormSchema,
  handleCreateForm,
  type NewTaskFormValues,
  newTaskFormDefaults,
  newTaskFormIsDirty,
} from '~/modules/task/helpers/create-task';
import { deriveDescriptionProps } from '~/modules/task/helpers/derive-description-props';
import { focusTask } from '~/modules/task/helpers/focus-task';
import { getNewTaskOrder } from '~/modules/task/helpers/order-helpers';
import { handleTaskDropdownClick } from '~/modules/task/helpers/task-dropdown';
import { useProjectMembers } from '~/modules/task/hooks/use-project-members';
import { useProjectPublicity } from '~/modules/task/hooks/use-project-publicity';
import { useUploadAttachments } from '~/modules/task/hooks/use-upload-attachments';
import { useTaskCreateMutation } from '~/modules/task/query';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import {
  pointsOptionsByValue,
  statusOptionsByValue,
  TaskStatus,
  TaskVariant,
  variantOptions,
  variantOptionsByValue,
} from '~/modules/task/task-properties';
import type { Task, TaskLabel, TaskStatusType } from '~/modules/task/types';
import { AvatarGroup, AvatarGroupList, AvatarOverflowIndicator } from '~/modules/ui/avatar';
import { Badge } from '~/modules/ui/badge';
import { Button, buttonVariants } from '~/modules/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '~/modules/ui/field';
import { ToggleGroup, ToggleGroupItem } from '~/modules/ui/toggle-group';
import { useUserStore } from '~/modules/user/user-store';
import { cn } from '~/utils/cn';

interface CreateTaskFormProps {
  projectId: string;
  organizationId: string;
  className?: string;
  dialog?: boolean;
  onSuccesses?: (task: Task) => void;
  onStatusChange?: (status: TaskStatusType) => void;
}

const CreateTaskForm: React.FC<CreateTaskFormProps> = ({
  projectId,
  organizationId,
  className,
  dialog: isDialog,
  onSuccesses,
  onStatusChange,
}) => {
  const { t } = useTranslation();
  const { user } = useUserStore();

  const { tenantId } = useOrganizationLayoutContext();

  const isMobile = useBreakpointBelow('sm');
  const setForm = useDraftStore((state) => state.setForm);
  const focusedTaskId = useTaskInteractionStore((s) => s.focusedTaskId);

  const [defaultId] = useState(generateId());
  const [attachments, setAttachments] = useState({} as UploadedUppyFile<'attachment'>);
  const [editorKey, setEditorKey] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const pendingCloseRef = useRef(false);

  const projectMembers = useProjectMembers(projectId, tenantId, organizationId);

  const projectPublicity = useProjectPublicity(projectId);
  const { attachmentsCreationCallback } = useUploadAttachments();

  const taskMutation = useTaskCreateMutation(tenantId, organizationId);

  const formId = `create-task-${projectId}`;
  const isFocused = focusedTaskId === formId;

  const formOptions: UseFormProps<NewTaskFormValues> = useMemo(
    () => ({
      resolver: zodResolver(createTaskFormSchema),
      defaultValues: {
        ...newTaskFormDefaults,
        id: defaultId,
        projectId,
      },
    }),
    [],
  );

  // Form with draft in local storage
  const form = useFormWithDraft<NewTaskFormValues>(formId, { formOptions });

  // Subscribe for render: the form only re-renders when isDirty *toggles*, so
  // render-time form.getValues() reads of these fields go stale once dirty
  const watchedVariant = useWatch({ control: form.control, name: 'variant' });
  const watchedStatus = useWatch({ control: form.control, name: 'status' });

  const updateAttachments = useCallback((data: UploadedUppyFile<'attachment'>) => setAttachments(data), []);

  const baseFilePanelProps = useMemo(
    () => ({
      isPublic: projectPublicity,
      tenantId,
      organizationId,
      onComplete: updateAttachments,
    }),
    [organizationId, projectPublicity, tenantId, updateAttachments],
  );

  const handleCloseForm = () => {
    if (isDialog) useDialoger.getState().remove();
    else {
      focusTask(null);
      handleCreateForm({ id: projectId, organizationId, tenantId });
    }
  };

  const onSubmit = async (values: NewTaskFormValues) => {
    // Get cached tasks
    const tasks = cachedTasks();

    // Only add user if task start and it's not already assigned
    const fullAssignedTo =
      values.status === TaskStatus.Started
        ? [...new Map([user, ...values.assignedTo].map((u) => [u.id, u])).values()]
        : values.assignedTo;

    const newTask = {
      // Task variables
      ...values,
      id: defaultId,
      labels: values.labels.map(({ id }) => id),
      assignedTo: fullAssignedTo.map(({ id }) => id),
      displayOrder: getNewTaskOrder(values.status, tasks, projectId),
      ...(await deriveDescriptionProps(values.description ?? '')),
      // Mutation variables
      fullLabels: values.labels,
      fullAssignedTo,
    };

    // Keep the submitted values visible until the exit animation completes.
    pendingCloseRef.current = true;
    setIsExiting(true);

    // Handle attachments if present — taskId links them to the new task (host relation)
    if (attachments[':original']?.length) {
      attachmentsCreationCallback({ organizationId, tenantId, projectId, taskId: defaultId })(attachments);
    }

    // Backend handles label usedCount side-effects atomically
    await taskMutation
      .mutateAsync(newTask)
      .then((createdTask) => onSuccesses?.(createdTask))
      .catch(() => {
        const { description, status, variant, points, fullLabels: labels, fullAssignedTo: assignedTo } = newTask;
        setForm(formId, { description, status, variant, points, labels, assignedTo });
      });
  };

  const handleLabelsChange = (onChange: (labels: TaskLabel[]) => void) => (labels: TaskLabel[]) => {
    onChange(labels);

    useDropdowner.getState().update({
      content: (
        <SelectLabels
          value={labels}
          projectId={projectId}
          triggerWidth={getFieldWidth()}
          onChange={handleLabelsChange(onChange)} // Recursively pass the same handler
        />
      ),
    });
  };

  const handleStatusChange = (onChange: (status: TaskStatusType) => void) => (status: TaskStatusType) => {
    flushSync(() => onChange(status));
    setTimeout(() => onStatusChange?.(status));
  };

  const getFieldWidth = () => {
    const element = document.getElementById(formId);
    if (!element) return;
    const styles = getComputedStyle(element);
    return element.clientWidth - Number.parseFloat(styles.paddingLeft) - Number.parseFloat(styles.paddingRight) - 3;
  };

  const isDirty = useCallback(() => {
    if (!form.isDirty) return false;
    return newTaskFormIsDirty(form.getValues());
  }, [form]);

  const handleFormClick = useCallback(() => {
    if (isDialog || isFocused || isMobile) return;
    focusTask(formId);
  }, [isDialog, isFocused, isMobile]);

  if (form.loading) return null;

  return (
    <motion.div
      animate={isExiting ? { height: 0, opacity: 0 } : { height: 'auto', opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      onAnimationComplete={() => {
        if (pendingCloseRef.current) {
          pendingCloseRef.current = false;
          form.reset();
          handleCloseForm();
        }
      }}
      style={{ overflow: isExiting ? 'hidden' : undefined }}
      className={isDialog ? 'flex min-h-0 grow flex-col' : undefined}
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
            !isDialog && 'border-b border-l-2 border-l-transparent',
            isFocused
              ? 'is-focused border-l-primary focus-visible:outline-none focus-visible:ring-0'
              : 'focus-visible:ring-1 focus-visible:ring-ring',
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
            name="variant"
            render={({ field: { value, onChange } }) => {
              return (
                <FormItem>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      variant="merged"
                      className="w-full gap-0"
                      value={variantOptionsByValue[value].type}
                      onValueChange={(newValue: string | string[]) => {
                        const selected = variantOptions.find((o) => o.type === newValue);
                        if (selected) onChange(selected.value);
                      }}
                    >
                      {variantOptions.map((variant) => (
                        <ToggleGroupItem
                          tabIndex={0}
                          size="sm"
                          value={variant.type}
                          className="group grow font-normal"
                          key={variant.type}
                        >
                          {variant.icon()}
                          <span className="ml-2 opacity-75 group-data-pressed:font-medium group-data-pressed:opacity-100">
                            {t(`c:${variant.labelKey}`)}
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

          {watchedVariant !== TaskVariant.Bug && (
            <FormField
              control={form.control}
              name="points"
              render={({ field: { onChange, value } }) => {
                const selectedPoints = value !== null && value !== undefined ? pointsOptionsByValue[value] : null;
                return (
                  <FormItem>
                    <FormControl>
                      <Button
                        aria-label="Set points"
                        variant="input"
                        size="sm"
                        className="relative flex justify-start gap-2"
                        id={`points-${formId}`}
                        type="button"
                        onClick={({ currentTarget }) =>
                          handleTaskDropdownClick({
                            dropdownType: 'points',
                            value: value ?? null,
                            onChange,
                            triggerId: currentTarget.id,
                            triggerRef: { current: currentTarget },
                            triggerWidth: currentTarget.clientWidth,
                          })
                        }
                      >
                        {selectedPoints !== null ? (
                          <>
                            <selectedPoints.icon className="size-4 fill-current" aria-hidden="true" />

                            {selectedPoints.label}
                          </>
                        ) : (
                          <>
                            <NotSelected className="size-4" aria-hidden="true" />
                            <span className="font-normal opacity-75">
                              {t('c:set_resource', { resource: t('c:points').toLowerCase() })}
                            </span>
                          </>
                        )}
                      </Button>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          )}

          <FormField
            control={form.control}
            name="labels"
            render={({ field: { onChange, value: labels } }) => {
              return (
                <FormItem>
                  <FormControl>
                    <Button
                      type="button"
                      aria-label="Set labels"
                      variant="input"
                      size="sm"
                      id={`labels-${formId}`}
                      className="relative flex h-auto min-h-9 justify-start py-1 hover:bg-accent/20"
                      onClick={({ currentTarget }) =>
                        handleTaskDropdownClick({
                          dropdownType: 'labels',
                          value: labels,
                          projectId,
                          onChange: handleLabelsChange(onChange),
                          triggerId: currentTarget.id,
                          triggerRef: { current: currentTarget },
                          triggerWidth: currentTarget.clientWidth,
                        })
                      }
                    >
                      <div className="flex flex-wrap items-center gap-1 truncate">
                        {labels.length > 0 ? (
                          labels.map(({ name, id }) => {
                            return (
                              <div
                                key={id}
                                className="flex flex-wrap items-center justify-center rounded-full border bg-border pr-[0.17rem] pl-2 align-center"
                              >
                                <Badge
                                  variant="outline"
                                  key={id}
                                  className="h-6 border-0 px-1 font-normal text-[.75rem] text-sm shadow-none last:mr-0"
                                >
                                  {name}
                                </Badge>
                                {/* biome-ignore lint/a11y/useKeyWithClickEvents: element is not keyboard-focusable and handled intentionally via mouse*/}
                                <div
                                  className={cn(
                                    buttonVariants({ size: 'micro', variant: 'ghost' }),
                                    'h-5 w-5 rounded-full opacity-70 hover:opacity-100 focus-visible:ring-offset-0 active:translate-y-0',
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleLabelsChange(onChange)(labels.filter((l) => l.name !== name));
                                  }}
                                >
                                  <XIcon size={16} strokeWidth={3} />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <>
                            <TagIcon size={16} className="opacity-75" />
                            <span className="ml-2 font-normal opacity-75">
                              {t('c:select_resource', { resource: t('c:label_other').toLowerCase() })}
                            </span>
                          </>
                        )}
                      </div>
                    </Button>
                  </FormControl>
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
                      aria-label="Assign"
                      variant="input"
                      size="sm"
                      className="relative flex justify-start gap-2"
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
                            {value.length === 0 && 'Assign to'}
                            {value.length === 1 && value[0].name}
                            {value.length === 2 && value.map(({ name }) => name).join(', ')}
                            {value.length > 2 && `${value.length} assigned`}
                          </span>
                        </>
                      ) : (
                        <>
                          <UserXIcon className="h-4 w-4 opacity-75" />{' '}
                          <span className="font-normal opacity-75">{t('c:assign_to')}</span>
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
            <div className="flex [&:not(.absolute)]:active:translate-y-[.05rem]">
              <Button
                type="submit"
                disabled={!isDirty()}
                className="grow rounded-none rounded-l [&:not(.absolute)]:active:translate-y-0"
              >
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
                          disabled={!isDirty()}
                          aria-label="Set status"
                          variant={'default'}
                          className="relative rounded-none rounded-r border-l border-l-background/25 [&:not(.absolute)]:active:translate-y-0"
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
                          <ChevronDownIcon size={16} />
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
                className={isDirty() ? '' : 'hidden'}
                aria-label="Cancel"
                onClick={() => {
                  form.reset();
                  setEditorKey((k) => k + 1);
                }}
              >
                {t('c:cancel')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                aria-label="close"
                onClick={handleCloseForm}
                className={isDirty() ? 'hidden' : ''}
              >
                {t('c:close')}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </motion.div>
  );
};

export { CreateTaskForm };
