import sampleContent from '#json/sample-content.json';

const samplePersonIds = new Set(sampleContent.people.map(({ id }) => id));

/** Whether an account belongs to the sample team. */
export const isSamplePerson = (id: string | null | undefined) => !!id && samplePersonIds.has(id);

/** Whether a project is part of its organization's sample: a sample person created it. */
export const isSampleProject = (project: { createdBy: { id: string } | null }) => isSamplePerson(project.createdBy?.id);
