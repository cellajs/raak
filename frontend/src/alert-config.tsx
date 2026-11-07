import type { AppAlert } from '~/modules/common/alerter/alerter';
import { SandboxBar } from '~/modules/sandbox/sandbox-bar';

const alerts: AppAlert[] = [{ id: 'sandbox', modes: ['app'], component: SandboxBar }];

/** Defines the application alerts and their display conditions. */
export const alertsConfig = alerts;
