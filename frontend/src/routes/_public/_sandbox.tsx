import { createFileRoute } from '@tanstack/react-router';
import { AuthLayout } from '~/modules/auth/auth-layout';

/** A sandbox's share link opens in the sign-in pages' framing, at a short address of its own. */
export const Route = createFileRoute('/_public/_sandbox')({ staticData: { isAuth: false }, component: AuthLayout });
