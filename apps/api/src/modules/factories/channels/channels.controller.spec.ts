import { Test, type TestingModule } from '@nestjs/testing';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

describe('ChannelsController', () => {
  let controller: ChannelsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChannelsController],
      providers: [
        {
          provide: ChannelsService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get(ChannelsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
