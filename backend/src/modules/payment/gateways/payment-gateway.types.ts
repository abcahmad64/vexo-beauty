export type PaymentGatewayProvider = 'zarinpal';

export type PaymentGatewayRequestInput = {
  readonly paymentId: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly amount: string;
  readonly currency: string;
  readonly description: string;
  readonly callbackUrl: string;
  readonly customer: {
    readonly email: string | null;
    readonly phone: string | null;
  };
  readonly metadata?: Record<string, unknown>;
};

export type PaymentGatewayRequestResult = {
  readonly provider: PaymentGatewayProvider;
  readonly authority: string;
  readonly paymentUrl: string;
  readonly rawResponse: Record<string, unknown>;
};

export type PaymentGatewayVerifyInput = {
  readonly authority: string;
  readonly amount: string;
  readonly currency: string;
};

export type PaymentGatewayVerifyResult = {
  readonly provider: PaymentGatewayProvider;
  readonly verified: boolean;
  readonly code: number;
  readonly message: string;
  readonly refId: string | null;
  readonly cardPan: string | null;
  readonly cardHash: string | null;
  readonly fee: number | null;
  readonly rawResponse: Record<string, unknown>;
};
