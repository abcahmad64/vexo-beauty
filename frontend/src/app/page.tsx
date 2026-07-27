import type { Metadata } from 'next';

import { HomeScreen } from '@/components/home/home-screen';
import { getStorefrontHomeData } from '@/lib/api/storefront';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { home } = await getStorefrontHomeData();

  if (!home) {
    return {
      title: 'وکسو بیوتی',
      description: 'فروشگاه وکسو بیوتی',
    };
  }

  return {
    title: home.seo.title,
    description: home.seo.description ?? undefined,
    robots: {
      index: !home.seo.robots?.noIndex,
      follow: !home.seo.robots?.noFollow,
    },
  };
}

export default async function HomePage() {
  const data = await getStorefrontHomeData();

  return <HomeScreen {...data} />;
}
