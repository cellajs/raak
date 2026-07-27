import type { Label } from 'sdk';
import { isUnconditionalCan } from 'shared';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { CollaborativeBlockNote } from '~/modules/common/blocknote/collaborative-blocknote';
import { useLabelDescriptionUpdate } from '~/modules/label/use-label-description-update';
import { findProjectByIdOrSlug } from '~/modules/project/query';
import { useProjectMembers } from '~/modules/project/use-project-members';

const editorStyle = '[&>.bn-editor]:min-h-24 w-full bg-transparent border-none';
/** Left gutter gives the block drag handle (side menu) room; it renders outside the text edge. */
const gutterStyle = 'pt-3 pr-4 pb-5 pl-2 sm:pl-9';

/**
 * Hosts the collaborative BlockNote editor for documenting an epic label; the shared
 * CollaborativeBlockNote owns the Yjs gates and fallback. Task-only primitives
 * (checklist) and file blocks (no label attachment host yet) are excluded.
 */
export function LabelDescriptionForm({ label }: { label: Label }) {
  const { tenantId } = useOrganizationLayoutContext();

  const project = findProjectByIdOrSlug(label.projectId, tenantId);
  const canEdit = isUnconditionalCan(project?.can?.label?.update);

  const projectMembers = useProjectMembers(label.projectId, tenantId, label.organizationId);
  const updateData = useLabelDescriptionUpdate(label);

  return (
    <div className={gutterStyle}>
      <CollaborativeBlockNote
        entityType="label"
        entityId={label.id}
        tenantId={tenantId}
        canEdit={canEdit}
        description={label.description}
        updateData={updateData}
        editable={canEdit}
        members={projectMembers}
        className={editorStyle}
        dense
        excludeBlockTypes={['checklistItem']}
        excludeFileBlockTypes={['file', 'image', 'audio', 'video']}
        trailingBlock={false}
        formattingToolbar={false}
        clickOpensPreview
      />
    </div>
  );
}
