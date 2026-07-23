import type { SeedScript } from '../types';
import { faker } from '@faker-js/faker';
import { appConfig } from 'shared';
import { startSpinner, succeedSpinner, warnSpinner } from '#/utils/console';
import { seedDb } from '#/db/db';
import { attachmentsTable } from '#/modules/attachment/attachment-db';
import { organizationsTable } from '#/modules/organization/organization-db';
import { projectsTable } from '#/modules/project/project-db';
import { mockStx, mockUuid, setMockContext, withFakerSeed } from '#/mocks';
import { defaultAdminUser } from '../fixtures';

// Seed scripts use admin connection for privileged operations
const db = seedDb;

// Set mock context for seed script - UUIDs get '00000000-' prefix, nanoids get 'gen-' prefix
setMockContext('script');

/**
 * Known S3 files that should exist in the dev bucket under the `seed/` prefix.
 * Each seeded organization gets one attachment per file, assigned to one of its projects.
 */
const SEED_FILES = [
  { filename: 'sample-image.webp', contentType: 'image/webp', size: '24500', originalKey: 'seed/sample-image.webp', publicBucket: true },
  { filename: 'sample-document.pdf', contentType: 'application/pdf', size: '145000', originalKey: 'seed/sample-document.pdf', publicBucket: false },
  { filename: 'sample-text.txt', contentType: 'text/plain', size: '1200', originalKey: 'seed/sample-text.txt', publicBucket: false },
  { filename: 'sample-photo.jpg', contentType: 'image/jpeg', size: '89000', originalKey: 'seed/sample-photo.jpg', publicBucket: true },
  { filename: 'sample-spreadsheet.csv', contentType: 'text/csv', size: '3400', originalKey: 'seed/sample-spreadsheet.csv', publicBucket: false },
];

const isAttachmentSeeded = async () => {
  const rows = await db.select().from(attachmentsTable).limit(1);
  return rows.length > 0;
};

/**
 * Seeds the database with attachment rows for each seeded organization.
 * Records reference pre-existing files in the dev S3 bucket under `seed/`.
 */
export const attachmentsSeed = async () => {
  const spinner = startSpinner('Seeding attachments...');

  if (await isAttachmentSeeded()) {
    warnSpinner('Attachments table not empty → skip seeding');
    return;
  }

  // Fetch all seeded organizations (need tenantId + id for FK constraints)
  const organizations = await db.select({ id: organizationsTable.id, tenantId: organizationsTable.tenantId }).from(organizationsTable);
  const projects = await db.select({ id: projectsTable.id, organizationId: projectsTable.organizationId }).from(projectsTable);

  if (!organizations.length) {
    spinner.fail('No organizations found → run organization seed first');
    return;
  }

  const projectIdsByOrganization = new Map<string, string[]>();

  for (const project of projects) {
    const projectIds = projectIdsByOrganization.get(project.organizationId);
    if (projectIds) projectIds.push(project.id);
    else projectIdsByOrganization.set(project.organizationId, [project.id]);
  }

  let totalCreated = 0;
  let skippedOrganizations = 0;

  for (const org of organizations) {
    const projectIds = projectIdsByOrganization.get(org.id);

    if (!projectIds?.length) {
      skippedOrganizations++;
      continue;
    }

    const records = SEED_FILES.map((file, i) =>
      withFakerSeed(`attachment:seed:${org.id}:${i}`, () => {
        const createdAt = faker.date.recent({ days: 30 }).toISOString();
        return {
          id: mockUuid(),
          entityType: 'attachment' as const,
          tenantId: org.tenantId,
          organizationId: org.id,
          projectId: projectIds[i % projectIds.length],
          createdAt,
          updatedAt: createdAt,
          createdBy: defaultAdminUser.id,
          updatedBy: defaultAdminUser.id,
          stx: mockStx(),
          description: null,
          keywords: faker.lorem.words(3),
          filename: file.filename,
          name: file.filename,
          contentType: file.contentType,
          size: file.size,
          originalKey: file.originalKey,
          publicBucket: file.publicBucket,
          bucketName: file.publicBucket ? appConfig.s3.publicBucket : appConfig.s3.privateBucket,
        };
      }),
    );

    await db.insert(attachmentsTable).values(records).onConflictDoNothing();
    totalCreated += records.length;
  }

  if (skippedOrganizations > 0) {
    warnSpinner(`Skipped ${skippedOrganizations} organizations with no projects`);
  }

  succeedSpinner(`Created ${totalCreated} attachments across ${organizations.length} organizations`);
};

export const seedConfig: SeedScript = { name: 'attachments', run: attachmentsSeed };
