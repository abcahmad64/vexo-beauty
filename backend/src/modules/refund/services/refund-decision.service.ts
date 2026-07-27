import { Injectable } from '@nestjs/common';

import { RefundStatus } from '../../../generated/prisma';

import { ApproveRefundDto } from '../dto/approve-refund.dto';

import { RejectRefundDto } from '../dto/reject-refund.dto';

import { RefundService } from './refund.service';

type RefundDecisionOptions = {
  actorId?: string;
};

@Injectable()
export class RefundDecisionService {
  constructor(private readonly refundService: RefundService) {}

  approveRefund(
    refundId: string,
    dto: ApproveRefundDto,
    options: RefundDecisionOptions = {},
  ) {
    if (dto.completeImmediately === true) {
      return this.refundService.processRefund(
        refundId,
        {
          status: RefundStatus.COMPLETED,
          reason: dto.reason ?? 'درخواست بازگشت وجه تأیید و تکمیل شد.',
          processedAt: new Date().toISOString(),
          notifyCustomer: dto.notifyCustomer,
        },
        options,
      );
    }

    return this.refundService.processRefund(
      refundId,
      {
        status: RefundStatus.PROCESSING,
        reason:
          dto.reason ?? 'درخواست بازگشت وجه تأیید شد و در حال پردازش است.',
        notifyCustomer: dto.notifyCustomer,
      },
      options,
    );
  }

  rejectRefund(
    refundId: string,
    dto: RejectRefundDto,
    options: RefundDecisionOptions = {},
  ) {
    return this.refundService.processRefund(
      refundId,
      {
        status: RefundStatus.FAILED,
        reason: dto.reason,
        processedAt: new Date().toISOString(),
        notifyCustomer: dto.notifyCustomer,
      },
      options,
    );
  }
}
