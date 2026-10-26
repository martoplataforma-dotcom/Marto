import { OrderStatus } from '@prisma/client';

import type { NormalizedExternalOrderInput } from '../../orders/types/normalized-external-order';

type MercadoLivreOrderAdapterContract = {
  normalize(input: {
    salesChannelId: string;
    order: Record<string, unknown>;
    shipment?: Record<string, unknown>;
  }): NormalizedExternalOrderInput;
};

type MercadoLivreOrderAdapterModule = {
  MercadoLivreOrderAdapter: new () => MercadoLivreOrderAdapterContract;
};

function createAdapter(): MercadoLivreOrderAdapterContract {
  const module = jest.requireActual<MercadoLivreOrderAdapterModule>(
    './mercado-livre-order.adapter',
  );

  return new module.MercadoLivreOrderAdapter();
}

function createOrder(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 200000000001,
    status: 'paid',
    date_created: '2026-10-20T12:00:00.000Z',
    last_updated: '2026-10-20T13:00:00.000Z',
    pack_id: 900000000001,
    currency_id: 'BRL',
    total_amount: 199.9,
    paid_amount: 199.9,
    seller: {
      id: 123456789,
    },
    buyer: {
      id: 987654321,
      first_name: 'Maria',
      last_name: 'Silva',
      nickname: 'MARIA_TESTE',
    },
    order_items: [
      {
        item: {
          id: 'MLB1234567890',
          title: 'Produto de teste',
          seller_sku: 'SKU-ML-001',
          seller_custom_field: 'CUSTOM-001',
          variation_id: 456789,
          variation_attributes: [
            {
              id: 'COLOR',
              name: 'Cor',
              value_id: '52049',
              value_name: 'Preto',
            },
          ],
        },
        quantity: 2,
        unit_price: 99.95,
      },
    ],
    ...overrides,
  };
}

describe('MercadoLivreOrderAdapter', () => {
  it('transforms order.id into externalOrderId string', () => {
    const adapter = createAdapter();

    const result = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder({
        id: 200000000001,
      }),
    });

    expect(result.externalOrderId).toBe('200000000001');
  });

  it('uses the salesChannelId provided by the caller', () => {
    const adapter = createAdapter();

    const result = adapter.normalize({
      salesChannelId: 'channel-abc',
      order: createOrder(),
    });

    expect(result.salesChannelId).toBe('channel-abc');
  });

  it('never uses pack_id as externalOrderId', () => {
    const adapter = createAdapter();

    const result = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder({
        id: 2001,
        pack_id: 9999,
      }),
    });

    expect(result.externalOrderId).toBe('2001');
    expect(result.externalOrderId).not.toBe('9999');
  });

  it('preserves pack_id in metadata when it is present', () => {
    const adapter = createAdapter();

    const result = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder({
        pack_id: 9999,
      }),
    });

    expect(result.metadata).toEqual(
      expect.objectContaining({
        packId: '9999',
      }),
    );
  });

  it('maps Mercado Livre order paid to canonical PAID', () => {
    const adapter = createAdapter();

    const result = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder({
        status: 'paid',
      }),
    });

    expect(result.externalStatus).toBe('paid');
    expect(result.canonicalStatus).toBe(OrderStatus.PAID);
  });

  it('maps Mercado Livre order cancelled to canonical CANCELLED', () => {
    const adapter = createAdapter();

    const result = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder({
        status: 'cancelled',
      }),
    });

    expect(result.externalStatus).toBe('cancelled');
    expect(result.canonicalStatus).toBe(OrderStatus.CANCELLED);
  });

  it('maps shipment delivered to canonical DELIVERED', () => {
    const adapter = createAdapter();

    const result = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder({
        status: 'paid',
      }),
      shipment: {
        id: 7001,
        status: 'delivered',
      },
    });

    expect(result.canonicalStatus).toBe(OrderStatus.DELIVERED);
  });

  it('maps shipment shipped to canonical IN_TRANSIT', () => {
    const adapter = createAdapter();

    const result = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder({
        status: 'paid',
      }),
      shipment: {
        id: 7001,
        status: 'shipped',
      },
    });

    expect(result.canonicalStatus).toBe(OrderStatus.IN_TRANSIT);
  });

  it('does not map Mercado Livre confirmed to CONFIRMED_BY_SELLER automatically', () => {
    const adapter = createAdapter();

    expect(() =>
      adapter.normalize({
        salesChannelId: 'channel-1',
        order: createOrder({
          status: 'confirmed',
        }),
      }),
    ).toThrow();

    try {
      adapter.normalize({
        salesChannelId: 'channel-1',
        order: createOrder({
          status: 'confirmed',
        }),
      });
    } catch (error) {
      expect(String(error)).not.toContain(OrderStatus.CONFIRMED_BY_SELLER);
    }
  });

  it('uses item.id as externalItemId', () => {
    const adapter = createAdapter();

    const result = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder(),
    });

    expect(result.items).toHaveLength(1);
    expect(result.items?.[0].externalItemId).toBe('MLB1234567890');
  });

  it('does not infer Marto productId from Mercado Livre item data', () => {
    const adapter = createAdapter();

    const result = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder(),
    });

    expect(result.items?.[0].productId).toBeUndefined();
  });

  it('preserves seller SKU only as snapshot and falls back to seller_custom_field', () => {
    const adapter = createAdapter();

    const withSellerSku = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder(),
    });

    expect(withSellerSku.items?.[0].sku).toBe('SKU-ML-001');
    expect(withSellerSku.items?.[0].productId).toBeUndefined();

    const withCustomField = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder({
        order_items: [
          {
            item: {
              id: 'MLB1234567890',
              title: 'Produto de teste',
              seller_sku: '   ',
              seller_custom_field: 'CUSTOM-001',
            },
            quantity: 1,
            unit_price: 50,
          },
        ],
      }),
    });

    expect(withCustomField.items?.[0].sku).toBe('CUSTOM-001');
    expect(withCustomField.items?.[0].productId).toBeUndefined();
  });

  it('preserves variation_id and variation attributes as snapshot', () => {
    const adapter = createAdapter();

    const result = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder(),
    });

    expect(result.items?.[0].variation).toEqual({
      variationId: '456789',
      attributes: [
        {
          id: 'COLOR',
          name: 'Cor',
          valueId: '52049',
          valueName: 'Preto',
        },
      ],
    });
  });

  it('normalizes item quantity and unit price', () => {
    const adapter = createAdapter();

    const result = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder(),
    });

    expect(result.items?.[0].quantity).toBe(2);
    expect(Number(result.items?.[0].unitPrice)).toBe(99.95);
  });

  it('uses date_created as externalCreatedAt', () => {
    const adapter = createAdapter();

    const result = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder({
        date_created: '2026-10-20T12:00:00.000Z',
      }),
    });

    expect(result.externalCreatedAt).toEqual(
      new Date('2026-10-20T12:00:00.000Z'),
    );
  });

  it('uses detail last_updated as externalUpdatedAt', () => {
    const adapter = createAdapter();

    const result = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder({
        last_updated: '2026-10-20T13:00:00.000Z',
        date_last_updated: '1999-01-01T00:00:00.000Z',
      }),
    });

    expect(result.externalUpdatedAt).toEqual(
      new Date('2026-10-20T13:00:00.000Z'),
    );
  });

  it('rejects an invalid mandatory last_updated instead of inventing a date', () => {
    const adapter = createAdapter();

    expect(() =>
      adapter.normalize({
        salesChannelId: 'channel-1',
        order: createOrder({
          last_updated: 'not-a-date',
        }),
      }),
    ).toThrow(/last_updated/i);
  });

  it('does not invent destination data when shipment is absent', () => {
    const adapter = createAdapter();

    const result = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder(),
    });

    expect(result.recipientName).toBeUndefined();
    expect(result.destinationZipCode).toBeUndefined();
    expect(result.city).toBeUndefined();
    expect(result.state).toBeUndefined();
    expect(result.destinationAddress).toBeUndefined();
  });

  it('uses enriched shipment data for destination snapshots when available', () => {
    const adapter = createAdapter();

    const result = adapter.normalize({
      salesChannelId: 'channel-1',
      order: createOrder(),
      shipment: {
        id: 7001,
        receiver_address: {
          receiver_name: 'Maria Silva',
          zip_code: '36500-000',
          city: {
            name: 'Ubá',
          },
          state: {
            name: 'MG',
          },
          address_line: 'Rua Exemplo, 100',
          street_name: 'Rua Exemplo',
          street_number: '100',
          neighborhood: {
            name: 'Centro',
          },
          comment: 'Fundos',
        },
      },
    });

    expect(result.recipientName).toBe('Maria Silva');
    expect(result.destinationZipCode).toBe('36500-000');
    expect(result.city).toBe('Ubá');
    expect(result.state).toBe('MG');
    expect(result.destinationAddress).toEqual(
      expect.objectContaining({
        addressLine: 'Rua Exemplo, 100',
        streetName: 'Rua Exemplo',
        streetNumber: '100',
      }),
    );
  });

  it('fails explicitly when the Mercado Livre item has no external item id', () => {
    const adapter = createAdapter();

    expect(() =>
      adapter.normalize({
        salesChannelId: 'channel-1',
        order: createOrder({
          order_items: [
            {
              item: {
                title: 'Produto sem ID',
              },
              quantity: 1,
              unit_price: 50,
            },
          ],
        }),
      }),
    ).toThrow(/item.*id/i);
  });

  it('fails on incompatible item structure without inferring identity by position, title or SKU', () => {
    const adapter = createAdapter();

    expect(() =>
      adapter.normalize({
        salesChannelId: 'channel-1',
        order: createOrder({
          order_items: [
            {
              item: {
                id: 'MLB-1',
                title: 'Produto A',
                seller_sku: 'SKU-A',
              },
              quantity: 1,
              unit_price: 50,
            },
            {
              item: {
                id: 'MLB-2',
                title: 'Produto B',
                seller_sku: 'SKU-B',
              },
              quantity: 1,
              unit_price: 60,
            },
          ],
        }),
      }),
    ).toThrow(/order_items|item/i);
  });

  it('fails explicitly when status has no approved safe mapping', () => {
    const adapter = createAdapter();

    expect(() =>
      adapter.normalize({
        salesChannelId: 'channel-1',
        order: createOrder({
          status: 'paid',
        }),
        shipment: {
          id: 7001,
          status: 'ready_to_ship',
        },
      }),
    ).toThrow(/ready_to_ship|status/i);
  });
});
