import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';
import { PrismaService } from '../../../core/prisma/prisma.service';

import { CreateAddressDto } from '../dto/create-address.dto';
import { QueryAddressDto } from '../dto/query-address.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';

import { AddressEventPublisher } from '../events/address.event.publisher';

type PrismaTx = Prisma.TransactionClient;

type AddressForResponse = {
  id: string;
  userId: string;
  title: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  state: string | null;
  city: string;
  postalCode: string | null;
  street: string;
  apartment: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

@Injectable()
export class AddressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: AddressEventPublisher,
  ) {}

  private readonly addressSelect = {
    id: true,
    userId: true,
    title: true,
    firstName: true,
    lastName: true,
    phone: true,
    country: true,
    state: true,
    city: true,
    postalCode: true,
    street: true,
    apartment: true,
    isDefault: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
  } satisfies Prisma.AddressSelect;

  async create(userId: string, dto: CreateAddressDto): Promise<unknown> {
    const created = await this.prisma.$transaction(async (tx) => {
      const activeCount = await tx.address.count({
        where: {
          userId,
          deletedAt: null,
        },
      });

      const shouldBeDefault = dto.isDefault === true || activeCount === 0;

      let previousDefaultAddressId: string | null = null;

      if (shouldBeDefault) {
        previousDefaultAddressId = await this.getCurrentDefaultAddressId(
          tx,
          userId,
        );

        await this.clearDefaultAddresses(tx, userId);
      }

      const address = await tx.address.create({
        data: {
          userId,
          title: dto.title ?? null,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          country: dto.country,
          state: dto.state ?? null,
          city: dto.city,
          postalCode: dto.postalCode ?? null,
          street: dto.street,
          apartment: dto.apartment ?? null,
          isDefault: shouldBeDefault,
        },
        select: this.addressSelect,
      });

      return {
        address,
        previousDefaultAddressId,
        defaultChanged: shouldBeDefault,
      };
    });

    this.eventPublisher.publishCreated({
      addressId: created.address.id,
      userId: created.address.userId,
      isDefault: created.address.isDefault,
      occurredAt: new Date(),
    });

    if (created.defaultChanged) {
      this.eventPublisher.publishDefaultChanged({
        addressId: created.address.id,
        userId: created.address.userId,
        previousDefaultAddressId: created.previousDefaultAddressId,
        occurredAt: new Date(),
      });
    }

    return this.mapAddress(created.address);
  }

  async findAllByUser(
    userId: string,
    query: QueryAddressDto,
  ): Promise<unknown> {
    const page = Math.max(1, Number(query.page ?? 1));

    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));

    const skip = (page - 1) * limit;

    const where: Prisma.AddressWhereInput = {
      userId,
      deletedAt: null,
      ...(query.country && {
        country: {
          contains: query.country,
          mode: 'insensitive',
        },
      }),
      ...(query.city && {
        city: {
          contains: query.city,
          mode: 'insensitive',
        },
      }),
      ...(query.isDefault !== undefined && {
        isDefault: query.isDefault,
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.address.findMany({
        where,
        select: this.addressSelect,
        orderBy: [
          {
            isDefault: 'desc',
          },
          {
            createdAt: 'desc',
          },
        ],
        skip,
        take: limit,
      }),

      this.prisma.address.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data.map((address) => this.mapAddress(address)),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  async findOneByUser(userId: string, addressId: string): Promise<unknown> {
    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
        deletedAt: null,
      },
      select: this.addressSelect,
    });

    if (!address) {
      throw new NotFoundException('آدرس موردنظر یافت نشد.');
    }

    return this.mapAddress(address);
  }

  async findDefaultByUser(userId: string): Promise<unknown> {
    const address = await this.prisma.address.findFirst({
      where: {
        userId,
        isDefault: true,
        deletedAt: null,
      },
      select: this.addressSelect,
    });

    if (!address) {
      throw new NotFoundException('آدرس پیش‌فرض یافت نشد.');
    }

    return this.mapAddress(address);
  }

  async update(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<unknown> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی آدرس ارسال نشده است.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({
        where: {
          id: addressId,
          userId,
          deletedAt: null,
        },
        select: {
          id: true,
          userId: true,
          isDefault: true,
        },
      });

      if (!existing) {
        throw new NotFoundException('آدرس موردنظر یافت نشد.');
      }

      let previousDefaultAddressId: string | null = null;

      if (dto.isDefault === true) {
        previousDefaultAddressId = await this.getCurrentDefaultAddressId(
          tx,
          userId,
        );

        await this.clearDefaultAddresses(tx, userId, addressId);
      }

      if (dto.isDefault === false && existing.isDefault) {
        const activeAddressCount = await tx.address.count({
          where: {
            userId,
            deletedAt: null,
          },
        });

        if (activeAddressCount <= 1) {
          throw new BadRequestException(
            'حداقل یک آدرس فعال باید به‌عنوان آدرس پیش‌فرض باقی بماند.',
          );
        }
      }

      const updated = await tx.address.update({
        where: {
          id: addressId,
        },
        data: {
          ...(dto.title !== undefined && {
            title: dto.title ?? null,
          }),
          ...(dto.firstName !== undefined && {
            firstName: dto.firstName,
          }),
          ...(dto.lastName !== undefined && {
            lastName: dto.lastName,
          }),
          ...(dto.phone !== undefined && {
            phone: dto.phone,
          }),
          ...(dto.country !== undefined && {
            country: dto.country,
          }),
          ...(dto.state !== undefined && {
            state: dto.state ?? null,
          }),
          ...(dto.city !== undefined && {
            city: dto.city,
          }),
          ...(dto.postalCode !== undefined && {
            postalCode: dto.postalCode ?? null,
          }),
          ...(dto.street !== undefined && {
            street: dto.street,
          }),
          ...(dto.apartment !== undefined && {
            apartment: dto.apartment ?? null,
          }),
          ...(dto.isDefault !== undefined && {
            isDefault: dto.isDefault,
          }),
        },
        select: this.addressSelect,
      });

      return {
        updated,
        previousDefaultAddressId,
        defaultChanged:
          dto.isDefault === true && previousDefaultAddressId !== addressId,
      };
    });

    this.eventPublisher.publishUpdated({
      addressId: result.updated.id,
      userId: result.updated.userId,
      changedFields: Object.keys(dto),
      isDefault: result.updated.isDefault,
      occurredAt: new Date(),
    });

    if (result.defaultChanged) {
      this.eventPublisher.publishDefaultChanged({
        addressId: result.updated.id,
        userId: result.updated.userId,
        previousDefaultAddressId: result.previousDefaultAddressId,
        occurredAt: new Date(),
      });
    }

    return this.mapAddress(result.updated);
  }

  async setDefault(userId: string, addressId: string): Promise<unknown> {
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({
        where: {
          id: addressId,
          userId,
          deletedAt: null,
        },
        select: {
          id: true,
          userId: true,
          isDefault: true,
        },
      });

      if (!existing) {
        throw new NotFoundException('آدرس موردنظر یافت نشد.');
      }

      if (existing.isDefault) {
        const address = await tx.address.findUnique({
          where: {
            id: addressId,
          },
          select: this.addressSelect,
        });

        return {
          address,
          previousDefaultAddressId: addressId,
          changed: false,
        };
      }

      const previousDefaultAddressId = await this.getCurrentDefaultAddressId(
        tx,
        userId,
      );

      await this.clearDefaultAddresses(tx, userId, addressId);

      const address = await tx.address.update({
        where: {
          id: addressId,
        },
        data: {
          isDefault: true,
        },
        select: this.addressSelect,
      });

      return {
        address,
        previousDefaultAddressId,
        changed: true,
      };
    });

    if (!result.address) {
      throw new NotFoundException('آدرس موردنظر یافت نشد.');
    }

    if (result.changed) {
      this.eventPublisher.publishDefaultChanged({
        addressId: result.address.id,
        userId: result.address.userId,
        previousDefaultAddressId: result.previousDefaultAddressId,
        occurredAt: new Date(),
      });
    }

    return this.mapAddress(result.address);
  }

  async remove(userId: string, addressId: string): Promise<unknown> {
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({
        where: {
          id: addressId,
          userId,
          deletedAt: null,
        },
        select: {
          id: true,
          userId: true,
          isDefault: true,
        },
      });

      if (!existing) {
        throw new NotFoundException('آدرس موردنظر یافت نشد.');
      }

      const deletedAt = new Date();

      await tx.address.update({
        where: {
          id: addressId,
        },
        data: {
          deletedAt,
          isDefault: false,
        },
      });

      let promotedDefaultAddressId: string | null = null;

      if (existing.isDefault) {
        const fallback = await tx.address.findFirst({
          where: {
            userId,
            deletedAt: null,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
          },
        });

        if (fallback) {
          await tx.address.update({
            where: {
              id: fallback.id,
            },
            data: {
              isDefault: true,
            },
          });

          promotedDefaultAddressId = fallback.id;
        }
      }

      return {
        existing,
        promotedDefaultAddressId,
        deletedAt,
      };
    });

    this.eventPublisher.publishDeleted({
      addressId: result.existing.id,
      userId: result.existing.userId,
      wasDefault: result.existing.isDefault,
      occurredAt: result.deletedAt,
    });

    if (result.promotedDefaultAddressId) {
      this.eventPublisher.publishDefaultChanged({
        addressId: result.promotedDefaultAddressId,
        userId: result.existing.userId,
        previousDefaultAddressId: result.existing.id,
        occurredAt: result.deletedAt,
      });
    }

    return {
      success: true,
      message: 'آدرس با موفقیت حذف شد.',
      deletedAt: result.deletedAt,
      deletedAtFa: this.formatDate(result.deletedAt),
    };
  }

  private async getCurrentDefaultAddressId(
    tx: PrismaTx,
    userId: string,
  ): Promise<string | null> {
    const current = await tx.address.findFirst({
      where: {
        userId,
        isDefault: true,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    return current?.id ?? null;
  }

  private async clearDefaultAddresses(
    tx: PrismaTx,
    userId: string,
    excludeAddressId?: string,
  ): Promise<void> {
    await tx.address.updateMany({
      where: {
        userId,
        deletedAt: null,
        isDefault: true,
        ...(excludeAddressId && {
          id: {
            not: excludeAddressId,
          },
        }),
      },
      data: {
        isDefault: false,
      },
    });
  }

  private mapAddress(address: AddressForResponse) {
    return {
      id: address.id,
      userId: address.userId,
      title: address.title,
      firstName: address.firstName,
      lastName: address.lastName,
      fullName: `${address.firstName} ${address.lastName}`.trim(),
      phone: address.phone,
      country: address.country,
      state: address.state,
      city: address.city,
      postalCode: address.postalCode,
      street: address.street,
      apartment: address.apartment,
      isDefault: address.isDefault,
      createdAt: address.createdAt,
      createdAtFa: this.formatDate(address.createdAt),
      updatedAt: address.updatedAt,
      updatedAtFa: this.formatDate(address.updatedAt),
      deletedAt: address.deletedAt,
      deletedAtFa: this.formatDate(address.deletedAt),
    };
  }

  private formatDate(value: Date | null): string | null {
    return formatPersianDateTime(value);
  }
}
