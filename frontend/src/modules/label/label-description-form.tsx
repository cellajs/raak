import i18n from 'i18next';
import { useEffect, useRef, useState } from 'react';
import type { Label } from 'sdk';
import { appConfig, isUnconditionalCan } from 'shared';
import { useOnlineManager } from '~/hooks/use-online-manager';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { BlockNote } from '~/modules/common/blocknote/blocknote-editor';
import { useYjsConnection } from '~/modules/common/blocknote/yjs-connections';
import { Spinner } from '~/modules/common/spinner';
import { toaster } from '~/modules/common/toaster/toaster';
import { useLabelDescriptionUpdate } from '~/modules/label/use-label-description-update';
import { findProjectByIdOrSlug } from '~/modules/project/query';
import { useProjectMembers } from '~/modules/task/hooks/use-project-members';
import { useCurrentUser, useUserStore, yjsTokenKey } from '~/modules/user/user-store';
import { getRandomColor } from '~/utils/random-color';

const editorStyle = '[&>.bn-editor]:min-h-24 w-full bg-transparent border-none';

/**
 * Hosts the BlockNote editor for documenting an epic label. Collaborative (Yjs) when
 * configured and online, falling back to the standard update mutation. Task-only
 * primitives (checklist) and file blocks (no label attachment host yet) are excluded.
 */
export function LabelDescriptionForm({ label }: { label: Label }) {
  const { tenantId } = useOrganizationLayoutContext();
  const user = useCurrentUser();

  const tokenKey = yjsTokenKey('label', tenantId);
  const yjsToken = useUserStore((s) => s.yjsTokens[tokenKey]);

  // Collaborative editing: requires yjsUrl, a token, online connectivity, and unconditional update permission.
  const yjsConfigured = !!appConfig.yjsUrl;
  const isOnline = useOnlineManager();
  const project = findProjectByIdOrSlug(label.projectId, tenantId);
  const canEdit = isUnconditionalCan(project?.can?.label?.update);
  const canCollaborate = yjsConfigured && isOnline && !!yjsToken && canEdit;

  const yjsConn = useYjsConnection(canCollaborate ? label.id : undefined, 'label', tenantId);
  const wsReady = yjsConn?.synced ?? false;

  // Wait briefly for WS sync before falling back to standalone mode (avoids double mount).
  const [syncTimedOut, setSyncTimedOut] = useState(false);
  const toastShownRef = useRef(false);
  useEffect(() => {
    if (!canCollaborate || wsReady) return;
    const timer = setTimeout(() => {
      setSyncTimedOut(true);
      if (!toastShownRef.current) {
        toastShownRef.current = true;
        toaster.warning(i18n.t('error:sync_failed.text'));
      }
    }, 3_000);
    return () => clearTimeout(timer);
  }, [canCollaborate, wsReady]);

  const waitingForSync = canCollaborate && !wsReady && !syncTimedOut;
  const collaborative = canCollaborate && wsReady;

  const projectMembers = useProjectMembers(label.projectId, tenantId, label.organizationId);
  const updateData = useLabelDescriptionUpdate(label, collaborative);

  // Stable random color for cursor labels
  const userColorRef = useRef(getRandomColor());

  const collaborationBundle =
    collaborative && yjsConn
      ? {
          provider: yjsConn.provider,
          fragment: yjsConn.fragment,
          user: { name: user.name, color: userColorRef.current },
          entityType: 'label' as const,
          entityId: label.id,
        }
      : undefined;

  if (waitingForSync) return <Spinner className="my-8 h-6 w-6 opacity-50" />;

  return (
    <BlockNote
      // Force a remount when the mode flips: the editor captures the collaboration
      // config at creation, so a late non-collab -> collab switch must not reuse it.
      key={collaborative ? 'collab' : 'solo'}
      id={`blocknote-label-${label.id}`}
      editable={canEdit}
      members={projectMembers}
      defaultValue={label.description ?? undefined}
      className={editorStyle}
      dense
      updateData={updateData}
      excludeBlockTypes={['checklistItem']}
      excludeFileBlockTypes={['file', 'image', 'audio', 'video']}
      trailingBlock={false}
      formattingToolbar={false}
      clickOpensPreview
      collaboration={collaborationBundle}
      onBeforeLoad={
        collaborative
          ? undefined
          : (editor) => {
              const strBlocks = JSON.stringify(editor.document);
              if (label.description === null || strBlocks === label.description) return;
              updateData(strBlocks);
            }
      }
    />
  );
}
