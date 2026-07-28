import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AdminShell } from '@/components/admin/admin-shell';

export const metadata: Metadata = {
  title: {
    default: 'مدیریت | وکسو بیوتی',
    template: '%s | مدیریت وکسو بیوتی',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
