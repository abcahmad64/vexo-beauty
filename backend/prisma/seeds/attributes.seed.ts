import { PrismaClient } from '../../src/generated/prisma';

const attributes = [
  {
    name: 'نوع پوست',
    values: ['خشک', 'چرب', 'مختلط', 'حساس', 'نرمال'],
  },
  {
    name: 'نوع مو',
    values: ['خشک', 'چرب', 'رنگ‌شده', 'آسیب‌دیده', 'معمولی'],
  },
  {
    name: 'حجم',
    values: ['۳۰ میل', '۵۰ میل', '۱۰۰ میل', '۲۰۰ میل'],
  },
  {
    name: 'رنگ',
    values: ['روشن', 'متوسط', 'تیره', 'بی‌رنگ'],
  },
];

export async function seedAttributes(prisma: PrismaClient): Promise<void> {
  for (const item of attributes) {
    const attribute = await prisma.attribute.upsert({
      where: {
        name: item.name,
      },
      update: {
        deletedAt: null,
      },
      create: {
        name: item.name,
      },
    });

    for (const value of item.values) {
      await prisma.attributeValue.upsert({
        where: {
          attributeId_value: {
            attributeId: attribute.id,
            value,
          },
        },
        update: {
          deletedAt: null,
        },
        create: {
          attributeId: attribute.id,
          value,
        },
      });
    }
  }
}
