import { Module } from '@nestjs/common';
import { MartoFundService } from './marto-fund.service';
import { MartoFundController } from './marto-fund.controller';

@Module({
  controllers: [MartoFundController],
  providers: [MartoFundService],
  exports: [MartoFundService],
})
export class FundModule {}
