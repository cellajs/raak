import { TimeSpan } from '#/utils/time-span';

/** How long a demo board lasts: a colleague's link still works the next day, and the rows are gone soon after. */
export const sandboxLifetime = new TimeSpan(2, 'd');

/** People in one sandbox: the visitor who took it and the colleagues who joined through its link. */
export const sandboxPeopleCap = 5;

/** Claims a day across every visitor; past it the about page keeps its picture. */
export const dailySandboxClaims = 500;

/** The reserved domain of a sandbox account's placeholder address, which no mail reaches. */
export const sandboxAddressDomain = 'sandbox.invalid';
