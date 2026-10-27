import { OrderStatus } from '@prisma/client';

import type { NormalizedExternalOrderInput } from '../../orders/types/normalized-external-order';
import type { MercadoLivreOrderAdapterInput } from './mercado-livre-order.adapter';

type AdapterPort = {
  normalize(input: MercadoLivreOrderAdapterInput): NormalizedExternalOrderInput;
};

type IngestionPort = {
  ingest(input: NormalizedExternalOrderInput): Promise<unknown>;
};

type MercadoLivreSyncServiceContract = {
  syncOrder(input: MercadoLivreOrderAdapterInput): Promise<unknown>;
};

type MercadoLivreSyncServiceModule = {
  MercadoLivreSyncService: new (
    adapter: AdapterPort,
    ingestion: IngestionPort,
  ) => MercadoLivreSyncServiceContract;
};

function createService(
  adapter: AdapterPort,
  ingestion: IngestionPort,
): MercadoLivreSyncServiceContract {
  const module = jest.requireActual<MercadoLivreSyncServiceModule>(
    './mercado-livre-sync.service',
  );

  return new module.MercadoLivreSyncService(adapter, ingestion);
}

function createRawInput(): MercadoLivreOrderAdapterInput {
  return {
    salesChannelId: 'channel-1',
    order: {
      id: 200000000001,
      status: 'paid',
      date_created: '2026-10-20T12:00:00.000Z',
      last_updated: '2026-10-20T13:00:00.000Z',
      order_items: [
        {
          item: {
            id: 'MLB1234567890',
            title: 'Produto de teste',
          },
          quantity: 1,
          unit_price: 100,
        },
      ],
    },
    shipment: {
      id: 7001,
      status: 'shipped',
    },
  };
}

function createNormalizedInput(): NormalizedExternalOrderInput {
  return {
    salesChannelId: 'channel-1',
    externalOrderId: '200000000001',
    externalStatus: 'paid',
    externalCreatedAt: new Date('2026-10-20T12:00:00.000Z'),
    externalUpdatedAt: new Date('2026-10-20T13:00:00.000Z'),
    canonicalStatus: OrderStatus.IN_TRANSIT,
    items: [
      {
        externalItemId: 'MLB1234567890',
        title: 'Produto de teste',
        quantity: 1,
        unitPrice: '100',
      },
    ],
  };
}

describe('MercadoLivreSyncService', () => {
  it('forwards the exact raw order input to the Mercado Livre adapter', async () => {
    const rawInput = createRawInput();
    const normalized = createNormalizedInput();

    const adapter = {
      normalize: jest.fn().mockReturnValue(normalized),
    };

    const ingestion = {
      ingest: jest.fn().mockResolvedValue({
        action: 'create',
      }),
    };

    const service = createService(adapter, ingestion);

    await service.syncOrder(rawInput);

    expect(adapter.normalize).toHaveBeenCalledTimes(1);
    expect(adapter.normalize).toHaveBeenCalledWith(rawInput);
  });

  it('preserves absence of shipment when the caller did not provide one', async () => {
    const rawInput: MercadoLivreOrderAdapterInput = {
      salesChannelId: 'channel-1',
      order: createRawInput().order,
    };

    const normalized = createNormalizedInput();

    const adapter = {
      normalize: jest.fn().mockReturnValue(normalized),
    };

    const ingestion = {
      ingest: jest.fn().mockResolvedValue({
        action: 'create',
      }),
    };

    const service = createService(adapter, ingestion);

    await service.syncOrder(rawInput);

    expect(adapter.normalize).toHaveBeenCalledWith(rawInput);

    expect(Object.prototype.hasOwnProperty.call(rawInput, 'shipment')).toBe(
      false,
    );
  });

  it('passes exactly the normalized adapter result to external order ingestion', async () => {
    const rawInput = createRawInput();
    const normalized = createNormalizedInput();

    const adapter = {
      normalize: jest.fn().mockReturnValue(normalized),
    };

    const ingestion = {
      ingest: jest.fn().mockResolvedValue({
        action: 'create',
      }),
    };

    const service = createService(adapter, ingestion);

    await service.syncOrder(rawInput);

    expect(ingestion.ingest).toHaveBeenCalledTimes(1);
    expect(ingestion.ingest).toHaveBeenCalledWith(normalized);
  });

  it('returns the ingestion result unchanged', async () => {
    const rawInput = createRawInput();
    const normalized = createNormalizedInput();

    const ingestionResult = {
      action: 'create',
      externalOrderId: '200000000001',
      itemReconciliation: {
        mode: 'initial_creation',
      },
    };

    const adapter = {
      normalize: jest.fn().mockReturnValue(normalized),
    };

    const ingestion = {
      ingest: jest.fn().mockResolvedValue(ingestionResult),
    };

    const service = createService(adapter, ingestion);

    const result = await service.syncOrder(rawInput);

    expect(result).toBe(ingestionResult);
  });

  it('does not call ingestion when normalization fails', async () => {
    const rawInput = createRawInput();

    const normalizationError = new Error('normalization failed');

    const adapter = {
      normalize: jest.fn(() => {
        throw normalizationError;
      }),
    };

    const ingestion = {
      ingest: jest.fn(),
    };

    const service = createService(adapter, ingestion);

    await expect(service.syncOrder(rawInput)).rejects.toBe(normalizationError);

    expect(ingestion.ingest).not.toHaveBeenCalled();
  });

  it('propagates ingestion failure without retrying or swallowing the error', async () => {
    const rawInput = createRawInput();
    const normalized = createNormalizedInput();

    const ingestionError = new Error('ingestion failed');

    const adapter = {
      normalize: jest.fn().mockReturnValue(normalized),
    };

    const ingestion = {
      ingest: jest.fn().mockRejectedValue(ingestionError),
    };

    const service = createService(adapter, ingestion);

    await expect(service.syncOrder(rawInput)).rejects.toBe(ingestionError);

    expect(adapter.normalize).toHaveBeenCalledTimes(1);
    expect(ingestion.ingest).toHaveBeenCalledTimes(1);
  });
});
