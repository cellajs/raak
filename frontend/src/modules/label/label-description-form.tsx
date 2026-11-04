import type { Label } from 'sdk';
import { CollaborativeBlockNote } from '~/modules/common/blocknote/collaborative-blocknote';
import { useCan } from '~/modules/entities/use-can';
import { useLabelDescriptionUpdate } from '~/modules/label/use-label-description-update';
import { findProjectByIdOrSlug } from '~/modules/project/query';
import { useProjectMembers } from '~/modules/project/use-project-members';
import { tw } from '~/utils/tw';

const editorClass = tw('w-full border-none bg-transparent [&>.bn-editor]:min-h-24');
/** Left gutter gives the block drag handle (side menu) room; it renders outside the text edge. */
const gutterClass = tw('pt-3 pr-4 pb-5 pl-2 sm:pl-9');

/** Collaborative editor for an epic label's description. Checklists are task-only and labels have no attachment host yet, so both block kinds are excluded. */
export function LabelDescriptionForm({ label, isLocked }: { label: Label; isLocked: boolean }) {
  const project = findProjectByIdOrSlug(label.projectId, label.tenantId);
  const can = useCan();
  const canEdit = !isLocked && !!project && can('update', 'label', project);

  const projectMembers = useProjectMembers(label.projectId, label.tenantId, label.organizationId);
  const updateData = useLabelDescriptionUpdate(label);

  return (
    <div className={gutterClass}>
      <CollaborativeBlockNote
        entityType="label"
        entityId={label.id}
        tenantId={label.tenantId}
        organizationId={label.organizationId}
        canEdit={canEdit}
        description={label.description}
        updateData={updateData}
        members={projectMembers}
        className={editorClass}
        dense
        excludeBlockTypes={['checklistItem']}
        excludeMediaBlockTypes={['file', 'image', 'audio', 'video']}
        trailingBlock={false}
        formattingToolbar={false}
        clickOpensPreview
      />
    </div>
  );
}
