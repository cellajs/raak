import { z } from '@hono/zod-openapi';
import { createXRoute } from '#/core/x-routes';
import { authGuard, orgGuard, tenantGuard } from '#/middlewares/guard';
import {
  chatCreateBodySchema,
  chatListQuerySchema,
  chatSchema,
  chatUpdateBodySchema,
  messageCreateBodySchema,
  messageListQuerySchema,
  messageSchema,
} from '#/modules/agent/agent-schema';
import {
  batchResponseSchema,
  errorResponseRefs,
  idInTenantOrgParamSchema,
  idsBodySchema,
  paginationSchema,
  tenantOrgParamSchema,
} from '#/schemas';

const aiRoutes = {
  createChat: createXRoute({
    operationId: 'createChat',
    method: 'post',
    path: '/',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['agent', 'app', 'product'],
    summary: 'Create chat',
    description:
      'Creates a new chat session with an initial user message and returns the chat. The assistant response is streamed separately via the AI worker streamChat endpoint.',
    request: {
      params: tenantOrgParamSchema,
      body: { required: true, content: { 'application/json': { schema: chatCreateBodySchema } } },
    },
    responses: {
      200: {
        description: 'Chat created',
        content: { 'application/json': { schema: chatSchema } },
      },
      ...errorResponseRefs,
    },
  }),

  getChats: createXRoute({
    operationId: 'getChats',
    method: 'get',
    path: '/',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['agent', 'app', 'product'],
    summary: 'Get chats',
    description: 'Returns a paginated list of chat sessions for the current user.',
    request: {
      params: tenantOrgParamSchema,
      query: chatListQuerySchema,
    },
    responses: {
      200: {
        description: 'Chats',
        content: { 'application/json': { schema: paginationSchema(chatSchema) } },
      },
      ...errorResponseRefs,
    },
  }),

  getMessages: createXRoute({
    operationId: 'getMessages',
    method: 'get',
    path: '/{id}/messages',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['agent', 'app', 'product'],
    summary: 'Get messages',
    description: 'Returns a paginated list of messages for a chat session.',
    request: {
      params: idInTenantOrgParamSchema,
      query: messageListQuerySchema,
    },
    responses: {
      200: {
        description: 'Messages',
        content: { 'application/json': { schema: paginationSchema(messageSchema) } },
      },
      ...errorResponseRefs,
    },
  }),

  sendMessage: createXRoute({
    operationId: 'sendMessage',
    method: 'post',
    path: '/{id}/messages',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['agent', 'app', 'product'],
    summary: 'Send message',
    description:
      'Persists a user message and returns it. The assistant response is streamed separately via the AI worker streamChat endpoint.',
    request: {
      params: idInTenantOrgParamSchema,
      body: { required: true, content: { 'application/json': { schema: messageCreateBodySchema } } },
    },
    responses: {
      200: {
        description: 'Message created',
        content: { 'application/json': { schema: messageSchema } },
      },
      ...errorResponseRefs,
    },
  }),

  // Worker-only route: mounted exclusively on the AI worker (not the main API),
  // so it is intentionally absent from the generated OpenAPI spec / SDK.
  streamChat: createXRoute({
    operationId: 'streamChat',
    method: 'post',
    path: '/{id}/stream',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['agent', 'app', 'product'],
    summary: 'Stream chat response',
    description: 'Streams the assistant response (SSE) for an existing chat and persists the assistant message.',
    request: {
      params: idInTenantOrgParamSchema,
    },
    responses: {
      200: {
        description: 'SSE stream with assistant response',
        content: { 'text/event-stream': { schema: z.any() } },
      },
      ...errorResponseRefs,
    },
  }),

  updateChat: createXRoute({
    operationId: 'updateChat',
    method: 'put',
    path: '/{id}',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['agent', 'app', 'product'],
    summary: 'Update chat',
    description: 'Updates a chat session (rename or archive).',
    request: {
      params: idInTenantOrgParamSchema,
      body: { required: true, content: { 'application/json': { schema: chatUpdateBodySchema } } },
    },
    responses: {
      200: {
        description: 'Chat updated',
        content: { 'application/json': { schema: chatSchema } },
      },
      ...errorResponseRefs,
    },
  }),

  deleteChats: createXRoute({
    operationId: 'deleteChats',
    method: 'delete',
    path: '/',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['agent', 'app', 'product'],
    summary: 'Delete chats',
    description: 'Deletes one or more chat sessions and their messages.',
    request: {
      params: tenantOrgParamSchema,
      body: { content: { 'application/json': { schema: idsBodySchema() } } },
    },
    responses: {
      200: {
        description: 'Success',
        content: { 'application/json': { schema: batchResponseSchema() } },
      },
      ...errorResponseRefs,
    },
  }),
};

export default aiRoutes;
