import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';

@Module({
  imports: [],
  controllers: [ReviewsController],
  providers: [],
  exports: [],
})
export class ReviewsModule {}
