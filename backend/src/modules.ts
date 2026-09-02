/**
 * Backend module composition root: importing this file runs every module's `defineBackendModule`
 * call, so the mutation bus, yjs materializers, and shared module metadata are fully populated.
 * Imported once per entrypoint that can reach those registries (the app in `routes.ts`, the MCP
 * worker, the seed runner), replacing the per-handler side-effect imports so registration no longer
 * depends on which handler loaded first.
 */
import '#/modules/activities/activities-module';
import '#/modules/attachment/attachment-module';
import '#/modules/auth/auth-module';
import '#/modules/domains/domains-module';
import '#/modules/entities/entities-module';
import '#/modules/label/label-module';
import '#/modules/mcp/mcp-module';
import '#/modules/me/me-module';
import '#/modules/memberships/memberships-module';
import '#/modules/metrics/metrics-module';
import '#/modules/organization/organization-module';
import '#/modules/notification/notification-module';
import '#/modules/project/project-module';
import '#/modules/push/push-module';
import '#/modules/requests/requests-module';
import '#/modules/seen/seen-module';
import '#/modules/system/system-module';
import '#/modules/task/task-module';
import '#/modules/tenants/tenants-module';
import '#/modules/user/user-module';
import '#/modules/workspace/workspace-module';
import '#/modules/yjs/yjs-module';
