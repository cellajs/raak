import { faker } from '@faker-js/faker';
import { appConfig } from 'shared';
import { and, eq } from 'drizzle-orm';

import { seedDb } from '#/db/db';
import { type InsertLabelModel, labelsTable } from '#/modules/label/label-db';
import { type InsertMembershipModel, membershipsTable } from '#/modules/memberships/memberships-db';
import { organizationsTable } from '#/modules/organization/organization-db';
import { type InsertProjectModel, projectsTable } from '#/modules/project/project-db';
import { type InsertTaskModel, tasksTable } from '#/modules/task/task-db';
import { type InsertWorkspaceModel, workspacesTable } from '#/modules/workspace/workspace-db';
import { createServerStx } from '#/core/stx';
import { extractKeywordsFromBlocks } from '#/utils/extract-keywords';
import { TaskStatus } from '#/modules/task/task-properties';
import { startSpinner, succeedSpinner, warnSpinner } from '#/utils/console';
import { nanoid } from 'shared/utils/nanoid';
import { buildPrimaryLabelRows } from '#/modules/label/helpers/primary-labels';
import { mockLabel } from '#/modules/label/label-mocks';
import { mockChannelMembership } from '#/modules/memberships/memberships-mocks';
import { mockProject } from '#/modules/project/project-mocks';
import { mockWorkspace } from '#/modules/workspace/workspace-mocks';
import { mockPastIsoDate, mockUuid, setMockContext } from '#/mocks';
import { defaultAdminUser } from '../fixtures';
import type { SeedScript } from '../types';

// Set mock context for seed script - UUIDs get '00000000-' prefix, nanoids get 'gen-' prefix (CDC worker skips these on catch-up)
setMockContext('script');

const isProduction = appConfig.mode === 'production';
const projectsPerOrg = { min: 2, max: 5 };
const membersPerProject = { min: 5, max: 10 };
const avgTasksPerProject = 3000;
const labelsPerProject = 20;
const adminWorkspaceMembershipCap = 5;
const adminProjectMembershipCap = adminWorkspaceMembershipCap * 3;
const insertBatchSize = 500;

// Seed scripts use admin connection for privileged operations
const db = seedDb;

/**
 * Checks if there are any workspaces seeded in the database.
 */
const isDataSeeded = async () => {
  const workspacesInTable = await db.select().from(workspacesTable).limit(1);
  return workspacesInTable.length > 0;
};

/**
 * Creates a BlockNote-style JSON description from name and text,
 * optionally appending checklist items with unique checkboxIds.
 */
const createDescription = (name: string, text: string, checklistCount = 0) => {
  const blocks: object[] = [
    { id: nanoid(), type: 'paragraph', props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' }, content: [{ type: 'text', text: name, styles: {} }], children: [] },
    { id: nanoid(), type: 'paragraph', props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' }, content: [{ type: 'text', text, styles: {} }], children: [] },
  ];

  for (let i = 0; i < checklistCount; i++) {
    blocks.push({
      id: nanoid(),
      type: 'checklistItem',
      props: { textColor: 'default', textAlignment: 'left', checkboxId: nanoid(12), checked: false },
      content: [{ type: 'text', text: faker.hacker.phrase(), styles: {} }],
      children: [],
    });
  }

  return JSON.stringify(blocks);
};

/**
 * Generates a unique suffix for seeding (bypasses UniqueEnforcer in mocks).
 */
const seedSuffix = () => faker.string.alphanumeric(6);

// Pre-generate phrase pools to avoid expensive faker calls per task
const phrasePool = Array.from({ length: 200 }, () => faker.hacker.phrase());
const randomPhrase = () => phrasePool[Math.floor(Math.random() * phrasePool.length)];

/**
 * Seeds the database with workspaces, projects, tasks, and labels.
 */
const tasksSeed = async () => {
  const spinner = startSpinner('Seeding tasks...');

  // Production mode → skip seeding
  if (isProduction) {
    spinner.fail('Not allowed in production.');
    return;
  }

  // Records already exist → skip seeding
  if (await isDataSeeded()) {
    warnSpinner('Workspaces table not empty → skip seeding');
    return;
  }

  const organizations = await db.select().from(organizationsTable);
  const memberships = await db.select().from(membershipsTable).where(eq(membershipsTable.channelType, 'organization'));

  // Make sure admin user has admin or member role in organizations (not guest)
  await db
    .update(membershipsTable)
    .set({ role: faker.helpers.arrayElement(['admin', 'member']) })
    .where(
      and(
        eq(membershipsTable.userId, defaultAdminUser.id),
        eq(membershipsTable.channelType, 'organization'),
        eq(membershipsTable.role, 'guest'),
      ),
    );

  const adminMemberships = await db
    .select()
    .from(membershipsTable)
    .where(and(eq(membershipsTable.userId, defaultAdminUser.id), eq(membershipsTable.channelType, 'organization')));

  const adminOrgIds = adminMemberships.map((m) => m.organizationId).filter((el) => el !== null);

  let workspacesCount = 0;
  let projectsCount = 0;
  let tasksCount = 0;
  let labelsCount = 0;
  let membershipsCount = 0;
  let adminProjectMembershipCount = 0;

  // Track which projects each user belongs to per org: `userId:organizationId` → projectId[]
  const userProjectsMap = new Map<string, string[]>();
  // Track project data for workspace linking: projectId → { project, orgMembers, labels }
  const projectDataMap = new Map<string, { tenantId: string; organizationId: string; memberUserIds: string[] }>();

  // --- Pass 1: Create shared projects per org (collaborative, multiple members) ---
  for (const organization of organizations) {
    const orgMemberships = memberships.filter((m) => m.organizationId === organization.id && m.role !== 'guest');
    if (orgMemberships.length === 0) continue;

    const numProjects = faker.number.int(projectsPerOrg);

    // Phase A: Prepare all project data for this org
    const projectEntries: Array<{ insertProject: InsertProjectModel; memberUserIds: string[] }> = [];

    for (let p = 0; p < numProjects; p++) {
      // Pick a random org member as the project creator
      const creator = faker.helpers.arrayElement(orgMemberships);

      // Pick random members for this project
      const numMembers = Math.min(faker.number.int(membersPerProject), orgMemberships.length);
      const shuffled = [...orgMemberships].sort(() => 0.5 - Math.random());
      // Ensure creator is included
      const projectOrgMembers = [creator, ...shuffled.filter((m) => m.userId !== creator.userId)].slice(0, numMembers);

      // Ensure admin is a project member in their orgs (up to cap)
      const includeAdmin = adminOrgIds.includes(organization.id) && adminProjectMembershipCount < adminProjectMembershipCap;
      if (includeAdmin && !projectOrgMembers.some((m) => m.userId === defaultAdminUser.id)) {
        // Find admin's org membership to add them
        const adminOrgMembership = orgMemberships.find((m) => m.userId === defaultAdminUser.id);
        if (adminOrgMembership) projectOrgMembers.push(adminOrgMembership);
      }
      if (includeAdmin) adminProjectMembershipCount++;

      const proj = mockProject(seedSuffix());
      const insertProject: InsertProjectModel = {
        ...proj,
        tenantId: organization.tenantId,
        organizationId: organization.id,
        createdBy: creator.userId,
        updatedBy: creator.userId,
      };

      projectEntries.push({ insertProject, memberUserIds: projectOrgMembers.map((m) => m.userId) });
    }

    if (projectEntries.length === 0) continue;

    // Phase B: Batch-insert all projects for this org
    const insertedProjects = await db
      .insert(projectsTable)
      .values(projectEntries.map((e) => e.insertProject))
      .onConflictDoNothing()
      .returning();

    const insertedProjectIds = new Set(insertedProjects.map((p) => p.id));

    // Phase C: Prepare labels for all inserted projects
    const allOrgLabels: InsertLabelModel[] = [];
    const labelsPerProjectMap = new Map<string, InsertLabelModel[]>();
    const primaryLabelsPerProjectMap = new Map<string, string[]>();

    for (const { insertProject, memberUserIds } of projectEntries) {
      const projectId = insertProject.id!;
      if (!insertedProjectIds.has(projectId)) continue;

      projectsCount++;
      projectDataMap.set(projectId, { tenantId: organization.tenantId, organizationId: organization.id, memberUserIds });

      for (const userId of memberUserIds) {
        const key = `${userId}:${organization.id}`;
        const existing = userProjectsMap.get(key);
        if (existing) existing.push(projectId);
        else userProjectsMap.set(key, [projectId]);
      }

      const getRandomMember = () => memberUserIds[Math.floor(Math.random() * memberUserIds.length)] ?? null;

      const projectLabels: InsertLabelModel[] = Array.from({ length: labelsPerProject }, () => {
        const label = mockLabel(`label:seed:${seedSuffix()}`, seedSuffix());
        return {
          ...label,
          id: mockUuid(),
          tenantId: organization.tenantId,
          organizationId: organization.id,
          projectId,
          createdBy: getRandomMember(),
          updatedBy: getRandomMember(),
        };
      });

      allOrgLabels.push(...projectLabels);
      labelsPerProjectMap.set(projectId, projectLabels);

      // Tracked primary label set per project, provisioned from the org's setupConfig defaults.
      // Kept out of labelsPerProjectMap: task label arrays reference secondary labels only.
      const primaryRows = buildPrimaryLabelRows({
        entries: appConfig.defaultSetupConfig.primaryLabels,
        projectId,
        organizationId: organization.id,
        tenantId: organization.tenantId,
        createdBy: getRandomMember(),
      }).map((row) => ({ ...row, id: mockUuid() }));
      allOrgLabels.push(...primaryRows);
      primaryLabelsPerProjectMap.set(projectId, primaryRows.map((row) => row.id));
    }

    // Phase D: Batch-insert all labels for this org
    labelsCount += allOrgLabels.length;
    for (let i = 0; i < allOrgLabels.length; i += insertBatchSize) {
      await db.insert(labelsTable).values(allOrgLabels.slice(i, i + insertBatchSize)).onConflictDoNothing();
    }

    // Phase E: Prepare tasks for all inserted projects
    const allOrgTasks: InsertTaskModel[] = [];

    for (const { insertProject, memberUserIds } of projectEntries) {
      const projectId = insertProject.id!;
      if (!insertedProjectIds.has(projectId)) continue;

      const projectLabels = labelsPerProjectMap.get(projectId) ?? [];
      const projectLabelIds = projectLabels.map((l) => l.id!);
      const getRandomMember = () => memberUserIds[Math.floor(Math.random() * memberUserIds.length)] ?? null;

      // Variable amount of tasks per project (20%-200% of base count)
      const amount = Math.floor(faker.number.float({ min: 0.2, max: 2.0 }) * avgTasksPerProject);

      // Ensure ~20% of tasks are old accepted tasks (created 1-6 months ago)
      const oldAcceptedCount = Math.max(2, Math.floor(amount * 0.2));

      const projectTasks: InsertTaskModel[] = Array.from({ length: amount }, (_, index) => {
        const name = randomPhrase();
        const taskDescription = `${randomPhrase()} ${randomPhrase()}`;
        const hasChecklist = faker.datatype.boolean();
        const checklistCount = hasChecklist ? faker.number.int({ min: 1, max: 6 }) : 0;
        const description = createDescription(name, taskDescription, checklistCount);
        const blocks = JSON.parse(description) as { type: string }[];
        const expandable = blocks.length > 1;
        const keywords = extractKeywordsFromBlocks(description);
        const checkboxCount = checklistCount;
        const checkedCount = 0;

        const isOldAccepted = index < oldAcceptedCount;
        const oldDate = faker.date.between({ from: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), to: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }).toISOString();

        // Pick random assignees and labels by index sampling (avoids full-array sort per task)
        const assigneeCount = Math.floor(Math.random() * 2) + 1;
        const assigneeSet = new Set<string>();
        while (assigneeSet.size < Math.min(assigneeCount, memberUserIds.length)) {
          assigneeSet.add(memberUserIds[Math.floor(Math.random() * memberUserIds.length)]);
        }
        const assignedTo = [...assigneeSet];

        const labelCount = Math.floor(Math.random() * 3) + 2;
        const labelSet = new Set<string>();
        while (labelSet.size < Math.min(labelCount, projectLabelIds.length)) {
          labelSet.add(projectLabelIds[Math.floor(Math.random() * projectLabelIds.length)]);
        }

        return {
          id: mockUuid(),
          entityType: 'task' as const,
          name,
          tenantId: organization.tenantId,
          organizationId: organization.id,
          projectId,
          summary: name,
          summaryLength: name.length,
          keywords,
          expandable,
          assignedTo,
          labels: [...labelSet],
          displayOrder: index * 10,
          status: isOldAccepted ? TaskStatus.Accepted : Math.floor(Math.random() * 7),
          statusChangedAt: isOldAccepted ? oldDate : mockPastIsoDate(),
          primaryLabelId: faker.helpers.arrayElement(primaryLabelsPerProjectMap.get(projectId) ?? [mockUuid()]),
          description,
          checkboxCount,
          checkedCount,
          createdAt: isOldAccepted ? oldDate : mockPastIsoDate(),
          createdBy: getRandomMember(),
          updatedAt: isOldAccepted ? oldDate : mockPastIsoDate(),
          updatedBy: getRandomMember(),
          stx: createServerStx(),
        };
      });

      allOrgTasks.push(...projectTasks);
    }

    // Phase F: Batch-insert all tasks for this org (chunked)
    tasksCount += allOrgTasks.length;
    for (let i = 0; i < allOrgTasks.length; i += insertBatchSize) {
      await db.insert(tasksTable).values(allOrgTasks.slice(i, i + insertBatchSize)).onConflictDoNothing();
    }
  }

  // --- Pass 2: Plan workspaces with all members, then materialize ---
  type WorkspacePlan = {
    workspace: InsertWorkspaceModel;
    members: Array<{
      userId: string;
      role: 'admin' | 'member';
      projectIds: string[];
      archived?: boolean;
    }>;
  };

  const workspacePlans: WorkspacePlan[] = [];
  let adminWorkspaceMembershipCount = 0;

  for (const [key, projectIds] of userProjectsMap) {
    const [userId, organizationId] = key.split(':');
    const organization = organizations.find((o) => o.id === organizationId);
    if (!organization) continue;

    const ws = mockWorkspace(seedSuffix());
    const plan: WorkspacePlan = {
      workspace: {
        ...ws,
        tenantId: organization.tenantId,
        organizationId: organization.id,
        createdBy: userId,
        updatedBy: userId,
      },
      members: [{ userId, role: 'admin', projectIds }],
    };

    // Add admin as additional member only if they share projects in this workspace
    const isAdminOrg = adminOrgIds.includes(organization.id);
    if (isAdminOrg && userId !== defaultAdminUser.id && adminWorkspaceMembershipCount < adminWorkspaceMembershipCap) {
      const adminKey = `${defaultAdminUser.id}:${organizationId}`;
      const adminProjectIds = userProjectsMap.get(adminKey) ?? [];
      const sharedProjectIds = projectIds.filter((pid) => adminProjectIds.includes(pid));

      if (sharedProjectIds.length > 0) {
        plan.members.push({
          userId: defaultAdminUser.id,
          role: 'member',
          projectIds: sharedProjectIds,
          archived: faker.datatype.boolean(0.5),
        });
        adminWorkspaceMembershipCount++;
      }
    }

    workspacePlans.push(plan);
  }

  // Batch-insert all workspaces
  const allWorkspaceInserts = workspacePlans.map((p) => p.workspace);
  workspacesCount = allWorkspaceInserts.length;
  for (let i = 0; i < allWorkspaceInserts.length; i += insertBatchSize) {
    await db.insert(workspacesTable).values(allWorkspaceInserts.slice(i, i + insertBatchSize)).onConflictDoNothing();
  }

  // Materialize all memberships (workspace + project) from plans
  const allPass2Memberships: InsertMembershipModel[] = [];
  let adminDisplayOrder = 0;
  // Track (userId:projectId) to ensure one project membership per user (first workspace wins)
  const seenProjectMemberships = new Set<string>();

  for (const plan of workspacePlans) {
    const workspaceId = plan.workspace.id!;
    const organizationId = plan.workspace.organizationId!;

    for (const member of plan.members) {
      // Workspace membership
      const wsMembership = mockChannelMembership(
        'workspace',
        plan.workspace as Parameters<typeof mockChannelMembership>[1],
        { id: member.userId },
        { organizationId },
      );
      allPass2Memberships.push({
        ...wsMembership,
        role: member.role,
        ...(member.archived != null && { archived: member.archived }),
        ...(member.role !== 'admin' && { displayOrder: adminDisplayOrder }),
      });
      if (member.role !== 'admin') adminDisplayOrder += 10;

      // Project memberships: one per (user, project), linked to the first workspace encountered.
      for (const projectId of member.projectIds) {
        const projData = projectDataMap.get(projectId);
        if (!projData) continue;

        const key = `${member.userId}:${projectId}`;
        if (seenProjectMemberships.has(key)) continue;
        seenProjectMemberships.add(key);

        allPass2Memberships.push(
          mockChannelMembership(
            'project',
            { id: projectId, tenantId: projData.tenantId } as Parameters<typeof mockChannelMembership>[1],
            { id: member.userId },
            { organizationId: projData.organizationId, workspaceId },
          ),
        );
      }
    }
  }

  // Batch-insert all memberships
  membershipsCount = allPass2Memberships.length;
  for (let i = 0; i < allPass2Memberships.length; i += insertBatchSize) {
    await db.insert(membershipsTable).values(allPass2Memberships.slice(i, i + insertBatchSize)).onConflictDoNothing();
  }

  succeedSpinner(`Created ${workspacesCount} workspaces, ${projectsCount} projects, ${tasksCount} tasks, ${labelsCount} labels, ${membershipsCount} memberships`);
};

export const seedConfig: SeedScript = { name: 'tasks', run: tasksSeed, allowProduction: false };
