import { Test, type TestingModule } from '@nestjs/testing';
import { PurchaseIntentsService } from './purchase-intents.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('PurchaseIntentsService', () => {
  let service: PurchaseIntentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseIntentsService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get(PurchaseIntentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
