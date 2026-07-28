'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { AdminSidebar } from '@/components/admin/admin-sidebar';

type AdminShellProps = {
  children: ReactNode;
};

export function AdminShell({
  children,
}: AdminShellProps) {
  const pathname = usePathname();

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="admin-shell">
      <AdminSidebar />

      <div className="admin-shell__content">
        {children}
      </div>
    </div>
  );
}
