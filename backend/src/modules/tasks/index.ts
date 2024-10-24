import { type SQL, and, desc, eq, ilike, inArray } from 'drizzle-orm';
import type { z } from 'zod';
import { coalesce, db } from '#/db/db';
import { labelsTable } from '#/db/schema/labels';
import { type InsertTaskModel, tasksTable } from '#/db/schema/tasks';
import { safeUserSelect, usersTable } from '#/db/schema/users';
import { getUsersByConditions } from '#/db/util';
import { getContextUser, getMemberships, getOrganization } from '#/lib/context';
import { type ErrorType, createError, errorResponse } from '#/lib/errors';
import { logEvent } from '#/middlewares/logger/log-event';
import { CustomHono } from '#/types/common';
import { getOrderColumn } from '#/utils/order-column';
import { splitByAllowance } from '#/utils/split-by-allowance';
import { extractKeywords, getDateFromToday, scanTaskDescription } from './helpers/utils';
import taskRoutesConfig from './routes';
import type { subtaskSchema } from './schema';

import JSZip from 'jszip';
import { nanoid } from 'nanoid';
import papaparse from 'papaparse';
import { membershipsTable } from '#/db/schema/memberships';
import { projectsTable } from '#/db/schema/projects';
import { PivotalTaskTypes, getLabels, getSubtask, getTaskLabels, getTaskUsers } from './helpers/pivotal';
import type { PivotalTask } from './helpers/pivotal-type';

const app = new CustomHono();

// Task endpoints
const tasksRoutes = app
  /*
   * Create task
   */
  .openapi(taskRoutesConfig.createTask, async (ctx) => {
    const newTaskInfo = ctx.req.valid('json');

    const organization = getOrganization();
    const user = getContextUser();

    // TODO add permission check for project using memberships

    // Use body data to create a new task, add valid organization id
    const newTask: InsertTaskModel = { ...newTaskInfo, organizationId: organization.id };

    const descriptionText = String(newTask.description);

    // Sanitize description create summary, expandable and keywords from description
    const { description, summary, expandable, keywords } = scanTaskDescription(descriptionText);
    newTask.description = description;
    newTask.summary = summary;
    newTask.expandable = expandable;
    newTask.keywords = keywords;

    const [createdTask] = await db.insert(tasksTable).values(newTask).returning();

    logEvent('Task created', { task: createdTask.id });

    const uniqueAssignedUserIds = [...new Set(createdTask.assignedTo)];
    const assignedTo = await getUsersByConditions([inArray(usersTable.id, uniqueAssignedUserIds)], 'limited');
    const labels = await db.select().from(labelsTable).where(inArray(labelsTable.id, createdTask.labels));

    const finalTask = {
      ...createdTask,
      subtasks: [] as z.infer<typeof subtaskSchema>,
      createdBy: user,
      modifiedBy: null,
      assignedTo: assignedTo.filter((m) => createdTask.assignedTo.includes(m.id)),
      labels: labels.filter((m) => createdTask.labels.includes(m.id)),
    };

    return ctx.json({ success: true, data: finalTask }, 200);
  })
  /*
   * Get list of tasks
   */
  .openapi(taskRoutesConfig.getTasks, async (ctx) => {
    const { q, sort, order, offset, limit, projectId, status } = ctx.req.valid('query');

    const organization = getOrganization();

    // Filter tasks at least by valid organization
    const tasksFilters: SQL[] = [eq(tasksTable.organizationId, organization.id)];

    // Add other filters
    if (projectId) tasksFilters.push(inArray(tasksTable.projectId, projectId.split('_')));
    //TODO rework search by key words itself
    if (q) {
      const sanitizedQ = q.split(' ').map((el) => `%${el.trim()}%`);
      for (const word of sanitizedQ) tasksFilters.push(ilike(tasksTable.keywords, word));
    }
    if (status) tasksFilters.push(inArray(tasksTable.status, status.split('_').map(Number)));

    const tasksQuery = db
      .select()
      .from(tasksTable)
      .where(and(...tasksFilters));

    const orderColumn = getOrderColumn(
      {
        type: tasksTable.type,
        status: tasksTable.status,
        projectId: tasksTable.projectId,
        createdAt: tasksTable.createdAt,
        createdBy: tasksTable.createdBy,
        modifiedAt: tasksTable.modifiedAt,
      },
      sort,
      tasksTable.status,
      order,
    );

    const tasks = await db
      .select()
      .from(tasksQuery.as('tasks'))
      .orderBy(
        // Sort default by status first, higher status comes first
        orderColumn,
        // Then sort by order, with null values handled
        desc(coalesce(tasksTable.order, 0)),
      )
      .limit(Number(limit))
      .offset(Number(offset));

    // Create a set of unique user IDs from the tasks, so we can retrieve them from the database
    const uniqueAssignedUserIds = Array.from(
      new Set([
        // Get all assigned user IDs by flattening the array of assignedTo properties & filtering null values
        ...tasks.flatMap((t) => t.assignedTo),
        ...tasks.map((t) => t.createdBy).filter((id) => id !== null),
        ...tasks.map((t) => t.modifiedBy).filter((id) => id !== null),
      ]),
    );

    // Create a set of unique label IDs from the tasks
    const uniqueLabelIds = Array.from(new Set([...tasks.flatMap((t) => t.labels)]));

    const users = await getUsersByConditions([inArray(usersTable.id, uniqueAssignedUserIds)], 'limited');
    const labels = await db.select().from(labelsTable).where(inArray(labelsTable.id, uniqueLabelIds));

    // Create a map for quick access to users by their ID
    const userMap = new Map(users.map((user) => [user.id, user]));

    const finalTasks = tasks
      .map((task) => {
        const subtasks = tasks.filter((st) => st.parentId === task.id).sort((a, b) => b.order - a.order);

        return {
          ...task,
          subtasks: subtasks,
          createdBy: task.createdBy ? userMap.get(task.createdBy) || null : null,
          modifiedBy: userMap.get(task.modifiedBy || '') || null,
          assignedTo: users.filter((m) => task.assignedTo.includes(m.id)),
          labels: labels.filter((m) => task.labels.includes(m.id)),
        };
      })
      .filter((t) => {
        if (t.parentId) return false;
        return !(t.status === 6 && t.modifiedAt && t.modifiedAt >= getDateFromToday(30));
      }); // Filter out subtasks and tasks accepted over 30 days ago
    // TODO in future, add a query param to tell what should be cut off date

    const counts = {
      iced: finalTasks.filter((t) => t.status === 0).length,
      accepted: tasks.filter((t) => t.status === 6).length,
      acceptedRecent: finalTasks.filter((t) => t.status === 6).length,
      tasks: tasks.length,
    };

    return ctx.json({ success: true, data: { items: finalTasks, total: finalTasks.length, counts } }, 200);
  })
  /*
   * Update task
   */
  .openapi(taskRoutesConfig.updateTask, async (ctx) => {
    const id = ctx.req.param('id');
    const { key, data, order } = ctx.req.valid('json');

    const allowedKeys = ['labels', 'assignedTo', 'type', 'status', 'description', 'impact', 'order'];

    // Validate request
    if (!id) return errorResponse(ctx, 404, 'not_found', 'warn');
    if (!allowedKeys.includes(key)) return errorResponse(ctx, 400, 'invalid_request', 'warn', 'task');

    const user = getContextUser();

    // TODO add permission check for project using memberships

    const updateValues: Partial<InsertTaskModel> = {
      [key]: data,
      modifiedAt: new Date(),
      modifiedBy: user.id,
      ...(order && { order: order }),
    };

    // If updating description, sanitize description and update keywords, summary and expandable
    if (key === 'description' && data) {
      const descriptionText = String(data);

      const { description, summary, expandable, keywords } = scanTaskDescription(descriptionText);
      updateValues.description = description;
      updateValues.summary = summary;
      updateValues.expandable = expandable;
      updateValues.keywords = keywords;
    }

    const [updatedTask] = await db.update(tasksTable).set(updateValues).where(eq(tasksTable.id, id)).returning({
      summary: tasksTable.summary,
      description: tasksTable.description,
      expandable: tasksTable.expandable,
      order: tasksTable.order,
    });

    return ctx.json({ success: true, data: updatedTask }, 200);
  })
  /*
   * Delete tasks
   */
  .openapi(taskRoutesConfig.deleteTasks, async (ctx) => {
    const { ids } = ctx.req.valid('query');
    const memberships = getMemberships();

    // Convert the ids to an array
    const toDeleteIds = Array.isArray(ids) ? ids : [ids];

    if (!toDeleteIds.length) return errorResponse(ctx, 400, 'invalid_request', 'warn', 'task');

    const { allowedIds, disallowedIds } = await splitByAllowance('delete', 'task', toDeleteIds, memberships);
    if (!allowedIds.length) return errorResponse(ctx, 403, 'forbidden', 'warn', 'task');

    // Map errors of tasks user is not allowed to delete
    const errors: ErrorType[] = disallowedIds.map((id) => createError(ctx, 404, 'not_found', 'warn', 'task', { project: id }));

    // Delete subtasks at first then delete the tasks
    await db.delete(tasksTable).where(inArray(tasksTable.parentId, allowedIds));
    await db.delete(tasksTable).where(inArray(tasksTable.id, allowedIds));

    return ctx.json({ success: true, errors: errors }, 200);
  })
  /*
   * Import tasks
   */
  .openapi(taskRoutesConfig.importTasks, async (ctx) => {
    const { file: zipFile } = await ctx.req.parseBody();
    const { projectId } = ctx.req.param();

    const user = getContextUser();
    const organization = getOrganization();

    const isZipFile = zipFile && typeof zipFile === 'object' && 'arrayBuffer' in zipFile;

    if (!isZipFile) return errorResponse(ctx, 400, 'invalid_request', 'warn');
    if (!projectId) return errorResponse(ctx, 400, 'invalid_request', 'warn');

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.organizationId, organization.id)));

    const members = await db
      .select({
        user: safeUserSelect,
      })
      .from(usersTable)
      .innerJoin(membershipsTable, and(eq(membershipsTable.projectId, project.id), eq(membershipsTable.type, 'project')))
      .where(eq(usersTable.id, membershipsTable.userId));

    if (!project) return errorResponse(ctx, 404, 'not_found', 'warn', 'project');

    const buffer = await zipFile.arrayBuffer();
    const zip = new JSZip();
    await zip.loadAsync(buffer);

    const promises: Promise<unknown>[] = [];
    zip.forEach((relativePath, zipEntry) => {
      if (!relativePath.endsWith('.csv') || relativePath.includes('project_history')) {
        return;
      }
      const promise = new Promise((resolve) => {
        zipEntry.async('nodebuffer').then((content) => {
          const csv = content.toString();
          const result = papaparse.parse(csv, { header: true });
          resolve(result.data);
        });
      });
      promises.push(promise);
    });
    const [tasks] = await Promise.all<
      [PivotalTask[]]
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    >(promises as any);

    const labelsToInsert = getLabels(tasks, project.organizationId, project.id);
    const subtasksToInsert: InsertTaskModel[] = [];
    const tasksToInsert = tasks
      // Filter out accepted tasks
      .filter((task) => task['Current State'] !== 'accepted' && task.Id !== '')
      .map((task, index) => {
        const taskId = nanoid();
        const { ownerIds, creatorId, ownersNames } = getTaskUsers(
          task,
          members.map((el) => el.user),
        );
        const labelsIds = getTaskLabels(task, labelsToInsert);
        const subtasks = getSubtask(task, taskId, project.organizationId, project.id);
        if (subtasks.length) subtasksToInsert.push(...subtasks);
        return {
          id: taskId,
          summary: `<p class="bn-inline-content inline">${task.Title}</p>`,
          type: PivotalTaskTypes[task.Type as keyof typeof PivotalTaskTypes] || PivotalTaskTypes.chore,
          organizationId: project.organizationId,
          projectId: project.id,
          expandable: task.Description !== '',
          keywords: task.Description || task.Title ? extractKeywords(task.Description + task.Title) : '',
          impact: ['0', '1', '2', '3'].includes(task.Estimate) ? +task.Estimate : 0,
          description: `<div class="bn-block-content"><p class="bn-inline-content">${task.Title}</p></div><div class="bn-block-content"><p class="bn-inline-content">${task.Description}</p>
          ${ownersNames.length ? ownersNames.map((name) => `<div data-content-type="paragraph" class="bn-block-content"><p class="bn-inline-content" data-owner="${name.toLowerCase()}">Owned by ${name}</p></div>`) : ''}
          <div data-content-type="paragraph" class="bn-block-content"><p class="bn-inline-content" data-pivotal-id="${task.Id}">Pivotal id: ${task.Id}</p></div>`,
          labels: labelsIds,
          status:
            task['Current State'] === 'accepted'
              ? 6
              : task['Current State'] === 'reviewed'
                ? 5
                : task['Current State'] === 'delivered'
                  ? 4
                  : task['Current State'] === 'finished'
                    ? 3
                    : task['Current State'] === 'started'
                      ? 2
                      : task['Current State'] === 'unstarted'
                        ? 1
                        : 0,
          order: index,
          assignedTo: ownerIds,
          createdAt: task['Created at'] ? new Date(task['Created at']) : new Date(),
          createdBy: creatorId ?? user.id,
        } satisfies InsertTaskModel;
      });
    await db.insert(labelsTable).values(labelsToInsert);
    await db.insert(tasksTable).values(tasksToInsert).onConflictDoNothing();
    if (subtasksToInsert.length) await db.insert(tasksTable).values(subtasksToInsert);

    return ctx.json({ success: true }, 200);
  });

export default tasksRoutes;
