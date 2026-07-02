import { Building2Icon, CloudIcon, FolderIcon, StickyNoteIcon, UsersIcon, ZapIcon } from 'lucide-react';
import { appConfig } from 'shared';
import { nanoid } from 'shared/nanoid';
import type { InfoCard } from '~/modules/marketing/about/info-cards';
import type { PricingPlan } from '~/modules/marketing/about/pricing';
import type { ShowcaseItem } from '~/modules/marketing/about/showcase';
import type { InfoGridItem } from '~/modules/marketing/info-grid';

/*************************************************************************************************
 * Nav
 ************************************************************************************************/

export const marketingNavConfig = [
  { id: 'product', url: '/about', hash: 'product' },
  // { id: 'pricing', url: '/about', hash: 'pricing' },
  { id: 'docs', url: '/docs', hash: '' },
];

/*************************************************************************************************
 * Footer
 ************************************************************************************************/

const socials = [{ title: 'Social', href: appConfig.company.socialUrl, icon: CloudIcon }];

export const footerSections = [
  {
    title: 'c:product',
    links: [
      { title: 'c:about', href: '/about' },
      { title: 'c:sign_up', href: '/auth/authenticate' },
    ],
  },
  {
    title: 'c:documentation',
    hideOnMobile: true,
    links: [{ title: 'c:api_docs', href: `${appConfig.backendUrl}/docs` }],
  },
  {
    title: 'c:connect',
    links: [{ title: 'c:contact_us', href: '/contact' }, ...socials],
  },
];

/*************************************************************************************************
 * Legal
 ************************************************************************************************/

export const legalLinks = [{ title: 'c:legal', href: '/legal' }];

/*************************************************************************************************
 * About - Features
 ************************************************************************************************/

export const features: { id: string }[] = [];

/*************************************************************************************************
 * About - Integrations
 ************************************************************************************************/

export const cards: InfoCard[] = [];

/*************************************************************************************************
 * About - Pricing plan
 ************************************************************************************************/

export const pricingPlans: PricingPlan[] = [
  { id: 'free', action: 'waitlist_request', priceId: null, featureCount: 4, borderColor: '', discount: 'Free' },
  {
    id: 'pro',
    action: 'contact_us',
    priceId: null,
    featureCount: 6,
    borderColor: 'ring-4 ring-primary/5',
    popular: true,
  },
];

/*************************************************************************************************
 * About - FAQ
 ************************************************************************************************/

export const faqsData = [
  { id: 'roadmap', link: '/contact' },
  { id: 'linear-comparison' },
  { id: 'pivotal-comparison', link: 'https://news.ycombinator.com/item?id=41591622' },
  { id: 'raak-integration' },
];

/*************************************************************************************************
 * About - Counters
 ************************************************************************************************/

export const counts = [
  { id: 'user', title: 'c:users', icon: UsersIcon },
  { id: 'organization', title: 'c:organizations', icon: Building2Icon },
  { id: 'project', title: 'c:projects', icon: FolderIcon },
  { id: 'task', title: 'c:tasks', icon: StickyNoteIcon },
] as const;

/*************************************************************************************************
 * About - Why
 ************************************************************************************************/

export const whyItems = [{ id: 'simple' }, { id: 'automation' }, { id: 'instant' }];

// Slides for light and dark themes
export const whyLightSlides = [
  { id: nanoid(), url: '/static/marketing/screenshots/board.png' },
  { id: nanoid(), url: '/static/marketing/screenshots/table.png' },
  { id: nanoid(), url: '/static/marketing/screenshots/task.png' },
];

export const whyDarkSlides = [
  { id: nanoid(), url: '/static/marketing/screenshots/board-dark.png' },
  { id: nanoid(), url: '/static/marketing/screenshots/table-dark.png' },
  { id: nanoid(), url: '/static/marketing/screenshots/task-dark.png' },
];

/*************************************************************************************************
 * Dedicated marketing pages
 ************************************************************************************************/

export const featuresPageItems: InfoGridItem[] = [];
export const featureCategoryIcons = {} as const;

export const syncPageItems: InfoGridItem[] = [];
export const syncCategoryIcons = {
  sync: ZapIcon,
} as const;

/*************************************************************************************************
 * About - Showcase
 ************************************************************************************************/

export const showcaseItems: ShowcaseItem[] = [];
