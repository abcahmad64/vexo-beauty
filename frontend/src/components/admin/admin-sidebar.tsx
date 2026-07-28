'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  PackageSearch,
  Percent,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';

import { BrandMark } from '@/components/ui/brand-mark';

const navigation = [
  {
    label: 'داشبورد',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    label: 'سفارش‌ها',
    href: '/admin/orders',
    icon: ClipboardList,
  },
  {
    label: 'محصولات',
    href: '/admin/products',
    icon: PackageSearch,
  },
  {
    label: 'موجودی',
    href: '/admin/inventory',
    icon: Boxes,
  },
  {
    label: 'مشتریان',
    href: '/admin/customers',
    icon: Users,
  },
  {
    label: 'کدهای تخفیف',
    href: '/admin/coupons',
    icon: Percent,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <Link
        href="/admin"
        className="admin-sidebar__brand"
      >
        <BrandMark />
        <span>
          <strong>VEXO</strong>
          <small>Admin Console</small>
        </span>
      </Link>

      <div className="admin-sidebar__scope">
        <ShieldCheck aria-hidden="true" />
        <span>
          <strong>فضای مدیریت</strong>
          <small>دسترسی کنترل‌شده</small>
        </span>
      </div>

      <nav aria-label="ناوبری پنل مدیریت">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? 'admin-nav-item is-active'
                  : 'admin-nav-item'
              }
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="admin-sidebar__footer">
        <Link href="/">
          <Store aria-hidden="true" />
          مشاهده فروشگاه
        </Link>

        <span>
          <BarChart3 aria-hidden="true" />
          داده‌های واقعی Backend
        </span>
      </div>
    </aside>
  );
}
