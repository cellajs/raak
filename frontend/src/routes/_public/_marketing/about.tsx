import { createFileRoute } from '@tanstack/react-router';
import i18n from 'i18next';
import { demoShareSearchSchema } from '~/modules/demo/search-params-schemas';
import { AboutPage } from '~/modules/marketing/about/about-page';
import { pageHead } from '~/utils/app-title';

export const Route = createFileRoute('/_public/_marketing/about')({
  staticData: { isAuth: false },
  validateSearch: demoShareSearchSchema,
  head: () => pageHead(i18n.t('c:about')),
  component: AboutPage,
});
