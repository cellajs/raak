import { Building2Icon, FolderIcon, UsersIcon } from 'lucide-react';
import type { GetPublicCountsResponse } from 'sdk';
import { appConfig } from 'shared';
import { nanoid } from 'shared/utils/nanoid';
import type { TKey } from '~/lib/i18n-locales';
import type { IconComponent } from '~/modules/common/icons/types';
import type { InfoCard } from '~/modules/marketing/about/info-cards';
import type { PricingPlan } from '~/modules/marketing/about/pricing';
import type { ShowcaseItem } from '~/modules/marketing/about/showcase';
import type { FooterLinkProps } from '~/modules/marketing/footer';
import type { InfoGridItem } from '~/modules/marketing/info-grid';

// Nav

export const marketingNavConfig: { id: TKey; url: string; hash: string }[] = [
  { id: 'product', url: '/about', hash: 'product' },
  // { id: 'pricing', url: '/about', hash: 'pricing' },
  { id: 'docs', url: '/docs', hash: '' },
];

// Footer

interface FooterSection {
  title: TKey;
  links: FooterLinkProps[];
  hideOnMobile?: boolean;
}

const socials: FooterLinkProps[] = [{ title: 'c:social', href: appConfig.company.socialUrl }];

export const footerSections: FooterSection[] = [
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
    links: [{ title: 'c:api_docs', href: '/docs' }],
  },
  {
    title: 'c:connect',
    links: [{ title: 'c:contact_us', href: '/contact' }, ...socials],
  },
];

// Legal

export const legalLinks: FooterLinkProps[] = [{ title: 'c:legal', href: '/legal' }];

// About - Integrations

export const cards: InfoCard[] = [];

// About - Pricing plan

export const pricingPlans: PricingPlan[] = [
  { id: 'free', action: 'waitlist_request', featureCount: 4, discount: 'Free' },
  { id: 'pro', action: 'contact_us', featureCount: 6, className: 'ring-4 ring-primary/5', popular: true },
];

// About - FAQ

export const faqsData = [
  { id: 'roadmap', link: '/contact' },
  { id: 'linear-comparison' },
  { id: 'pivotal-comparison', link: 'https://news.ycombinator.com/item?id=41591622' },
  { id: 'raak-integration' },
];

// About - Counters

export const counts = [
  { id: 'user', title: 'c:user_other', icon: UsersIcon },
  { id: 'organization', title: 'c:organization_other', icon: Building2Icon },
  { id: 'project', title: 'c:project_other', icon: FolderIcon },
] as const satisfies readonly { id: keyof GetPublicCountsResponse; title: TKey; icon: IconComponent }[];

// About - Why

export const whyItems = [{ id: 'simple' }, { id: 'automation' }, { id: 'instant' }];

export const whyLightSlides = [
  { id: nanoid(), url: '/static/marketing/screenshots/board.webp' },
  { id: nanoid(), url: '/static/marketing/screenshots/table.webp' },
  { id: nanoid(), url: '/static/marketing/screenshots/task.webp' },
];

export const whyDarkSlides = [
  { id: nanoid(), url: '/static/marketing/screenshots/board-dark.webp' },
  { id: nanoid(), url: '/static/marketing/screenshots/table-dark.webp' },
  { id: nanoid(), url: '/static/marketing/screenshots/task-dark.webp' },
];

// Dedicated marketing pages

export const featuresPageItems: InfoGridItem[] = [];
export const featureCategoryIcons = {} as const;

// About - Showcase

export const showcaseItems: ShowcaseItem[] = [];
