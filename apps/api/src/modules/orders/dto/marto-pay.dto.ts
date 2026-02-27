// apps/api/src/modules/orders/dto/marto-pay.dto.ts

export type MartoPayStage =
  | 'created_charge'
  | 'awaiting_confirmation'
  | 'captured'
  | 'already_captured'
  | 'payout_released'
  | 'payout_paid';

export type MartoPayPixChargeView = {
  id: string;
  status: string;
  brCode?: string | null;
  qrCodeUrl?: string | null;
  expiresAt?: Date | string | null;
  paidAt?: Date | string | null;
  settledAt?: Date | string | null;
};

export type MartoPayPaymentView = {
  id: string;
  payerUserId: string;
  contextType: string;
  contextId: string;
  amountCents: number;
  status: string;
  pixChargeId?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export type MartoPayPayoutView = {
  id: string;
  paymentId: string;
  payeeUserId: string;
  contextType: string;
  contextId: string;
  amountCents: number;
  status: string;
  releasedAt?: Date | string | null;
  paidAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export type MartoPayResponse = {
  ok: true;
  idempotent?: boolean;
  stage?: MartoPayStage;
  message?: string;

  // Mantém o "order" como você já retorna hoje (com items etc).
  // Não tipamos duro aqui pra não brigar com seu schema; é contrato pragmático do MVP.
  order: any;

  payment?: MartoPayPaymentView | null;
  payout?: MartoPayPayoutView | null;
  pixCharge?: MartoPayPixChargeView | null;
};
