import { Test, type TestingModule } from '@nestjs/testing';
import { RelationshipsController } from './relationships.controller';
import { RelationshipsService } from './relationships.service';

describe('RelationshipsController', () => {
  let controller: RelationshipsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RelationshipsController],
      providers: [
        {
          provide: RelationshipsService,
          useValue: {
            countRelationships: jest.fn(),
            openFromIntent: jest.fn(),
            listByChannel: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(RelationshipsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
