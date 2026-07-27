'use client';

import { useState } from 'react';

import type { StorefrontHomeData } from '@/types/storefront';

import { DesktopSidebar } from '../layout/desktop-sidebar';
import { SiteHeader } from '../layout/site-header';
import { SearchDialog } from '../search/search-dialog';
import { CategoryRail } from './category-rail';
import { ExperiencePanels } from './experience-panels';
import { HeroSection } from './hero-section';

type HomeScreenProps = StorefrontHomeData;

export function HomeScreen({
  home,
  navigation,
  assistant,
}: HomeScreenProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  const categories =
    navigation?.sections.categories ?? [];

  const quickActions =
    navigation?.quickActions ??
    home?.sections.quickLinks ??
    [];

  return (
    <div className="vexo-home">
      <DesktopSidebar
        categories={categories}
        quickActions={quickActions}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <main className="vexo-home__main">
        <SiteHeader
          categories={categories}
          onOpenSearch={() => setSearchOpen(true)}
        />

        <HeroSection hero={home?.hero ?? null} />

        <CategoryRail categories={categories} />

        <ExperiencePanels
          sections={home?.sections.productSections ?? []}
          assistant={assistant}
        />
      </main>

      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        categories={categories}
      />
    </div>
  );
}
