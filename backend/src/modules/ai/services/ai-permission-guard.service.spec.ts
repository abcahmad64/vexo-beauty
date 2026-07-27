import { ForbiddenException } from '@nestjs/common';

import { AiPermissionGuardService } from './ai-permission-guard.service';

describe('AiPermissionGuardService', () => {
  let service: AiPermissionGuardService;

  beforeEach(() => {
    service = new AiPermissionGuardService();
  });

  it('rejects unauthenticated permission contexts', () => {
    expect(() => service.assertAuthenticated({})).toThrow(
      new ForbiddenException(
        'برای انجام عملیات هوشمند مدیریتی باید وارد حساب کاربری شوید.',
      ),
    );
  });

  it('accepts an authenticated permission context', () => {
    expect(() =>
      service.assertAuthenticated({
        userId: 'user-1',
      }),
    ).not.toThrow();
  });

  it('recognizes normalized administrative roles', () => {
    expect(
      service.hasAdminRole({
        roleName: ' SUPER_ADMIN ',
      }),
    ).toBe(true);

    expect(
      service.hasAdminRole({
        role: {
          name: 'Owner',
        },
      }),
    ).toBe(true);

    expect(
      service.hasAdminRole({
        role: 'ADMIN',
      }),
    ).toBe(true);

    expect(
      service.hasAdminRole({
        roleName: 'customer',
      }),
    ).toBe(false);
  });

  it('allows administrative roles without explicit permissions', () => {
    expect(() =>
      service.assertAllowed(
        {
          roleName: 'admin',
          permissions: [],
        },
        ['catalog:delete'],
        'حذف محصول',
      ),
    ).not.toThrow();
  });

  it('allows operations that require no permissions', () => {
    expect(() => service.assertAllowed({}, [], 'مشاهده عمومی')).not.toThrow();
  });

  it('allows exact permissions after normalization', () => {
    expect(() =>
      service.assertAllowed(
        {
          permissions: [' AI:APPROVE '],
        },
        ['ai:approve'],
        'تأیید عملیات',
      ),
    ).not.toThrow();
  });

  it('allows scoped and global wildcard permissions', () => {
    expect(() =>
      service.assertAllowed(
        {
          permissions: ['catalog:*'],
        },
        ['catalog:read'],
      ),
    ).not.toThrow();

    expect(() =>
      service.assertAllowed(
        {
          permissions: ['ai:*'],
        },
        ['discount:manage'],
      ),
    ).not.toThrow();

    expect(() =>
      service.assertAllowed(
        {
          permissions: ['admin:*'],
        },
        ['users:delete'],
      ),
    ).not.toThrow();
  });

  it('rejects contexts without a required permission', () => {
    expect(() =>
      service.assertAllowed(
        {
          permissions: ['catalog:read'],
        },
        ['catalog:delete'],
        'حذف محصول',
      ),
    ).toThrow(new ForbiddenException('شما مجوز انجام حذف محصول را ندارید.'));
  });

  it('requires authentication before approving sensitive operations', () => {
    expect(() =>
      service.assertApprovalAllowed(
        {
          permissions: ['ai:approve'],
        },
        'تأیید تخفیف',
      ),
    ).toThrow(
      new ForbiddenException(
        'برای انجام عملیات هوشمند مدیریتی باید وارد حساب کاربری شوید.',
      ),
    );
  });

  it('allows authenticated users with an approval permission', () => {
    expect(() =>
      service.assertApprovalAllowed(
        {
          userId: 'admin-1',
          permissions: [' AI:APPROVE '],
        },
        'تأیید تخفیف',
      ),
    ).not.toThrow();
  });

  it('normalizes and deduplicates permission collections', () => {
    const permissions = service.normalizePermissions([
      ' AI:APPROVE ',
      null,
      undefined,
      'ai:approve',
      'Catalog:Read',
      '',
    ]);

    expect([...permissions]).toEqual(['ai:approve', 'catalog:read']);
  });
});
