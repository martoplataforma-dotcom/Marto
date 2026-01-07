import { Test, type TestingModule } from '@nestjs/testing';
import { PurchaseIntentsController } from './purchase-intents.controller';
import { PurchaseIntentsService } from './purchase-intents.service';

describe('PurchaseIntentsController', () => {
  let controller: PurchaseIntentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseIntentsController],
      providers: [
        {
          provide: PurchaseIntentsService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get(PurchaseIntentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
