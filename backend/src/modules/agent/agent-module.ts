import { registerTag } from '#/core/tag-registry';

registerTag({
  tag: 'agent',
  kind: 'module',
  parent: 'app',
  description: `Endpoints for managing AI agent chat sessions and messages, which are scoped to a workspace
    (organization). Chat and message CRUD runs on the main API with sync support, while the streamed assistant
    responses are handled separately by the AI worker. Built on top of the Cella AI capability layer.`,
});
