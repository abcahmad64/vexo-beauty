import Link from 'next/link';
import {
  ArrowLeft,
  Construction,
} from 'lucide-react';

import { AdminHeader } from '@/components/admin/admin-header';

type AdminModulePlaceholderProps = {
  title: string;
  description: string;
};

export function AdminModulePlaceholder({
  title,
  description,
}: AdminModulePlaceholderProps) {
  return (
    <main className="admin-page">
      <AdminHeader
        title={title}
        subtitle={description}
      />

      <section className="admin-module-placeholder">
        <Construction aria-hidden="true" />
        <h2>ساختار این بخش آماده است</h2>
        <p>
          اتصال داده‌ها و عملیات این ماژول در مرحله بعد
          مطابق Contract واقعی Backend انجام می‌شود.
        </p>
        <Link
          href="/admin"
          className="button button--primary"
        >
          بازگشت به داشبورد
          <ArrowLeft aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
