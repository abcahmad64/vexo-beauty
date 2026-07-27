import { ConflictException } from '@nestjs/common';

import type { PrismaService } from '../../../core/prisma/prisma.service';

import { AI_BUDGET_POLICY_RULE_TYPE } from '../interfaces/ai-budget-enforcement.interface';

import { AiBudgetPolicyService } from './ai-budget-policy.service';
import { AiBudgetPolicyUtil } from './ai-budget-policy.util';

function createPolicyRow(input: {
  readonly id: string;
  readonly name: string;
  readonly scope: 'GLOBAL' | 'USER';
  readonly scopeValue?: string | null;
  readonly policyVersion?: number;
  readonly isActive?: boolean;
  readonly deletedAt?: Date | null;
}) {
  const document = AiBudgetPolicyUtil.createDocument({
    policyVersion: input.policyVersion ?? 1,
    scope: input.scope,
    scopeValue: input.scopeValue,
    window: 'DAILY',
    softLimitMicros: '500',
    hardLimitMicros: '1000',
    unknownPricingMode: 'BLOCK',
    updatedById: 'admin-1',
  });

  return {
    id: input.id,
    name: input.name,
    pattern: AiBudgetPolicyUtil.serializeDocument(document),
    isActive: input.isActive ?? true,
    priority: 100,
    createdById: 'admin-1',
    createdAt: new Date('2026-07-23T00:00:00.000Z'),
    updatedAt: new Date('2026-07-23T00:00:00.000Z'),
    deletedAt: input.deletedAt ?? null,
  };
}

describe('AiBudgetPolicyService', () => {
  it('stores a versioned policy in AiGuardrailRule without a schema change', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    type CreatePolicyInput = {
      data: {
        name: string;
        pattern: string;
        isActive: boolean;
        priority: number;
        createdById: string;
        ruleType: string;
        action: string;
      };
    };
    const create = jest.fn<
      Promise<ReturnType<typeof createPolicyRow>>,
      [CreatePolicyInput]
    >(({ data }) =>
      Promise.resolve({
        id: 'policy-1',
        name: data.name,
        pattern: data.pattern,
        isActive: data.isActive,
        priority: data.priority,
        createdById: data.createdById,
        createdAt: new Date('2026-07-23T00:00:00.000Z'),
        updatedAt: new Date('2026-07-23T00:00:00.000Z'),
        deletedAt: null,
      }),
    );
    const prisma = {
      aiGuardrailRule: {
        findMany,
        create,
      },
    } as unknown as PrismaService;
    const service = new AiBudgetPolicyService(prisma);

    const result = await service.createPolicy(
      {
        name: 'Global daily provider budget',
        scope: 'GLOBAL',
        window: 'DAILY',
        softLimitMicros: '500',
        hardLimitMicros: '1000',
        unknownPricingMode: 'BLOCK',
      },
      'admin-1',
    );

    expect(result.policyVersion).toBe(1);
    expect(result.scopeValue).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
    const [createInput] = create.mock.calls[0];
    expect(createInput.data.ruleType).toBe(AI_BUDGET_POLICY_RULE_TYPE);
    expect(createInput.data.action).toBe('BUDGET');
    expect(createInput.data.createdById).toBe('admin-1');
  });

  it('rejects a duplicate scope and window policy', async () => {
    const findMany = jest.fn().mockResolvedValue([
      createPolicyRow({
        id: 'policy-existing',
        name: 'Existing user budget',
        scope: 'USER',
        scopeValue: 'user-1',
      }),
    ]);
    const create = jest.fn();
    const prisma = {
      aiGuardrailRule: {
        findMany,
        create,
      },
    } as unknown as PrismaService;
    const service = new AiBudgetPolicyService(prisma);

    await expect(
      service.createPolicy(
        {
          name: 'Duplicate user budget',
          scope: 'USER',
          scopeValue: 'USER-1',
          window: 'DAILY',
          softLimitMicros: '500',
          hardLimitMicros: '1000',
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(create).not.toHaveBeenCalled();
  });

  it('increments the document version on update', async () => {
    const existing = createPolicyRow({
      id: 'policy-1',
      name: 'Existing budget',
      scope: 'GLOBAL',
      policyVersion: 3,
    });
    const findFirst = jest.fn().mockResolvedValue(existing);
    const findMany = jest.fn().mockResolvedValue([]);
    const update = jest.fn().mockImplementation(
      ({
        data,
      }: {
        data: {
          name: string;
          pattern: string;
          isActive: boolean;
          priority: number;
        };
      }) =>
        Promise.resolve({
          ...existing,
          name: data.name,
          pattern: data.pattern,
          isActive: data.isActive,
          priority: data.priority,
          updatedAt: new Date('2026-07-23T01:00:00.000Z'),
        }),
    );
    const prisma = {
      aiGuardrailRule: {
        findFirst,
        findMany,
        update,
      },
    } as unknown as PrismaService;
    const service = new AiBudgetPolicyService(prisma);

    const result = await service.updatePolicy(
      'policy-1',
      {
        hardLimitMicros: '2000',
      },
      'admin-2',
    );

    expect(result.policyVersion).toBe(4);
    expect(result.hardLimitMicros).toBe('2000');
    expect(result.updatedById).toBe('admin-2');
  });
});
