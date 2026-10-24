import { OrderEventType, OrderStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ExternalOrderIngestionService } from './external-order-ingestion.service';

describe('ExternalOrderIngestionService', () => {
  it('preserves a valid externalCreatedAt when creating an external order', async () => {
    const externalCreatedAt = new Date('2026-09-01T12:00:00.000Z');

    const tx = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
        }),
      },
      order: {
        create: jest.fn().mockResolvedValue({
          id: 'order-1',
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'order-1',
          items: [],
          externalOrderReferences: [],
        }),
      },
      orderItem: {
        create: jest.fn().mockResolvedValue({
          id: 'order-item-1',
        }),
      },
      externalOrderItemReference: {
        create: jest.fn().mockResolvedValue({
          id: 'external-order-item-reference-1',
        }),
      },
    };

    const prisma = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    const service = new ExternalOrderIngestionService(prisma);

    const result = await service.ingest({
      salesChannelId: 'channel-1',
      externalOrderId: 'external-order-1',
      externalCreatedAt,
      canonicalStatus: OrderStatus.PAID,
      items: [
        {
          externalItemId: 'external-item-1',
          title: 'Produto de teste',
          quantity: 1,
          unitPrice: '100.00',
        },
      ],
    });

    expect(result.action).toBe('create');

    expect(tx.externalOrderReference.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalCreatedAt,
        }),
      }),
    );
  });

  it('does not persist an invalid externalCreatedAt when creating an external order', async () => {
    const externalCreatedAt = new Date(Number.NaN);

    const tx = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
        }),
      },
      order: {
        create: jest.fn().mockResolvedValue({
          id: 'order-1',
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'order-1',
          items: [],
          externalOrderReferences: [],
        }),
      },
      orderItem: {
        create: jest.fn().mockResolvedValue({
          id: 'order-item-1',
        }),
      },
      externalOrderItemReference: {
        create: jest.fn().mockResolvedValue({
          id: 'external-order-item-reference-1',
        }),
      },
    };

    const prisma = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    const service = new ExternalOrderIngestionService(prisma);

    const result = await service.ingest({
      salesChannelId: 'channel-1',
      externalOrderId: 'external-order-1',
      externalCreatedAt,
      canonicalStatus: OrderStatus.PAID,
      items: [
        {
          externalItemId: 'external-item-1',
          title: 'Produto de teste',
          quantity: 1,
          unitPrice: '100.00',
        },
      ],
    });

    expect(result.action).toBe('create');

    expect(tx.externalOrderReference.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalCreatedAt: null,
        }),
      }),
    );
  });

  it('fills externalCreatedAt when it is missing and a non-stale update provides a valid date', async () => {
    const externalCreatedAt = new Date('2026-09-01T12:00:00.000Z');
    const previousExternalUpdatedAt = new Date('2026-09-01T11:00:00.000Z');
    const incomingExternalUpdatedAt = new Date('2026-09-01T13:00:00.000Z');

    const existingReference = {
      id: 'external-reference-1',
      orderId: 'order-1',
      externalStatus: 'paid',
      externalCreatedAt: null,
      externalUpdatedAt: previousExternalUpdatedAt,
      lastSyncedAt: new Date('2026-09-01T11:05:00.000Z'),
      metadata: null,
      order: {
        id: 'order-1',
        merchantId: 'merchant-1',
        status: OrderStatus.PAID,
        buyerNameSnapshot: null,
        buyerContactSnapshot: null,
        recipientNameSnapshot: null,
        destinationZipCode: null,
        city: null,
        state: null,
        destinationAddressSnapshot: null,
        items: [],
      },
      externalItems: [],
    };

    const tx = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue(existingReference),
        update: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
          orderId: 'order-1',
          externalUpdatedAt: incomingExternalUpdatedAt,
          lastSyncedAt: new Date(),
        }),
      },
      order: {
        update: jest.fn(),
      },
      orderEvent: {
        create: jest.fn(),
      },
    };

    const prisma = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
          orderId: 'order-1',
          externalUpdatedAt: previousExternalUpdatedAt,
          lastSyncedAt: new Date('2026-09-01T11:05:00.000Z'),
        }),
      },
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    const service = new ExternalOrderIngestionService(prisma);

    const result = await service.ingest({
      salesChannelId: 'channel-1',
      externalOrderId: 'external-order-1',
      externalCreatedAt,
      externalUpdatedAt: incomingExternalUpdatedAt,
    });

    expect(result.action).toBe('update');

    expect(tx.externalOrderReference.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalCreatedAt,
        }),
      }),
    );

    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.orderEvent.create).not.toHaveBeenCalled();
  });

  it('preserves the existing externalCreatedAt when a later update provides a different date', async () => {
    const persistedExternalCreatedAt = new Date(
      '2026-09-01T12:00:00.000Z',
    );
    const incomingExternalCreatedAt = new Date(
      '2026-09-02T12:00:00.000Z',
    );
    const previousExternalUpdatedAt = new Date(
      '2026-09-01T13:00:00.000Z',
    );
    const incomingExternalUpdatedAt = new Date(
      '2026-09-02T13:00:00.000Z',
    );

    const existingReference = {
      id: 'external-reference-1',
      orderId: 'order-1',
      externalStatus: 'paid',
      externalCreatedAt: persistedExternalCreatedAt,
      externalUpdatedAt: previousExternalUpdatedAt,
      lastSyncedAt: new Date('2026-09-01T13:05:00.000Z'),
      metadata: null,
      order: {
        id: 'order-1',
        merchantId: 'merchant-1',
        status: OrderStatus.PAID,
        buyerNameSnapshot: null,
        buyerContactSnapshot: null,
        recipientNameSnapshot: null,
        destinationZipCode: null,
        city: null,
        state: null,
        destinationAddressSnapshot: null,
        items: [],
      },
      externalItems: [],
    };

    const tx = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue(existingReference),
        update: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
          orderId: 'order-1',
          externalUpdatedAt: incomingExternalUpdatedAt,
          lastSyncedAt: new Date(),
        }),
      },
      order: {
        update: jest.fn(),
      },
      orderEvent: {
        create: jest.fn(),
      },
    };

    const prisma = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
          orderId: 'order-1',
          externalUpdatedAt: previousExternalUpdatedAt,
          lastSyncedAt: new Date('2026-09-01T13:05:00.000Z'),
        }),
      },
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    const service = new ExternalOrderIngestionService(prisma);

    const result = await service.ingest({
      salesChannelId: 'channel-1',
      externalOrderId: 'external-order-1',
      externalCreatedAt: incomingExternalCreatedAt,
      externalUpdatedAt: incomingExternalUpdatedAt,
    });

    expect(result.action).toBe('update');

    expect(tx.externalOrderReference.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalCreatedAt: undefined,
        }),
      }),
    );

    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.orderEvent.create).not.toHaveBeenCalled();
  });

  it('does not touch externalCreatedAt on a stale update', async () => {
    const persistedExternalUpdatedAt = new Date(
      '2026-09-02T13:00:00.000Z',
    );
    const incomingExternalUpdatedAt = new Date(
      '2026-09-01T13:00:00.000Z',
    );
    const incomingExternalCreatedAt = new Date(
      '2026-09-01T12:00:00.000Z',
    );

    const existingReference = {
      id: 'external-reference-1',
      orderId: 'order-1',
      externalStatus: 'paid',
      externalCreatedAt: null,
      externalUpdatedAt: persistedExternalUpdatedAt,
      lastSyncedAt: new Date('2026-09-02T13:05:00.000Z'),
      metadata: null,
      order: {
        id: 'order-1',
        merchantId: 'merchant-1',
        status: OrderStatus.PAID,
        buyerNameSnapshot: null,
        buyerContactSnapshot: null,
        recipientNameSnapshot: null,
        destinationZipCode: null,
        city: null,
        state: null,
        destinationAddressSnapshot: null,
        items: [],
      },
      externalItems: [],
    };

    const tx = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue(existingReference),
        update: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
          orderId: 'order-1',
          externalUpdatedAt: persistedExternalUpdatedAt,
          lastSyncedAt: new Date(),
        }),
      },
    };

    const prisma = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
          orderId: 'order-1',
          externalUpdatedAt: persistedExternalUpdatedAt,
          lastSyncedAt: new Date('2026-09-02T13:05:00.000Z'),
        }),
      },
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    const service = new ExternalOrderIngestionService(prisma);

    const result = await service.ingest({
      salesChannelId: 'channel-1',
      externalOrderId: 'external-order-1',
      externalCreatedAt: incomingExternalCreatedAt,
      externalUpdatedAt: incomingExternalUpdatedAt,
    });

    expect(result.action).toBe('ignored_stale');

    expect(tx.externalOrderReference.update).toHaveBeenCalledTimes(1);

    const updateCall = tx.externalOrderReference.update.mock.calls[0][0];

    expect(updateCall.data).toHaveProperty('lastSyncedAt');
    expect(updateCall.data).not.toHaveProperty('externalCreatedAt');
    expect(updateCall.data).not.toHaveProperty('externalUpdatedAt');
  });

  it('preserves a missing externalCreatedAt when a non-stale update omits the field', async () => {
    const previousExternalUpdatedAt = new Date(
      '2026-09-01T11:00:00.000Z',
    );
    const incomingExternalUpdatedAt = new Date(
      '2026-09-01T13:00:00.000Z',
    );

    const existingReference = {
      id: 'external-reference-1',
      orderId: 'order-1',
      externalStatus: 'paid',
      externalCreatedAt: null,
      externalUpdatedAt: previousExternalUpdatedAt,
      lastSyncedAt: new Date('2026-09-01T11:05:00.000Z'),
      metadata: null,
      order: {
        id: 'order-1',
        merchantId: 'merchant-1',
        status: OrderStatus.PAID,
        buyerNameSnapshot: null,
        buyerContactSnapshot: null,
        recipientNameSnapshot: null,
        destinationZipCode: null,
        city: null,
        state: null,
        destinationAddressSnapshot: null,
        items: [],
      },
      externalItems: [],
    };

    const tx = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue(existingReference),
        update: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
          orderId: 'order-1',
          externalUpdatedAt: incomingExternalUpdatedAt,
          lastSyncedAt: new Date(),
        }),
      },
      order: {
        update: jest.fn(),
      },
      orderEvent: {
        create: jest.fn(),
      },
    };

    const prisma = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
          orderId: 'order-1',
          externalUpdatedAt: previousExternalUpdatedAt,
          lastSyncedAt: new Date('2026-09-01T11:05:00.000Z'),
        }),
      },
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    const service = new ExternalOrderIngestionService(prisma);

    const result = await service.ingest({
      salesChannelId: 'channel-1',
      externalOrderId: 'external-order-1',
      externalUpdatedAt: incomingExternalUpdatedAt,
    });

    expect(result.action).toBe('update');

    expect(tx.externalOrderReference.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalCreatedAt: undefined,
        }),
      }),
    );

    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.orderEvent.create).not.toHaveBeenCalled();
  });

  it('preserves a missing externalCreatedAt when a non-stale update provides null', async () => {
    const previousExternalUpdatedAt = new Date(
      '2026-09-01T11:00:00.000Z',
    );
    const incomingExternalUpdatedAt = new Date(
      '2026-09-01T13:00:00.000Z',
    );

    const existingReference = {
      id: 'external-reference-1',
      orderId: 'order-1',
      externalStatus: 'paid',
      externalCreatedAt: null,
      externalUpdatedAt: previousExternalUpdatedAt,
      lastSyncedAt: new Date('2026-09-01T11:05:00.000Z'),
      metadata: null,
      order: {
        id: 'order-1',
        merchantId: 'merchant-1',
        status: OrderStatus.PAID,
        buyerNameSnapshot: null,
        buyerContactSnapshot: null,
        recipientNameSnapshot: null,
        destinationZipCode: null,
        city: null,
        state: null,
        destinationAddressSnapshot: null,
        items: [],
      },
      externalItems: [],
    };

    const tx = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue(existingReference),
        update: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
          orderId: 'order-1',
          externalUpdatedAt: incomingExternalUpdatedAt,
          lastSyncedAt: new Date(),
        }),
      },
      order: {
        update: jest.fn(),
      },
      orderEvent: {
        create: jest.fn(),
      },
    };

    const prisma = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
          orderId: 'order-1',
          externalUpdatedAt: previousExternalUpdatedAt,
          lastSyncedAt: new Date('2026-09-01T11:05:00.000Z'),
        }),
      },
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    const service = new ExternalOrderIngestionService(prisma);

    const result = await service.ingest({
      salesChannelId: 'channel-1',
      externalOrderId: 'external-order-1',
      externalCreatedAt: null,
      externalUpdatedAt: incomingExternalUpdatedAt,
    });

    expect(result.action).toBe('update');

    expect(tx.externalOrderReference.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalCreatedAt: undefined,
        }),
      }),
    );

    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.orderEvent.create).not.toHaveBeenCalled();
  });

  it('does not persist an invalid externalCreatedAt on a non-stale update', async () => {
    const invalidExternalCreatedAt = new Date(Number.NaN);
    const previousExternalUpdatedAt = new Date(
      '2026-09-01T11:00:00.000Z',
    );
    const incomingExternalUpdatedAt = new Date(
      '2026-09-01T13:00:00.000Z',
    );

    const existingReference = {
      id: 'external-reference-1',
      orderId: 'order-1',
      externalStatus: 'paid',
      externalCreatedAt: null,
      externalUpdatedAt: previousExternalUpdatedAt,
      lastSyncedAt: new Date('2026-09-01T11:05:00.000Z'),
      metadata: null,
      order: {
        id: 'order-1',
        merchantId: 'merchant-1',
        status: OrderStatus.PAID,
        buyerNameSnapshot: null,
        buyerContactSnapshot: null,
        recipientNameSnapshot: null,
        destinationZipCode: null,
        city: null,
        state: null,
        destinationAddressSnapshot: null,
        items: [],
      },
      externalItems: [],
    };

    const tx = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue(existingReference),
        update: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
          orderId: 'order-1',
          externalUpdatedAt: incomingExternalUpdatedAt,
          lastSyncedAt: new Date(),
        }),
      },
      order: {
        update: jest.fn(),
      },
      orderEvent: {
        create: jest.fn(),
      },
    };

    const prisma = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
          orderId: 'order-1',
          externalUpdatedAt: previousExternalUpdatedAt,
          lastSyncedAt: new Date('2026-09-01T11:05:00.000Z'),
        }),
      },
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    const service = new ExternalOrderIngestionService(prisma);

    const result = await service.ingest({
      salesChannelId: 'channel-1',
      externalOrderId: 'external-order-1',
      externalCreatedAt: invalidExternalCreatedAt,
      externalUpdatedAt: incomingExternalUpdatedAt,
    });

    expect(result.action).toBe('update');

    expect(tx.externalOrderReference.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalCreatedAt: undefined,
        }),
      }),
    );

    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.orderEvent.create).not.toHaveBeenCalled();
  });

  it('keeps updating externalUpdatedAt on a non-stale update', async () => {
    const previousExternalUpdatedAt = new Date(
      '2026-09-01T11:00:00.000Z',
    );
    const incomingExternalUpdatedAt = new Date(
      '2026-09-01T13:00:00.000Z',
    );

    const existingReference = {
      id: 'external-reference-1',
      orderId: 'order-1',
      externalStatus: 'paid',
      externalCreatedAt: null,
      externalUpdatedAt: previousExternalUpdatedAt,
      lastSyncedAt: new Date('2026-09-01T11:05:00.000Z'),
      metadata: null,
      order: {
        id: 'order-1',
        merchantId: 'merchant-1',
        status: OrderStatus.PAID,
        buyerNameSnapshot: null,
        buyerContactSnapshot: null,
        recipientNameSnapshot: null,
        destinationZipCode: null,
        city: null,
        state: null,
        destinationAddressSnapshot: null,
        items: [],
      },
      externalItems: [],
    };

    const tx = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue(existingReference),
        update: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
          orderId: 'order-1',
          externalUpdatedAt: incomingExternalUpdatedAt,
          lastSyncedAt: new Date(),
        }),
      },
      order: {
        update: jest.fn(),
      },
      orderEvent: {
        create: jest.fn(),
      },
    };

    const prisma = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
          orderId: 'order-1',
          externalUpdatedAt: previousExternalUpdatedAt,
          lastSyncedAt: new Date('2026-09-01T11:05:00.000Z'),
        }),
      },
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    const service = new ExternalOrderIngestionService(prisma);

    const result = await service.ingest({
      salesChannelId: 'channel-1',
      externalOrderId: 'external-order-1',
      externalUpdatedAt: incomingExternalUpdatedAt,
    });

    expect(result.action).toBe('update');

    expect(tx.externalOrderReference.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalUpdatedAt: incomingExternalUpdatedAt,
        }),
      }),
    );

    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.orderEvent.create).not.toHaveBeenCalled();
  });

  it('keeps updating the order status and creating its event on a non-stale update', async () => {
    const previousExternalUpdatedAt = new Date(
      '2026-09-01T11:00:00.000Z',
    );
    const incomingExternalUpdatedAt = new Date(
      '2026-09-01T13:00:00.000Z',
    );

    const existingReference = {
      id: 'external-reference-1',
      orderId: 'order-1',
      externalStatus: 'paid',
      externalCreatedAt: new Date('2026-09-01T10:00:00.000Z'),
      externalUpdatedAt: previousExternalUpdatedAt,
      lastSyncedAt: new Date('2026-09-01T11:05:00.000Z'),
      metadata: null,
      order: {
        id: 'order-1',
        merchantId: 'merchant-1',
        status: OrderStatus.PAID,
        buyerNameSnapshot: null,
        buyerContactSnapshot: null,
        recipientNameSnapshot: null,
        destinationZipCode: null,
        city: null,
        state: null,
        destinationAddressSnapshot: null,
        items: [],
      },
      externalItems: [],
    };

    const tx = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue(existingReference),
        update: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
          orderId: 'order-1',
          externalUpdatedAt: incomingExternalUpdatedAt,
          lastSyncedAt: new Date(),
        }),
      },
      order: {
        update: jest.fn().mockResolvedValue({
          id: 'order-1',
          status: OrderStatus.IN_TRANSIT,
        }),
      },
      orderEvent: {
        create: jest.fn().mockResolvedValue({
          id: 'order-event-1',
        }),
      },
    };

    const prisma = {
      salesChannel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'channel-1',
          merchantId: 'merchant-1',
          status: 'ACTIVE',
        }),
      },
      externalOrderReference: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'external-reference-1',
          orderId: 'order-1',
          externalUpdatedAt: previousExternalUpdatedAt,
          lastSyncedAt: new Date('2026-09-01T11:05:00.000Z'),
        }),
      },
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    const service = new ExternalOrderIngestionService(prisma);

    const result = await service.ingest({
      salesChannelId: 'channel-1',
      externalOrderId: 'external-order-1',
      externalStatus: 'in_transit',
      externalUpdatedAt: incomingExternalUpdatedAt,
      canonicalStatus: OrderStatus.IN_TRANSIT,
    });

    expect(result.action).toBe('update');

    expect(tx.order.update).toHaveBeenCalledWith({
      where: {
        id: 'order-1',
      },
      data: {
        status: OrderStatus.IN_TRANSIT,
      },
    });

    expect(tx.orderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        type: OrderEventType.STATUS_CHANGED,
        fromStatus: OrderStatus.PAID,
        toStatus: OrderStatus.IN_TRANSIT,
      }),
    });

    expect(tx.externalOrderReference.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalStatus: 'in_transit',
          externalCreatedAt: undefined,
          externalUpdatedAt: incomingExternalUpdatedAt,
        }),
      }),
    );
  });

  describe('areJsonValuesStructurallyEqual', () => {
    const service = new ExternalOrderIngestionService(
      {} as unknown as PrismaService,
    );

    const compare = (left: unknown, right: unknown) =>
      (
        service as unknown as {
          areJsonValuesStructurallyEqual: (
            left: unknown,
            right: unknown,
          ) => boolean;
        }
      ).areJsonValuesStructurallyEqual(left, right);

    it('treats objects with the same keys in different orders as equal', () => {
      expect(
        compare(
          {
            cor: 'preto',
            braco: 'corda',
          },
          {
            braco: 'corda',
            cor: 'preto',
          },
        ),
      ).toBe(true);
    });

    it('treats objects with different values as different', () => {
      expect(
        compare(
          {
            cor: 'preto',
          },
          {
            cor: 'branco',
          },
        ),
      ).toBe(false);
    });

    it('treats arrays with the same values in the same order as equal', () => {
      expect(compare(['preto', 'corda'], ['preto', 'corda'])).toBe(true);
    });

    it('treats arrays with the same values in a different order as different', () => {
      expect(compare(['preto', 'corda'], ['corda', 'preto'])).toBe(false);
    });

    it('compares nested objects and arrays recursively', () => {
      expect(
        compare(
          {
            acabamento: {
              cor: 'preto',
              opcoes: ['fosco', { braco: 'corda' }],
            },
          },
          {
            acabamento: {
              opcoes: ['fosco', { braco: 'corda' }],
              cor: 'preto',
            },
          },
        ),
      ).toBe(true);
    });

    it('treats null as equal only to null', () => {
      expect(compare(null, null)).toBe(true);
    });

    it('treats null and a non-null value as different', () => {
      expect(compare(null, {})).toBe(false);
      expect(compare(null, 'preto')).toBe(false);
    });

    it('distinguishes a missing object key from a key explicitly set to null', () => {
      expect(
        compare(
          {
            cor: 'preto',
          },
          {
            cor: 'preto',
            braco: null,
          },
        ),
      ).toBe(false);
    });

    it('treats objects with the same keys and values as equal', () => {
      expect(
        compare(
          {
            cor: 'preto',
            braco: null,
          },
          {
            cor: 'preto',
            braco: null,
          },
        ),
      ).toBe(true);
    });

    it('compares primitive values by value', () => {
      expect(compare('preto', 'preto')).toBe(true);
      expect(compare('preto', 'branco')).toBe(false);
      expect(compare(2, 2)).toBe(true);
      expect(compare(2, 3)).toBe(false);
      expect(compare(true, true)).toBe(true);
      expect(compare(true, false)).toBe(false);
    });
  });

  describe('getItemReconciliationPlanState', () => {
    const service = new ExternalOrderIngestionService(
      {} as unknown as PrismaService,
    );

    const getPlanState = (input: {
      hasCanonicalOrderItem: boolean;
      productIdComparisonState:
        | 'not_comparable'
        | 'not_provided'
        | 'invalid'
        | 'matches'
        | 'differs';
      variationComparisonState:
        | 'not_comparable'
        | 'not_provided'
        | 'matches'
        | 'differs';
      scalarItemComparisonState: 'not_comparable' | 'matches' | 'differs';
    }) =>
      (
        service as unknown as {
          getItemReconciliationPlanState: (input: {
            hasCanonicalOrderItem: boolean;
            productIdComparisonState:
              | 'not_comparable'
              | 'not_provided'
              | 'invalid'
              | 'matches'
              | 'differs';
            variationComparisonState:
              | 'not_comparable'
              | 'not_provided'
              | 'matches'
              | 'differs';
            scalarItemComparisonState:
              | 'not_comparable'
              | 'matches'
              | 'differs';
          }) =>
            | 'blocked_not_comparable'
            | 'blocked_invalid_product_id'
            | 'blocked_product_relink_required'
            | 'snapshot_changes_detected'
            | 'no_changes';
        }
      ).getItemReconciliationPlanState(input);

    it('blocks when there is no canonical order item', () => {
      expect(
        getPlanState({
          hasCanonicalOrderItem: false,
          productIdComparisonState: 'not_comparable',
          variationComparisonState: 'not_comparable',
          scalarItemComparisonState: 'not_comparable',
        }),
      ).toBe('blocked_not_comparable');
    });

    it('gives invalid productId precedence over snapshot differences', () => {
      expect(
        getPlanState({
          hasCanonicalOrderItem: true,
          productIdComparisonState: 'invalid',
          variationComparisonState: 'differs',
          scalarItemComparisonState: 'differs',
        }),
      ).toBe('blocked_invalid_product_id');
    });

    it('gives product relink precedence over snapshot differences', () => {
      expect(
        getPlanState({
          hasCanonicalOrderItem: true,
          productIdComparisonState: 'differs',
          variationComparisonState: 'differs',
          scalarItemComparisonState: 'differs',
        }),
      ).toBe('blocked_product_relink_required');
    });

    it('detects scalar snapshot changes when product identity is safe', () => {
      expect(
        getPlanState({
          hasCanonicalOrderItem: true,
          productIdComparisonState: 'matches',
          variationComparisonState: 'matches',
          scalarItemComparisonState: 'differs',
        }),
      ).toBe('snapshot_changes_detected');
    });

    it('detects variation snapshot changes when product identity is safe', () => {
      expect(
        getPlanState({
          hasCanonicalOrderItem: true,
          productIdComparisonState: 'not_provided',
          variationComparisonState: 'differs',
          scalarItemComparisonState: 'matches',
        }),
      ).toBe('snapshot_changes_detected');
    });

    it('reports no changes when all provided values match', () => {
      expect(
        getPlanState({
          hasCanonicalOrderItem: true,
          productIdComparisonState: 'matches',
          variationComparisonState: 'matches',
          scalarItemComparisonState: 'matches',
        }),
      ).toBe('no_changes');
    });

    it('preserves missing productId and variation as no changes', () => {
      expect(
        getPlanState({
          hasCanonicalOrderItem: true,
          productIdComparisonState: 'not_provided',
          variationComparisonState: 'not_provided',
          scalarItemComparisonState: 'matches',
        }),
      ).toBe('no_changes');
    });
  });

  describe('summarizeItemReconciliationPlans', () => {
    const service = new ExternalOrderIngestionService(
      {} as unknown as PrismaService,
    );

    type ItemReconciliationPlanState =
      | 'blocked_not_comparable'
      | 'blocked_invalid_product_id'
      | 'blocked_product_relink_required'
      | 'snapshot_changes_detected'
      | 'no_changes';

    const summarize = (states: ItemReconciliationPlanState[]) =>
      (
        service as unknown as {
          summarizeItemReconciliationPlans: (
            matches: ReadonlyArray<{
              itemReconciliationPlanState: ItemReconciliationPlanState;
            }>,
          ) => {
            totalItems: number;
            noChanges: number;
            snapshotChangesDetected: number;
            blockedNotComparable: number;
            blockedInvalidProductId: number;
            blockedProductRelinkRequired: number;
            blockedItems: number;
          };
        }
      ).summarizeItemReconciliationPlans(
        states.map((itemReconciliationPlanState) => ({
          itemReconciliationPlanState,
        })),
      );

    it('summarizes mixed reconciliation plan states', () => {
      expect(
        summarize([
          'no_changes',
          'no_changes',
          'snapshot_changes_detected',
          'blocked_not_comparable',
          'blocked_invalid_product_id',
          'blocked_product_relink_required',
        ]),
      ).toEqual({
        totalItems: 6,
        noChanges: 2,
        snapshotChangesDetected: 1,
        blockedNotComparable: 1,
        blockedInvalidProductId: 1,
        blockedProductRelinkRequired: 1,
        blockedItems: 3,
      });
    });

    it('returns a zeroed summary for an empty set', () => {
      expect(summarize([])).toEqual({
        totalItems: 0,
        noChanges: 0,
        snapshotChangesDetected: 0,
        blockedNotComparable: 0,
        blockedInvalidProductId: 0,
        blockedProductRelinkRequired: 0,
        blockedItems: 0,
      });
    });
  });

  describe('getItemReconciliationSetState', () => {
    const service = new ExternalOrderIngestionService(
      {} as unknown as PrismaService,
    );

    const getSetState = (input: {
      itemUpdateEligibility:
        | 'matched_items_only'
        | 'blocked_unmatched'
        | 'preserve_items';
      itemReconciliationPlanSummary: {
        blockedItems: number;
        snapshotChangesDetected: number;
      };
    }) =>
      (
        service as unknown as {
          getItemReconciliationSetState: (input: {
            itemUpdateEligibility:
              | 'matched_items_only'
              | 'blocked_unmatched'
              | 'preserve_items';
            itemReconciliationPlanSummary: {
              blockedItems: number;
              snapshotChangesDetected: number;
            };
          }) =>
            | 'preserve_items'
            | 'blocked_unmatched'
            | 'blocked_item_reconciliation'
            | 'snapshot_changes_detected'
            | 'no_changes';
        }
      ).getItemReconciliationSetState(input);

    it('gives preserve_items precedence over reconciliation details', () => {
      expect(
        getSetState({
          itemUpdateEligibility: 'preserve_items',
          itemReconciliationPlanSummary: {
            blockedItems: 2,
            snapshotChangesDetected: 3,
          },
        }),
      ).toBe('preserve_items');
    });

    it('gives blocked_unmatched precedence over reconciliation details', () => {
      expect(
        getSetState({
          itemUpdateEligibility: 'blocked_unmatched',
          itemReconciliationPlanSummary: {
            blockedItems: 2,
            snapshotChangesDetected: 3,
          },
        }),
      ).toBe('blocked_unmatched');
    });

    it('gives blocked item reconciliation precedence over snapshot changes', () => {
      expect(
        getSetState({
          itemUpdateEligibility: 'matched_items_only',
          itemReconciliationPlanSummary: {
            blockedItems: 1,
            snapshotChangesDetected: 2,
          },
        }),
      ).toBe('blocked_item_reconciliation');
    });

    it('detects snapshot changes when matched items have no blockers', () => {
      expect(
        getSetState({
          itemUpdateEligibility: 'matched_items_only',
          itemReconciliationPlanSummary: {
            blockedItems: 0,
            snapshotChangesDetected: 2,
          },
        }),
      ).toBe('snapshot_changes_detected');
    });

    it('reports no changes when matched items have no blockers or changes', () => {
      expect(
        getSetState({
          itemUpdateEligibility: 'matched_items_only',
          itemReconciliationPlanSummary: {
            blockedItems: 0,
            snapshotChangesDetected: 0,
          },
        }),
      ).toBe('no_changes');
    });
  });

});
