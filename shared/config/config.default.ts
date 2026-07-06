import type { ConfigMode, RequiredConfig, S3ConfigInput } from '../src/config-builder/types';

// Re-export for external consumers
export { roles, hierarchy } from './hierarchy-config';

export const config = {

  /******************************************************************************
   * ENTITY DATA MODEL
   ******************************************************************************/

  /** All entity types in the app - must match hierarchy.allTypes. */
  entityTypes: ['user', 'organization', 'workspace', 'project', 'task', 'label', 'attachment'] as const,

  /** Context entities with memberships - must match hierarchy.contextTypes. */
  contextEntityTypes: ['organization', 'workspace', 'project'] as const,

  /** Product/content entities - must match hierarchy.productTypes. */
  productEntityTypes: ['task', 'label', 'attachment'] as const,

  /**
   * Product entity types tracked for seen/unseen counts.
   * Unseen counts are grouped by the parent context entity of each tracked type
   * (e.g., tasks grouped by projectId). Badges appear on that parent context in the menu.
   */
  seenTrackedEntityTypes: ['task'] as const,

  /** Maps entity types to their ID column names - must match entityTypes */
  entityIdColumnKeys: {
    user: 'userId',
    organization: 'organizationId',
    workspace: 'workspaceId',
    project: 'projectId',
    task: 'taskId',
    label: 'labelId',
    attachment: 'attachmentId',
  } as const,

  /** Available CRUD actions for permission checks */
  entityActions: ['create', 'read', 'update', 'delete'] as const,

  /** Resource types that are not entities but have activities logged */
  resourceTypes: ['request', 'membership', 'inactive_membership', 'tenant'] as const,

  /**
   * Entity embeddings: declares which entities are embedded as ID arrays inside
   * other entities. Each entry maps an embedded entity to the host entity + column
   * that references it via an ID array.
   *
   * Used for: ref-count recalculation, CDC soft-cascade suppression,
   * SSE propagation hints, and client-side cache patching.
   * Forks extend when adding new embedding relationships.
   */
  entityEmbeddings: [
    { embeddedEntity: 'label', hostEntity: 'task', hostColumn: 'labels' },
  ] as const,

  /**
   * User menu structure of context entities with optional nested subentities.
   * If subentityType is set, the table must include `${entity}Id` foreign key.
   */
  menuStructure: [
    { entityType: 'organization', subentityType: null } as const,
    { entityType: 'workspace', subentityType: 'project' } as const,
  ],

  /** Default restrictions for tenants (entity quotas and rate limits) */
  defaultRestrictions: {
    quotas: {
      organization: 5,
      user: 1000,
      attachment: 100,
    },
    rateLimits: {
      apiPointsPerHour: 1000,
    },
  } as const,

  /******************************************************************************
   * SYSTEM ROLES
   ******************************************************************************/

  /**
   * System-wide roles stored in DB.
   * Must include 'admin' for system administration access.
   */
  systemRoles: ['admin'] as const,

  /******************************************************************************
   * APP IDENTITY
   ******************************************************************************/

  /** App display name shown in UI and emails */
  name: 'Raak',
  /** URL-safe identifier used in paths and storage */
  slug: 'raak',
  /** Primary domain for the app */
  domain: 'raak.dev',
  /** App description for SEO and meta tags */
  description: 'A TypeScript template to build collaborative web apps with sync engine. MIT licensed.',
  /** SEO keywords for search engines */
  keywords:
    'starter kit, fullstack, monorepo, typescript, hono, honojs, drizzle, shadcn, react, postgres, pwa, offline, instant§ updates, realtime data, sync engine',

  /******************************************************************************
   * URLS & ENDPOINTS
   ******************************************************************************/

  /** Frontend SPA base URL */
  frontendUrl: 'https://www.raak.dev',
  backendUrl: 'https://api.raak.dev',
  backendAuthUrl: 'https://api.raak.dev/auth',
  yjsUrl: 'https://yjs.raak.dev',
  mcpUrl: 'https://mcp.raak.dev',

  /**
   * Deployable services. Each entry gates a service (and/or its route surface)
   * plus its public endpoint. Services are enabled by default; opt out with
   * `{ enabled: false }`. `publicUrl` is derived from the matching URL fields
   * above in app-config, so set enablement here. Distinct from `has` (in-app UX
   * toggles).
   */
  services: {
    frontend: { enabled: true as boolean, publicUrl: 'https://www.raak.dev' },
    backend: { enabled: true as boolean, publicUrl: 'https://api.raak.dev' },
    cdc: { enabled: true as boolean },
    yjs: { enabled: true as boolean, publicUrl: 'https://yjs.raak.dev' },
    mcp: { enabled: true as boolean, publicUrl: 'https://mcp.raak.dev' },
  },

  // Cost escape hatch: when true the backend (MODE=api) also boots every enabled
  // service in-process — one VM for previews/small forks. Default false keeps the
  // split (one service per process). cdc co-hosting forfeits API blue-green.
  singleVM: false as boolean,


  /** About page URL */
  aboutUrl: '/about',
  /** Status page URL for uptime monitoring */
  statusUrl: '',
  /** Canonical production URL */
  productionUrl: 'https://www.raak.dev',

  /** Default redirect path after login */
  defaultRedirectPath: '/home',
  /** Redirect path for first-time users */
  welcomeRedirectPath: '/welcome',

  /******************************************************************************
   * EMAIL
   ******************************************************************************/

  /** From address for system notifications */
  senderEmail: 'notifications@shareworks.nl',
  /** Email address for user support inquiries */
  supportEmail: 'info@cellajs.com',
  /** Email address for security alerts (sysadmin failures, etc.) */
  securityEmail: 'info@cellajs.com',

  /******************************************************************************
   * MODE & FLAGS
   ******************************************************************************/
  
  /** Runtime mode - overridden per environment file */
  mode: 'development' as ConfigMode,
  /** Enable maintenance mode (blocks all requests) */
  maintenance: false,
  /** Cookie version - increment when changing cookie structure to invalidate old cookies */
  cookieVersion: 'v1',
  /** Persisted client query-cache shape - bump on breaking cached entity changes */
  clientCacheVersion: 'v1',

  /******************************************************************************
   * FEATURE FLAGS
   ******************************************************************************/

  /**
   * Feature toggles for app capabilities.
   * Use to enable/disable major features without code changes.
   */
  has: {
    /** Progressive Web App support for preloading static assets and offline support */
    pwa: true as boolean,
    /** Allow users to sign up. If false, the app is by invitation only */
    selfRegistration: false as boolean,
    /** Suggest a waitlist for unknown emails when sign up is disabled */
    waitlist: true as boolean,
    /** S3 fully configured - if false, files will be stored in local browser (IndexedDB) */
    uploadEnabled: true as boolean,
    /** Customer support chat widget (Gleap) */
    chatSupport: false as boolean,
  },

  /******************************************************************************
   * AUTHENTICATION
   ******************************************************************************/

  /**
   * Enabled authentication strategies.
   * TOTP can only be used as MFA fallback with passkey as primary.
   */
  enabledAuthStrategies: ['passkey', 'oauth', 'totp', 'magic'] as const,

  /** Enabled OAuth providers - currently supports: github, google, microsoft */
  enabledOAuthProviders: ['github'] as const,

  /** Token types used for verification flows */
  tokenTypes: ['email-verification', 'oauth-verification', 'invitation', 'confirm-mfa', 'magic'] as const,

  /** TOTP configuration for MFA */
  totpConfig: {
    intervalInSeconds: 30,
    gracePeriodInSeconds: 60,
    digits: 6,
  },

  /******************************************************************************
   * API CONFIGURATION
   ******************************************************************************/

  /** API version prefix for endpoints */
  apiVersion: 'v1',
  /** API documentation description shown in Scalar */
  apiDescription: `⚠️ ATTENTION: PRERELEASE!  
                  This API is organized into modules based on logical domains (e.g. \`auth\`, \`organizations\`, \`memberships\`).
                  Each module includes a set of endpoints that expose functionality related to a specific resource or cross resource logic.

                  The documentation is generated from source code using \`zod\` schemas, converted into OpenAPI via \`zod-openapi\` and served through the \`hono\` framework.`,

  /******************************************************************************
   * REQUEST LIMITS
   ******************************************************************************/

  /**
   * Default page sizes for list endpoints. Backend enforces max 1000.
   * Must include 'default' key as fallback.
   */
  requestLimits: {
    default: 40,
    users: 100,
    members: 40,
    organizations: 40,
    requests: 40,
    labels: 1000,
    attachments: 40,
    projects: 40,
    pages: 100,
    tasks: 1000,
    // TODO [#17], tasksTable looks lke hack
    tasksTable: 80,
    pendingMemberships: 20,
  },

  /** Max JSON body size in bytes */
  jsonBodyLimit: 1 * 1024 * 1024,
  /** Max file upload size in bytes */
  fileUploadLimit: 20 * 1024 * 1024,
  /** Default body size limit in bytes */
  defaultBodyLimit: 1 * 1024 * 1024,

  /******************************************************************************
   * STORAGE & UPLOADS (S3)
   ******************************************************************************/

  /** S3-compatible storage configuration */
  s3: {
    /** S3 region identifier */
    region: 'nl-ams',
    /** S3 host endpoint */
    host: 's3.nl-ams.scw.cloud',
  } as S3ConfigInput,

  /** Upload template IDs for Transloadit processing pipelines */
  uploadTemplateIds: ['avatar', 'cover', 'attachment'] as const,

  /** Uppy upload widget default restrictions */
  uppy: {
    defaultRestrictions: {
      maxFileSize: 10 * 1024 * 1024,
      maxNumberOfFiles: 1,
      allowedFileTypes: ['.jpg', '.jpeg', '.png'],
      maxTotalFileSize: 100 * 1024 * 1024,
      minFileSize: null,
      minNumberOfFiles: null,
      requiredMetaFields: [],
    },
  },

  /**
   * Local blob storage restrictions (IndexedDB/Dexie).
   * Controls which attachments are cached locally for offline access.
   */
  localBlobStorage: {
    enabled: true, // Enable local blob caching
    maxFileSize: 10 * 1024 * 1024, // 10MB - files larger than this are not cached locally
    maxTotalSize: 100 * 1024 * 1024, // 100MB - total cache size, LRU eviction when exceeded
    allowedContentTypes: [] as string[], // Empty = all types allowed
    excludedContentTypes: ['video/*'] as string[], // Excluded types (takes precedence over allowed)
    downloadConcurrency: 2, // Max concurrent background downloads
    uploadRetryAttempts: 3, // Max retry attempts for failed uploads
    uploadRetryDelays: [60000, 300000, 900000] as const, // Retry delays in ms (1min, 5min, 15min)
  },

  /******************************************************************************
   * THIRD-PARTY SERVICES
   ******************************************************************************/

  /** Gleap token for customer support widget */
  gleapToken: '1ZoAxCRA83h5pj7qtRSvuz7rNNN9iXDd',
  /** Google Maps API key */
  googleMapsKey: 'AIzaSyDMjCpQusdoPWLeD7jxkqAxVgJ8s5xJ3Co',
  /** Matrix homeserver URL for chat integration */
  matrixURL: 'https://matrix-client.matrix.org',
  maplePublicIngestKey: 'maple_pk_LnUSK6-_5j3orVrlZ1Hv6I1pxzDh3SJ5',

  /******************************************************************************
   * THEMING & UI
   ******************************************************************************/

  /** Primary theme color for PWA manifest and browser chrome */
  themeColor: '#26262b',
  /** Theme configuration for UI components */
  theme: {
    navigation: {
      hasSidebarTextLabels: false,
      sidebarWidthExpanded: '16rem',
      sidebarWidthCollapsed: '4rem',
      sheetPanelWidth: '20rem',
    },
    colors: {
    },
    strokeWidth: 1.5,
    screenSizes: {
      xs: '420px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1400px',
    },
  } as const,
  /** Placeholder background colors for avatars without images */
  placeholderColors: [
    'bg-blue-300',
    'bg-lime-300',
    'bg-orange-300',
    'bg-yellow-300',
    'bg-green-300',
    'bg-teal-300',
    'bg-indigo-300',
    'bg-purple-300',
    'bg-pink-300',
    'bg-red-300',
  ],

  /******************************************************************************
   * LOCALIZATION
   ******************************************************************************/

  /** Default language code */
  defaultLanguage: 'en' as const,
  /** Available language codes - first is fallback */
  languages: ['en', 'nl'] as const,
  /** Common reference data */
  c: {
    countries: ['fr', 'de', 'nl', 'ua', 'us', 'gb'],
    timezones: [],
  },

  /******************************************************************************
   * COMPANY DETAILS
   ******************************************************************************/

  /** Company/organization details for footer, legal pages, and contact info */
  company: {
    name: 'CellaJS',
    shortName: 'Cella',
    email: 'info@cellajs.com',
    supportEmail: 'info@cellajs.com',
    tel: '+31 6 12345678',
    streetAddress: 'Drizzle Road 42',
    postcode: '90210 JS',
    city: 'Hono City',
    country: 'TypeScript Rock',
    registration: 'Chamber of Commerce (KvK): 578 25 920',
    bankAccount: 'NL07 RABO 0309 4430 24',
    googleMapsUrl: 'https://goo.gl/maps/SQlrh',
    scheduleCallUrl: 'https://cal.com/flip-van-haaren',
    socialUrl: 'https://bsky.app/profile/flipvh.bsky.social',
    blueskyHandle: '@flipvh.bsky.social',
    element: 'https://matrix.to/#/!fvwljIbZIqzhNvjKvk:matrix.org',
    githubUrl: 'https://github.com/cellajs/cella',
    mapZoom: 4,
    coordinates: {
      lat: 51.92760809717153,
      lng: 4.47421039909924,
    },
  },

  /******************************************************************************
   * USER DEFAULTS
   ******************************************************************************/

  /** Default user flags applied to new users */
  defaultUserFlags: {
    finishedOnboarding: false,
  },
} satisfies RequiredConfig;

export default config;
