'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  ExternalLink,
  LogOut,
  Menu,
  RefreshCcw,
} from 'lucide-react';
import { useState } from 'react';

type AdminHeaderProps = {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function AdminHeader({
  title,
  subtitle,
  onRefresh,
  refreshing = false,
}: AdminHeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] =
    useState(false);

  async function logout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
      });
    } finally {
      router.replace('/admin/login');
    }
  }

  return (
    <header className="admin-header">
      <div className="admin-header__identity">
        <Menu
          className="admin-header__menu"
          aria-hidden="true"
        />

        <div>
          <span className="panel-label">
            Management Workspace
          </span>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>

      <div className="admin-header__actions">
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="به‌روزرسانی اطلاعات"
          >
            <RefreshCcw
              className={
                refreshing
                  ? 'is-spinning'
                  : ''
              }
              aria-hidden="true"
            />
          </button>
        ) : null}

        <button
          type="button"
          aria-label="اعلان‌های مدیریت"
        >
          <Bell aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          aria-label="خروج از مدیریت"
        >
          <LogOut aria-hidden="true" />
        </button>

        <Link href="/" target="_blank">
          فروشگاه
          <ExternalLink aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
