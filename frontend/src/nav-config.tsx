import { Home, Menu, Search, User } from 'lucide-react';

import { SheetAccount } from '~/modules/common/nav-sheet/sheet-account';
import { SheetMenu } from '~/modules/common/nav-sheet/sheet-menu';

import CreateOrganizationForm from '~/modules/organizations/create-organization-form';
import CreateWorkspaceForm from '~/modules/workspaces/create-workspace-form';

import { config } from 'config';
import type { FooterLinkProps } from '~/modules/common/app-footer';
import type { NavItem } from '~/modules/common/app-nav';
import type { SuggestionSection } from '~/modules/common/app-search';
import type { SectionItem } from '~/modules/common/nav-sheet/sheet-menu';

// Here you declare main navigation items
export const navItems: NavItem[] = [
  { id: 'menu', sheet: <SheetMenu />, icon: Menu },
  { id: 'home', icon: Home, href: '/' },
  { id: 'search', icon: Search },
  { id: 'account', sheet: <SheetAccount />, icon: User, mirrorOnMobile: true },
];

// Here you declare the menu sections
export const menuSections: SectionItem[] = [
  {
    storageType: 'organizations',
    type: 'organization',
    isSubmenu: false,
    createForm: <CreateOrganizationForm dialog />,
    label: 'common:organizations',
  },
  {
    storageType: 'workspaces',
    type: 'workspace',
    isSubmenu: false,
    createForm: <CreateWorkspaceForm dialog />,
    label: 'app:workspaces',
  },
  {
    storageType: 'workspaces',
    type: 'project',
    label: 'app:projects',
    isSubmenu: true,
  },
];

// Here you set default footer links
export const defaultFooterLinks: FooterLinkProps[] = [
  { id: 'about', href: '/about' },
  { id: 'docs', href: `${config.backendUrl}/docs` },
  { id: 'legal', href: '/legal' },
];

// Set search suggestion sections
export const suggestionSections: SuggestionSection[] = [
  { id: 'users', label: 'common:users', type: 'user' },
  { id: 'organizations', label: 'common:organizations', type: 'organization' },
  { id: 'workspaces', label: 'app:workspaces', type: 'workspace' },
  { id: 'projects', label: 'app:projects', type: 'project' },
];

// Set entities paths
export const baseEntityRoutes = {
  user: '/user/$idOrSlug',
  organization: '/$idOrSlug',
  workspace: '/workspaces/$idOrSlug',
  project: '/workspaces/$idOrSlug/board',
} as const;