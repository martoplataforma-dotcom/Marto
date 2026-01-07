import { Body, Controller, Get, Post } from '@nestjs/common';
import { MartoFundService } from './marto-fund.service';
import type { FundEntryType, PointsTxType } from '@prisma/client';

@Controller('fund')
export class MartoFundController {
  constructor(private readonly fund: MartoFundService) {}

  @Get('point-value')
  async pointValue() {
    const value = await this.fund.getPointValue();
    return { pointValue: value };
  }

  @Post('fund-entry')
  async addEntry(
    @Body()
    body: {
      amount: number;
      type: FundEntryType;
      reason?: string;
      refType?: string;
      refId?: string;
    },
  ) {
    await this.fund.addFundEntry(
      body.amount,
      body.type,
      body.reason,
      body.refType,
      body.refId,
    );
    return { ok: true };
  }

  @Post('earn')
  async earn(
    @Body()
    body: {
      userId: string;
      amount: number;
      type: PointsTxType;
      description?: string;
      refType?: string;
      refId?: string;
    },
  ) {
    await this.fund.earnPoints(
      body.userId,
      body.amount,
      body.type,
      body.description,
      body.refType,
      body.refId,
    );
    return { ok: true };
  }

  @Post('spend')
  async spend(
    @Body()
    body: {
      userId: string;
      amount: number;
      description?: string;
      refType?: string;
      refId?: string;
    },
  ) {
    await this.fund.spendPoints(
      body.userId,
      body.amount,
      body.description,
      body.refType,
      body.refId,
    );
    return { ok: true };
  }
}
