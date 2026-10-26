import { OrderEventType, OrderStatus, Prisma } from '@prisma/client';

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

  describe('item snapshot reconciliation writes', () => {
    const previousExternalUpdatedAt = new Date(
      '2026-09-01T11:00:00.000Z',
    );
    const incomingExternalUpdatedAt = new Date(
      '2026-09-01T13:00:00.000Z',
    );

    type CanonicalOrderItemFixture = {
      id: string;
      productId: string | null;
      titleSnapshot: string | null;
      skuSnapshot: string | null;
      variationSnapshot: unknown;
      quantity: number;
      unitPrice: Prisma.Decimal;
    };

    type ExternalOrderItemReferenceFixture = {
      id: string;
      orderItemId: string;
      externalItemId: string;
    };

    const createHarness = (input?: {
      orderItems?: CanonicalOrderItemFixture[];
      externalItems?: ExternalOrderItemReferenceFixture[];
    }) => {
      const orderItems =
        input?.orderItems ??
        [
          {
            id: 'order-item-1',
            productId: 'product-1',
            titleSnapshot: 'Produto 1',
            skuSnapshot: 'SKU-1',
            variationSnapshot: {
              cor: 'preto',
            },
            quantity: 1,
            unitPrice: new Prisma.Decimal('100.00'),
          },
        ];

      const externalItems =
        input?.externalItems ??
        orderItems.map((item, index) => ({
          id: `external-order-item-reference-${index + 1}`,
          orderItemId: item.id,
          externalItemId: `external-item-${index + 1}`,
        }));

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
          items: orderItems,
        },
        externalItems,
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
        orderItem: {
          update: jest.fn().mockResolvedValue({
            id: 'updated-order-item',
          }),
          create: jest.fn().mockResolvedValue({
            id: 'created-order-item',
          }),
        },
        externalOrderItemReference: {
          create: jest.fn().mockResolvedValue({
            id: 'created-external-order-item-reference',
          }),
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

      return {
        service: new ExternalOrderIngestionService(prisma),
        tx,
      };
    };

    it('updates only changed snapshots for an identified item', async () => {
      const { service, tx } = createHarness();

      await service.ingest({
        salesChannelId: 'channel-1',
        externalOrderId: 'external-order-1',
        externalUpdatedAt: incomingExternalUpdatedAt,
        items: [
          {
            externalItemId: 'external-item-1',
            productId: 'product-1',
            title: '  Produto atualizado  ',
            sku: '  SKU-2  ',
            variation: {
              cor: 'branco',
            },
            quantity: 2,
            unitPrice: '120.50',
          },
        ],
      });

      expect(tx.orderItem.update).toHaveBeenCalledTimes(1);

      const updateCall = tx.orderItem.update.mock.calls[0][0];

      expect(updateCall.where).toEqual({
        id: 'order-item-1',
      });

      expect(updateCall.data).toEqual(
        expect.objectContaining({
          titleSnapshot: 'Produto atualizado',
          skuSnapshot: 'SKU-2',
          variationSnapshot: {
            cor: 'branco',
          },
          quantity: 2,
        }),
      );

      expect(updateCall.data).toHaveProperty('unitPrice');
      expect(updateCall.data).not.toHaveProperty('productId');

      expect(tx.orderEvent.create).not.toHaveBeenCalled();
    });

    it('preserves omitted SKU and variation while updating another snapshot', async () => {
      const { service, tx } = createHarness();

      await service.ingest({
        salesChannelId: 'channel-1',
        externalOrderId: 'external-order-1',
        externalUpdatedAt: incomingExternalUpdatedAt,
        items: [
          {
            externalItemId: 'external-item-1',
            title: 'Produto renomeado',
            quantity: 1,
            unitPrice: '100.00',
          },
        ],
      });

      expect(tx.orderItem.update).toHaveBeenCalledTimes(1);
      expect(tx.orderItem.update).toHaveBeenCalledWith({
        where: {
          id: 'order-item-1',
        },
        data: {
          titleSnapshot: 'Produto renomeado',
        },
      });
    });

    it('blocks the entire received set when one item requires product relink', async () => {
      const { service, tx } = createHarness({
        orderItems: [
          {
            id: 'order-item-1',
            productId: 'product-1',
            titleSnapshot: 'Produto 1',
            skuSnapshot: 'SKU-1',
            variationSnapshot: null,
            quantity: 1,
            unitPrice: new Prisma.Decimal('100.00'),
          },
          {
            id: 'order-item-2',
            productId: 'product-2',
            titleSnapshot: 'Produto 2',
            skuSnapshot: 'SKU-2',
            variationSnapshot: null,
            quantity: 1,
            unitPrice: new Prisma.Decimal('200.00'),
          },
        ],
      });

      await service.ingest({
        salesChannelId: 'channel-1',
        externalOrderId: 'external-order-1',
        externalUpdatedAt: incomingExternalUpdatedAt,
        items: [
          {
            externalItemId: 'external-item-1',
            productId: 'product-1',
            title: 'Produto 1 alterado',
            quantity: 1,
            unitPrice: '100.00',
          },
          {
            externalItemId: 'external-item-2',
            productId: 'product-different',
            title: 'Produto 2',
            quantity: 1,
            unitPrice: '200.00',
          },
        ],
      });

      expect(tx.orderItem.update).not.toHaveBeenCalled();
    });

    it('does not update items when the incoming set contains an unmatched item', async () => {
      const { service, tx } = createHarness();

      await service.ingest({
        salesChannelId: 'channel-1',
        externalOrderId: 'external-order-1',
        externalUpdatedAt: incomingExternalUpdatedAt,
        items: [
          {
            externalItemId: 'external-item-unknown',
            title: 'Produto desconhecido',
            quantity: 1,
            unitPrice: '100.00',
          },
        ],
      });

      expect(tx.orderItem.update).not.toHaveBeenCalled();
    });

    it('updates only the received item in a matched subset', async () => {
      const { service, tx } = createHarness({
        orderItems: [
          {
            id: 'order-item-1',
            productId: 'product-1',
            titleSnapshot: 'Produto 1',
            skuSnapshot: 'SKU-1',
            variationSnapshot: null,
            quantity: 1,
            unitPrice: new Prisma.Decimal('100.00'),
          },
          {
            id: 'order-item-2',
            productId: 'product-2',
            titleSnapshot: 'Produto 2',
            skuSnapshot: 'SKU-2',
            variationSnapshot: null,
            quantity: 1,
            unitPrice: new Prisma.Decimal('200.00'),
          },
        ],
      });

      await service.ingest({
        salesChannelId: 'channel-1',
        externalOrderId: 'external-order-1',
        externalUpdatedAt: incomingExternalUpdatedAt,
        items: [
          {
            externalItemId: 'external-item-1',
            title: 'Produto 1',
            quantity: 3,
            unitPrice: '100.00',
          },
        ],
      });

      expect(tx.orderItem.update).toHaveBeenCalledTimes(1);
      expect(tx.orderItem.update).toHaveBeenCalledWith({
        where: {
          id: 'order-item-1',
        },
        data: {
          quantity: 3,
        },
      });
    });

    it('does not update an item when all received values are unchanged', async () => {
      const { service, tx } = createHarness();

      await service.ingest({
        salesChannelId: 'channel-1',
        externalOrderId: 'external-order-1',
        externalUpdatedAt: incomingExternalUpdatedAt,
        items: [
          {
            externalItemId: 'external-item-1',
            productId: 'product-1',
            title: 'Produto 1',
            sku: 'SKU-1',
            variation: {
              cor: 'preto',
            },
            quantity: 1,
            unitPrice: '100.0',
          },
        ],
      });

      expect(tx.orderItem.update).not.toHaveBeenCalled();
    });
  });

  describe('new external item creation on existing orders', () => {
    const previousExternalUpdatedAt = new Date(
      '2026-09-01T11:00:00.000Z',
    );
    const incomingExternalUpdatedAt = new Date(
      '2026-09-01T13:00:00.000Z',
    );

    type CanonicalOrderItemFixture = {
      id: string;
      productId: string | null;
      titleSnapshot: string | null;
      skuSnapshot: string | null;
      variationSnapshot: unknown;
      quantity: number;
      unitPrice: Prisma.Decimal;
    };

    type ExternalOrderItemReferenceFixture = {
      id: string;
      orderItemId: string;
      externalItemId: string;
    };

    const createHarness = (input?: {
      orderItems?: CanonicalOrderItemFixture[];
      externalItems?: ExternalOrderItemReferenceFixture[];
      products?: Array<{ id: string }>;
    }) => {
      const orderItems =
        input?.orderItems ??
        [
          {
            id: 'order-item-1',
            productId: 'product-1',
            titleSnapshot: 'Produto 1',
            skuSnapshot: 'SKU-1',
            variationSnapshot: {
              cor: 'preto',
            },
            quantity: 1,
            unitPrice: new Prisma.Decimal('100.00'),
          },
        ];

      const externalItems =
        input?.externalItems !== undefined
          ? input.externalItems
          : orderItems.map((item, index) => ({
              id: `external-order-item-reference-${index + 1}`,
              orderItemId: item.id,
              externalItemId: `external-item-${index + 1}`,
            }));

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
          items: orderItems,
        },
        externalItems,
      };

      let createdOrderItemIndex = 0;

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
        product: {
          findMany: jest.fn().mockResolvedValue(input?.products ?? []),
        },
        order: {
          update: jest.fn(),
        },
        orderItem: {
          update: jest.fn().mockResolvedValue({
            id: 'updated-order-item',
          }),
          create: jest.fn().mockImplementation(async () => {
            createdOrderItemIndex += 1;

            return {
              id: `created-order-item-${createdOrderItemIndex}`,
            };
          }),
        },
        externalOrderItemReference: {
          create: jest.fn().mockResolvedValue({
            id: 'created-external-order-item-reference',
          }),
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

      return {
        service: new ExternalOrderIngestionService(prisma),
        tx,
        prisma,
      };
    };

    it('creates a new item for an unknown externalItemId when existing identity is complete', async () => {
      const { service, tx } = createHarness();

      await service.ingest({
        salesChannelId: 'channel-1',
        externalOrderId: 'external-order-1',
        externalUpdatedAt: incomingExternalUpdatedAt,
        items: [
          {
            externalItemId: 'external-item-new',
            title: 'Produto novo',
            sku: 'SKU-NOVO',
            variation: {
              cor: 'branco',
            },
            quantity: 2,
            unitPrice: '150.00',
          },
        ],
      });

      expect(tx.orderItem.create).toHaveBeenCalledTimes(1);
    });

    it('creates OrderItem and ExternalOrderItemReference as an atomic pair', async () => {
      const { service, tx } = createHarness();

      await service.ingest({
        salesChannelId: 'channel-1',
        externalOrderId: 'external-order-1',
        externalUpdatedAt: incomingExternalUpdatedAt,
        items: [
          {
            externalItemId: 'external-item-new',
            title: 'Produto novo',
            quantity: 1,
            unitPrice: '90.00',
          },
        ],
      });

      expect(tx.orderItem.create).toHaveBeenCalledTimes(1);

      expect(tx.externalOrderItemReference.create).toHaveBeenCalledTimes(1);

      expect(tx.externalOrderItemReference.create).toHaveBeenCalledWith({
        data: {
          orderItemId: 'created-order-item-1',
          externalOrderReferenceId: 'external-reference-1',
          externalItemId: 'external-item-new',
        },
      });
    });

    it('creates a new external item with productId null when productId is omitted', async () => {
      const { service, tx } = createHarness();

      await service.ingest({
        salesChannelId: 'channel-1',
        externalOrderId: 'external-order-1',
        externalUpdatedAt: incomingExternalUpdatedAt,
        items: [
          {
            externalItemId: 'external-item-new',
            title: 'Produto sem catalogo',
            quantity: 1,
            unitPrice: '80.00',
          },
        ],
      });

      expect(tx.orderItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-1',
          productId: null,
          titleSnapshot: 'Produto sem catalogo',
          skuSnapshot: null,
          quantity: 1,
        }),
        select: {
          id: true,
        },
      });
    });

    it('accepts a new item productId only when it belongs to the same merchant', async () => {
      const { service, tx } = createHarness({
        products: [
          {
            id: 'product-new',
          },
        ],
      });

      await service.ingest({
        salesChannelId: 'channel-1',
        externalOrderId: 'external-order-1',
        externalUpdatedAt: incomingExternalUpdatedAt,
        items: [
          {
            externalItemId: 'external-item-new',
            productId: '  product-new  ',
            title: 'Produto vinculado',
            quantity: 1,
            unitPrice: '120.00',
          },
        ],
      });

      expect(tx.product.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['product-new'],
          },
          merchantId: 'merchant-1',
        },
        select: {
          id: true,
        },
      });

      expect(tx.orderItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-1',
          productId: 'product-new',
        }),
        select: {
          id: true,
        },
      });
    });

    it('blocks all item writes when a new item productId is invalid for the merchant', async () => {
      const { service, tx } = createHarness({
        products: [],
      });

      const result = await service.ingest({
        salesChannelId: 'channel-1',
        externalOrderId: 'external-order-1',
        externalUpdatedAt: incomingExternalUpdatedAt,
        items: [
          {
            externalItemId: 'external-item-1',
            title: 'Produto 1',
            quantity: 2,
            unitPrice: '100.00',
          },
          {
            externalItemId: 'external-item-new',
            productId: 'product-from-another-merchant',
            title: 'Produto invalido',
            quantity: 1,
            unitPrice: '50.00',
          },
        ],
      });

      expect(result.action).toBe('update');

      expect(tx.product.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['product-from-another-merchant'],
          },
          merchantId: 'merchant-1',
        },
        select: {
          id: true,
        },
      });

      expect(tx.orderItem.update).not.toHaveBeenCalled();
      expect(tx.orderItem.create).not.toHaveBeenCalled();
      expect(tx.externalOrderItemReference.create).not.toHaveBeenCalled();
    });

    it('does not create an unknown item for a legacy order without item identity', async () => {
      const { service, tx } = createHarness({
        externalItems: [],
      });

      const result = await service.ingest({
        salesChannelId: 'channel-1',
        externalOrderId: 'external-order-1',
        externalUpdatedAt: incomingExternalUpdatedAt,
        items: [
          {
            externalItemId: 'external-item-new',
            title: 'Produto desconhecido',
            quantity: 1,
            unitPrice: '100.00',
          },
        ],
      });

      expect(result.action).toBe('update');

      expect(tx.orderItem.create).not.toHaveBeenCalled();
      expect(tx.externalOrderItemReference.create).not.toHaveBeenCalled();

      expect(tx.externalOrderReference.update).toHaveBeenCalledTimes(1);
    });

    it('preserves omitted existing items when a new item is received in a partial payload', async () => {
      const { service, tx } = createHarness({
        orderItems: [
          {
            id: 'order-item-1',
            productId: 'product-1',
            titleSnapshot: 'Produto 1',
            skuSnapshot: 'SKU-1',
            variationSnapshot: null,
            quantity: 1,
            unitPrice: new Prisma.Decimal('100.00'),
          },
          {
            id: 'order-item-2',
            productId: 'product-2',
            titleSnapshot: 'Produto 2',
            skuSnapshot: 'SKU-2',
            variationSnapshot: null,
            quantity: 1,
            unitPrice: new Prisma.Decimal('200.00'),
          },
        ],
      });

      await service.ingest({
        salesChannelId: 'channel-1',
        externalOrderId: 'external-order-1',
        externalUpdatedAt: incomingExternalUpdatedAt,
        items: [
          {
            externalItemId: 'external-item-new',
            title: 'Produto 3',
            quantity: 1,
            unitPrice: '300.00',
          },
        ],
      });

      expect(tx.orderItem.create).toHaveBeenCalledTimes(1);
      expect(tx.orderItem.update).not.toHaveBeenCalled();

      expect(tx.externalOrderItemReference.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          externalItemId: 'external-item-new',
          externalOrderReferenceId: 'external-reference-1',
        }),
      });
    });

    it('updates known items and creates new items together when the mixed set has no blockers', async () => {
      const { service, tx } = createHarness();

      await service.ingest({
        salesChannelId: 'channel-1',
        externalOrderId: 'external-order-1',
        externalUpdatedAt: incomingExternalUpdatedAt,
        items: [
          {
            externalItemId: 'external-item-1',
            title: 'Produto 1',
            quantity: 2,
            unitPrice: '100.00',
          },
          {
            externalItemId: 'external-item-new',
            title: 'Produto novo',
            quantity: 1,
            unitPrice: '75.00',
          },
        ],
      });

      expect(tx.orderItem.update).toHaveBeenCalledTimes(1);
      expect(tx.orderItem.update).toHaveBeenCalledWith({
        where: {
          id: 'order-item-1',
        },
        data: {
          quantity: 2,
        },
      });

      expect(tx.orderItem.create).toHaveBeenCalledTimes(1);
      expect(tx.externalOrderItemReference.create).toHaveBeenCalledTimes(1);
    });

    it('never creates another item when the externalItemId is already known', async () => {
      const { service, tx } = createHarness();

      await service.ingest({
        salesChannelId: 'channel-1',
        externalOrderId: 'external-order-1',
        externalUpdatedAt: incomingExternalUpdatedAt,
        items: [
          {
            externalItemId: 'external-item-1',
            title: 'Produto 1',
            quantity: 2,
            unitPrice: '100.00',
          },
        ],
      });

      expect(tx.orderItem.update).toHaveBeenCalledTimes(1);
      expect(tx.orderItem.create).not.toHaveBeenCalled();
      expect(tx.externalOrderItemReference.create).not.toHaveBeenCalled();
    });
  });
  describe('update transaction retry behavior', () => {
    const previousExternalUpdatedAt = new Date(
      '2026-09-01T11:00:00.000Z',
    );

    const incomingExternalUpdatedAt = new Date(
      '2026-09-01T13:00:00.000Z',
    );

    const createKnownRequestError = (code: string) =>
      new Prisma.PrismaClientKnownRequestError(
        `Synthetic ${code} for update retry test.`,
        {
          code,
          clientVersion: '6.19.1',
        },
      );

    const createRetryHarness = (firstErrorCode: 'P2034' | 'P2002') => {
      const transactionalReference = {
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
          findUnique: jest.fn().mockResolvedValue(transactionalReference),
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

      let transactionAttempt = 0;

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
          async (
            callback: (transaction: typeof tx) => unknown,
          ) => {
            transactionAttempt += 1;

            if (transactionAttempt === 1) {
              throw createKnownRequestError(firstErrorCode);
            }

            return callback(tx);
          },
        ),
      } as unknown as PrismaService;

      return {
        service: new ExternalOrderIngestionService(prisma),
        prisma,
        tx,
      };
    };

    it('keeps retrying an update transaction after P2034', async () => {
      const { service, prisma } = createRetryHarness('P2034');

      await expect(
        service.ingest({
          salesChannelId: 'channel-1',
          externalOrderId: 'external-order-1',
          externalUpdatedAt: incomingExternalUpdatedAt,
        }),
      ).resolves.toMatchObject({
        action: 'update',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('retries an update transaction after P2002 before creating external item identity', async () => {
      const { service, prisma } = createRetryHarness('P2002');

      await expect(
        service.ingest({
          salesChannelId: 'channel-1',
          externalOrderId: 'external-order-1',
          externalUpdatedAt: incomingExternalUpdatedAt,
        }),
      ).resolves.toMatchObject({
        action: 'update',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });
    it('revalidates item identity after P2002 and does not create the item again', async () => {
      const baseOrderItem = {
        id: 'order-item-1',
        productId: 'product-1',
        titleSnapshot: 'Produto 1',
        skuSnapshot: 'SKU-1',
        variationSnapshot: null,
        quantity: 1,
        unitPrice: new Prisma.Decimal('100.00'),
      };

      const concurrentOrderItem = {
        id: 'order-item-concurrent',
        productId: null,
        titleSnapshot: 'Produto concorrente',
        skuSnapshot: null,
        variationSnapshot: null,
        quantity: 1,
        unitPrice: new Prisma.Decimal('90.00'),
      };

      const firstReferenceState = {
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
          items: [baseOrderItem],
        },
        externalItems: [
          {
            id: 'external-item-reference-1',
            orderItemId: 'order-item-1',
            externalItemId: 'external-item-1',
          },
        ],
      };

      const secondReferenceState = {
        ...firstReferenceState,
        order: {
          ...firstReferenceState.order,
          items: [
            baseOrderItem,
            concurrentOrderItem,
          ],
        },
        externalItems: [
          ...firstReferenceState.externalItems,
          {
            id: 'external-item-reference-concurrent',
            orderItemId: 'order-item-concurrent',
            externalItemId: 'external-item-new',
          },
        ],
      };

      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Synthetic concurrent external item identity collision.',
        {
          code: 'P2002',
          clientVersion: '6.19.1',
        },
      );

      const tx = {
        salesChannel: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'channel-1',
            merchantId: 'merchant-1',
            status: 'ACTIVE',
          }),
        },
        externalOrderReference: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(firstReferenceState)
            .mockResolvedValueOnce(secondReferenceState),
          update: jest.fn().mockResolvedValue({
            id: 'external-reference-1',
            orderId: 'order-1',
            externalUpdatedAt: incomingExternalUpdatedAt,
            lastSyncedAt: new Date(),
          }),
        },
        product: {
          findMany: jest.fn(),
        },
        order: {
          update: jest.fn(),
        },
        orderItem: {
          update: jest.fn(),
          create: jest.fn().mockResolvedValue({
            id: 'order-item-from-failed-attempt',
          }),
        },
        externalOrderItemReference: {
          create: jest.fn().mockRejectedValueOnce(p2002),
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

      await expect(
        service.ingest({
          salesChannelId: 'channel-1',
          externalOrderId: 'external-order-1',
          externalUpdatedAt: incomingExternalUpdatedAt,
          items: [
            {
              externalItemId: 'external-item-new',
              title: 'Produto concorrente',
              quantity: 1,
              unitPrice: '90.00',
            },
          ],
        }),
      ).resolves.toMatchObject({
        action: 'update',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);

      expect(
        tx.externalOrderReference.findUnique,
      ).toHaveBeenCalledTimes(2);

      // Primeira tentativa chegou a criar o item localmente,
      // mas a transacao falhou em P2002 e seria revertida pelo banco.
      expect(tx.orderItem.create).toHaveBeenCalledTimes(1);

      expect(
        tx.externalOrderItemReference.create,
      ).toHaveBeenCalledTimes(1);

      // Na segunda tentativa, a identidade concorrente ja existe.
      // Portanto nao deve existir uma segunda tentativa de criacao.
      expect(tx.orderItem.create).toHaveBeenCalledTimes(1);

      expect(tx.orderItem.update).not.toHaveBeenCalled();
    });
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

  describe('getSkuComparisonState', () => {
    const service = new ExternalOrderIngestionService(
      {} as unknown as PrismaService,
    );

    type SkuComparisonState = 'not_provided' | 'matches' | 'differs';

    const compare = (
      currentSku: string | null,
      incomingSku?: string | null,
    ): SkuComparisonState =>
      (
        service as unknown as {
          getSkuComparisonState: (
            currentSku: string | null,
            incomingSku?: string | null,
          ) => SkuComparisonState;
        }
      ).getSkuComparisonState(currentSku, incomingSku);

    it('treats an omitted incoming SKU as not provided', () => {
      expect(compare('SKU-1')).toBe('not_provided');
    });

    it('treats a null incoming SKU as not provided', () => {
      expect(compare('SKU-1', null)).toBe('not_provided');
    });

    it('treats an empty incoming SKU as not provided', () => {
      expect(compare('SKU-1', '')).toBe('not_provided');
    });

    it('treats a whitespace-only incoming SKU as not provided', () => {
      expect(compare('SKU-1', '   ')).toBe('not_provided');
    });

    it('trims a provided SKU before matching', () => {
      expect(compare('SKU-1', '  SKU-1  ')).toBe('matches');
    });

    it('detects a different non-empty SKU', () => {
      expect(compare('SKU-1', '  SKU-2  ')).toBe('differs');
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
