import type { InsertAttachmentModel } from '#/modules/attachment/attachment-db';
import { mockAttachment } from '#/modules/attachment/attachment-mocks';
import { registerBenchSeed } from '../registry';
import { attachmentId, CORE_ID_VARIANTS, ORG_ID, projectId, TENANT_ID, userId } from './ids';
import { TOTAL_PROJECTS } from './project.bench';

export const TOTAL_ATTACHMENTS = 500;

/**
 * Reference implementation for the app seed pattern.
 *
 * @see seeds/README.md
 */
export const loadtestAttachment = (index: number): InsertAttachmentModel => ({
  ...mockAttachment(`attachment:loadtest:${index}`),
  id: attachmentId(index),
  tenantId: TENANT_ID,
  name: `Load Test Attachment ${index}`,
  filename: `xbench-file-${index}.pdf`,
  contentType: 'application/pdf',
  size: '1024',
  bucketName: 'attachments',
  keys: { original: `uploads/xbench/${attachmentId(index)}/xbench-file-${index}.pdf` },
  organizationId: ORG_ID,
  // fork: attachments are project-homed (FK on project_id), so each row lands in a seeded bench project
  projectId: projectId(index % TOTAL_PROJECTS),
  createdBy: userId(index % 100),
  updatedBy: userId(index % 100),
});

registerBenchSeed({
  table: 'attachments',
  // fork: after projects (order 110), the attachment home
  order: 115,
  pgArrayColumns: ['mentions'],
  idVariant: CORE_ID_VARIANTS.attachment,
  rows: ({ now }) =>
    Array.from({ length: TOTAL_ATTACHMENTS }, (_, i) => ({ ...loadtestAttachment(i), createdAt: now, seq: 0 })),
});
