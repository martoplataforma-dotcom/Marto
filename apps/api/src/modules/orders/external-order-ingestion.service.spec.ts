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
});