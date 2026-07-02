import { queryOptions } from '@tanstack/react-query';
import { createChat, type GetChatsData, type GetMessagesData, getChats, getMessages, sendMessage } from 'sdk';
import { appConfig } from 'shared';
import { createEntityKeys, registerEntityQueryKeys } from '~/query/basic';
import { syncStaleTime } from '~/query/basic/sync-stale-config';

export type { Chat, Message } from 'sdk';

// --- chat keys ---

type ChatFilters = Omit<NonNullable<GetChatsData['query']>, 'limit' | 'offset' | 'seqCursor'>;

const chatBaseKeys = createEntityKeys<ChatFilters>('chat');
const chatKeys = {
  ...chatBaseKeys,
  list: {
    ...chatBaseKeys.list,
    filtered: (organizationId: string, filters: ChatFilters) => ['chat', 'list', organizationId, filters] as const,
  },
};
export const chatQueryKeys = chatKeys;

// --- message keys (CDC sync for completed messages) ---

type MessageFilters = { chatId?: string };

const messageBaseKeys = createEntityKeys<MessageFilters>('message');
const messageKeys = {
  ...messageBaseKeys,
  list: {
    ...messageBaseKeys.list,
    filtered: (organizationId: string, filters: MessageFilters) =>
      ['message', 'list', organizationId, filters] as const,
  },
};
registerEntityQueryKeys('message', messageKeys);
export const messageQueryKeys = messageKeys;

// --- Query options ---

const chatsLimit = appConfig.requestLimits.chats;
const messagesLimit = appConfig.requestLimits.messages;

type ChatsListParams = ChatFilters & GetChatsData['path'] & { limit?: number };

registerEntityQueryKeys('chat', chatKeys, (organizationId, tenantId, seqCursor, options) => {
  return getChats({
    baseUrl: appConfig.backendUrl,
    path: { tenantId: tenantId!, organizationId: organizationId! },
    query: { seqCursor, limit: '1000' },
    headers: options?.cacheToken ? { 'x-cache-token': options.cacheToken } : undefined,
  });
});

export const chatsListQueryOptions = ({
  tenantId,
  organizationId,
  q,
  sort = 'createdAt',
  order = 'desc',
  archived = 'false',
  limit = chatsLimit,
}: ChatsListParams) => {
  const filters = { q, sort, order, archived };

  return queryOptions({
    queryKey: chatKeys.list.filtered(organizationId, filters),
    queryFn: async () => {
      return getChats({
        baseUrl: appConfig.backendUrl,
        path: { tenantId, organizationId },
        query: {
          q,
          sort,
          order,
          archived,
          limit: String(limit),
        },
      });
    },
    staleTime: syncStaleTime,
  });
};

type MessagesParams = Omit<NonNullable<GetMessagesData['query']>, 'limit' | 'offset' | 'seqCursor'> &
  GetMessagesData['path'] & { limit?: number };

export const messagesQueryOptions = ({
  tenantId,
  organizationId,
  id,
  sort = 'createdAt',
  order = 'asc',
  limit = messagesLimit,
}: MessagesParams) => {
  return queryOptions({
    queryKey: messageKeys.list.filtered(organizationId, { chatId: id }),
    queryFn: async () => {
      return getMessages({
        baseUrl: appConfig.backendUrl,
        path: { tenantId, organizationId, id },
        query: {
          sort,
          order,
          limit: String(limit),
        },
      });
    },
    staleTime: syncStaleTime,
  });
};

// --- mutations ---

interface CreateChatParams {
  tenantId: string;
  organizationId: string;
  content: string;
}

/** Persist a new chat with its initial user message on the main API. Returns the created chat. */
export const createChatMutationFn = ({ tenantId, organizationId, content }: CreateChatParams) =>
  createChat({
    baseUrl: appConfig.backendUrl,
    path: { tenantId, organizationId },
    body: { content },
  });

interface SendMessageParams {
  tenantId: string;
  organizationId: string;
  chatId: string;
  content: string;
}

/** Persist a user message on the main API. Returns the created message. */
export const sendMessageMutationFn = ({ tenantId, organizationId, chatId, content }: SendMessageParams) =>
  sendMessage({
    baseUrl: appConfig.backendUrl,
    path: { tenantId, organizationId, id: chatId },
    body: { content },
  });
