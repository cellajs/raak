import { projectId } from './ids';
import { TOTAL_PROJECTS } from './project.bench';

/**
 * The channels a bench attachment lives in below the organization, by row index: one entry per ancestor id column
 * its row needs. The attachment seed stamps them on its rows and the scenarios that create attachments send the
 * deepest one as the home, so an app says it once, here.
 *
 * Raak's attachments are project-homed (FK on project_id), so each row lands in a seeded bench project.
 */
export const benchAttachmentHome = (index: number): Record<string, string> => ({
  projectId: projectId(index % TOTAL_PROJECTS),
});

/** Where the attachment seed runs among the seeds: after the seed of every channel `benchAttachmentHome` names. */
export const attachmentSeedOrder = 115;
