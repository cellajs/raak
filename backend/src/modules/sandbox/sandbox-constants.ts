import { createHash } from 'node:crypto';
import { appConfig } from 'shared';
import { sampleContent } from '#/modules/sample/sample-content';
import { TimeSpan } from '#/utils/time-span';

/** Ready sandboxes the pool keeps in production, so a claim does not wait for a build; elsewhere every claim builds one. */
export const sandboxPoolSize = appConfig.mode === 'production' ? 10 : 0;

export const sandboxLifetime = new TimeSpan(7, 'd');

/** A ready sandbox older than this is rebuilt, so the sample's relative dates read fresh at the claim. */
export const readySandboxMaxAge = new TimeSpan(1, 'd');

/** Claims a day across every visitor; past it the about page keeps its scripted board. */
export const dailySandboxClaims = 500;

/** The reserved domain of a sandbox account's placeholder address, which no mail reaches. */
export const sandboxAddressDomain = 'sandbox.invalid';

/** Identifies the dataset a sandbox's sample came from. */
export const sandboxContentVersion = createHash('sha256').update(JSON.stringify(sampleContent)).digest('hex').slice(0, 16);
