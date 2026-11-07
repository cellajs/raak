import type { AppAlert } from '~/modules/common/alerter/alerter';
import { DemoBar } from '~/modules/demo/demo-bar';

const alerts: AppAlert[] = [{ id: 'demo', modes: ['app'], component: DemoBar }];

/** Defines the application alerts and their display conditions. */
export const alertsConfig = alerts;
