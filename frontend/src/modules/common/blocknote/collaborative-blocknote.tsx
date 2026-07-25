import i18n from 'i18next';
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from 'react';
import { appConfig, type ProductEntityType } from 'shared';
import { useOnlineManager } from '~/hooks/use-online-manager';
import { BlockNote } from '~/modules/common/blocknote/blocknote-editor';
import { useYjsConnection } from '~/modules/common/blocknote/yjs-connections';
import { Spinner } from '~/modules/common/spinner';
import { toaster } from '~/modules/common/toaster/toaster';
import { useCurrentUser, useUserStore, yjsTokenKey } from '~/modules/user/user-store';
import { getRandomColor } from '~/utils/random-color';

// BlockNote's props are a union (filePanel variants), so Omit must distribute over it
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

type PassthroughProps = DistributiveOmit<
  ComponentProps<typeof BlockNote>,
  'collaboration' | 'defaultValue' | 'updateData' | 'onBeforeLoad' | 'id'
>;

type CollaborativeBlockNoteProps = PassthroughProps & {
  entityType: ProductEntityType;
  entityId: string;
  tenantId: string;
  /** Unconditional update permission; collaboration only activates when it holds (the relay re-verifies). */
  canEdit: boolean;
  /** Stored description blocks (the entity row's source of truth outside a session). */
  description: string | null;
  /** Persistence policy; receives the live collaboration state per call. */
  updateData: (description: string, collaborative: boolean) => Promise<void> | void;
  /** Rendered while waiting for the first WS sync (avoids an empty flash). Defaults to a spinner. */
  waitingFallback?: ReactNode;
};

/**
 * BlockNote host for an entity description with optional Yjs collaboration. Owns the
 * token/online/permission gates, the relay connection, the brief sync-wait before
 * standalone fallback, and the standalone reconcile of unsaved editor content on load.
 */
export function CollaborativeBlockNote({
  entityType,
  entityId,
  tenantId,
  canEdit,
  description,
  updateData,
  waitingFallback,
  ...blockNoteProps
}: CollaborativeBlockNoteProps) {
  const user = useCurrentUser();

  const tokenKey = yjsTokenKey(entityType, tenantId);
  const yjsToken = useUserStore((s) => s.yjsTokens[tokenKey]);
  const isOnline = useOnlineManager();
  const canCollaborate = !!appConfig.yjsUrl && isOnline && !!yjsToken && canEdit;

  // Connect to the Yjs relay; the connection manager handles ref-counting and grace periods.
  // The token proves update permission; entity-level access is verified asynchronously.
  const yjsConn = useYjsConnection(canCollaborate ? entityId : undefined, entityType, tenantId);
  const wsReady = yjsConn?.synced ?? false;

  // Wait briefly for WS sync before falling back to standalone mode.
  // This avoids mounting the editor twice (standalone -> collaborative).
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

  // Stable random color for cursor labels
  const userColorRef = useRef(getRandomColor());

  const collaborationBundle =
    collaborative && yjsConn
      ? {
          provider: yjsConn.provider,
          fragment: yjsConn.fragment,
          user: { name: user.name, color: userColorRef.current },
          entityType,
          entityId,
        }
      : undefined;

  if (waitingForSync) return waitingFallback ?? <Spinner className="my-8 h-6 w-6 opacity-50" />;

  return (
    <BlockNote
      // Force a remount when the mode flips: useCreateBlockNote captures the
      // collaboration config at creation, so a late non-collab -> collab switch
      // must not reuse the standalone editor instance.
      key={collaborative ? 'collab' : 'solo'}
      id={`blocknote-${entityId}`}
      defaultValue={description ?? undefined}
      updateData={(blocks) => void updateData(blocks, collaborative)}
      collaboration={collaborationBundle}
      onBeforeLoad={
        collaborative
          ? undefined
          : (editor) => {
              const strBlocks = JSON.stringify(editor.document);
              if (description === null || strBlocks === description) return;
              void updateData(strBlocks, collaborative);
            }
      }
      {...blockNoteProps}
    />
  );
}
