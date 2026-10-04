import type { DeepPartial } from '../src/config-builder/types.ts';
import type { config as _default } from './config.default.ts';
import { development } from './config.development.ts';

/** Test environment overrides. Must run on localhost; keep minimal and free of any secrets. */
export const test = {
  mode: 'test',
  name: 'Raak TEST',

  domain: '',

  services: { mcp: { enabled: true }, oauth: { enabled: true } },
  // Test fixture only: the template's SSO suites sign in through a `surfconext` federation, and raak declares none.
  federations: {
    surfconext: {
      label: 'SURFconext',
      issuer: 'https://connect.test.surfconext.nl',
      idpMetadataUrl: 'https://metadata.test.surfconext.nl/idps-metadata.xml',
      scopes: ['openid'],
      clientAuthMethod: 'client_secret_basic',
      tenantClaim: 'schac_home_organization',
      snapshotClaims: ['eduperson_affiliation', 'eduperson_scoped_affiliation'],
      addressAuthority: true,
    },
  },

  frontendUrl: development.frontendUrl,
  backendUrl: development.backendUrl,
  backendAuthUrl: development.backendAuthUrl,
  yjsUrl: development.yjsUrl,
  mcpUrl: development.mcpUrl,
  oauthUrl: development.oauthUrl,
} satisfies DeepPartial<typeof _default>;
