export {};

type MercadoLivreHttpRequest = {
  method: 'GET';
  path: string;
  headers: Record<string, string>;
  query?: Record<string, string | number>;
};

type MercadoLivreHttpResponse = {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
};

type MercadoLivreHttpTransport = {
  request(input: MercadoLivreHttpRequest): Promise<MercadoLivreHttpResponse>;
};

type SearchOrdersPageInput = {
  accessToken: string;
  sellerId: string;
  offset?: number;
  limit?: number;
  updatedFrom?: string;
  updatedTo?: string;
};

type GetOrderInput = {
  accessToken: string;
  orderId: string;
};

type GetOrderShipmentsInput = {
  accessToken: string;
  orderId: string;
};

type GetShipmentInput = {
  accessToken: string;
  shipmentId: string;
};

type SearchOrdersPageResult = {
  paging: unknown;
  results: unknown[];
};

type GetOrderResult = {
  status: 200 | 206;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

type MercadoLivreClientContract = {
  searchOrdersPage(
    input: SearchOrdersPageInput,
  ): Promise<SearchOrdersPageResult>;

  getOrder(input: GetOrderInput): Promise<GetOrderResult>;

  getOrderShipments(
    input: GetOrderShipmentsInput,
  ): Promise<Record<string, unknown>[]>;

  getShipment(input: GetShipmentInput): Promise<Record<string, unknown>>;
};

type MercadoLivreClientModule = {
  MercadoLivreClient: new (
    transport: MercadoLivreHttpTransport,
  ) => MercadoLivreClientContract;
};

type TransportMock = {
  request: jest.MockedFunction<MercadoLivreHttpTransport['request']>;
};

function createTransport(response: MercadoLivreHttpResponse): TransportMock {
  const request: jest.MockedFunction<MercadoLivreHttpTransport['request']> =
    jest.fn();

  request.mockResolvedValue(response);

  return {
    request,
  };
}

function createClient(
  transport: MercadoLivreHttpTransport,
): MercadoLivreClientContract {
  const module = jest.requireActual<MercadoLivreClientModule>(
    './mercado-livre.client',
  );

  return new module.MercadoLivreClient(transport);
}

function createSearchResponse(): MercadoLivreHttpResponse {
  return {
    status: 200,
    headers: {},
    body: {
      paging: {
        total: 2,
        offset: 0,
        limit: 50,
      },
      results: [
        {
          id: 200000000001,
          status: 'paid',
        },
        {
          id: 200000000002,
          status: 'cancelled',
        },
      ],
    },
  };
}

function createOrderBody(): Record<string, unknown> {
  return {
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
  };
}

describe('MercadoLivreClient', () => {
  it('uses GET /orders/search for order discovery', async () => {
    const transport = createTransport(createSearchResponse());
    const client = createClient(transport);

    await client.searchOrdersPage({
      accessToken: 'access-token',
      sellerId: 'seller-123',
    });

    expect(transport.request).toHaveBeenCalledTimes(1);
    expect(transport.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/orders/search',
      }),
    );
  });

  it('sends the Bearer access token when searching orders', async () => {
    const transport = createTransport(createSearchResponse());
    const client = createClient(transport);

    await client.searchOrdersPage({
      accessToken: 'access-token-123',
      sellerId: 'seller-123',
    });

    expect(transport.request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token-123',
        }),
      }),
    );
  });

  it('sends seller as the search owner', async () => {
    const transport = createTransport(createSearchResponse());
    const client = createClient(transport);

    await client.searchOrdersPage({
      accessToken: 'access-token',
      sellerId: 'seller-987',
    });

    expect(transport.request).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          seller: 'seller-987',
        }),
      }),
    );
  });

  it('preserves offset and limit when provided to search', async () => {
    const transport = createTransport(createSearchResponse());
    const client = createClient(transport);

    await client.searchOrdersPage({
      accessToken: 'access-token',
      sellerId: 'seller-123',
      offset: 100,
      limit: 50,
    });

    expect(transport.request).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          seller: 'seller-123',
          offset: 100,
          limit: 50,
        }),
      }),
    );
  });

  it('preserves the order.date_last_updated discovery window', async () => {
    const transport = createTransport(createSearchResponse());
    const client = createClient(transport);

    await client.searchOrdersPage({
      accessToken: 'access-token',
      sellerId: 'seller-123',
      updatedFrom: '2026-10-20T00:00:00.000-03:00',
      updatedTo: '2026-10-21T00:00:00.000-03:00',
    });

    expect(transport.request).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          seller: 'seller-123',
          'order.date_last_updated.from': '2026-10-20T00:00:00.000-03:00',
          'order.date_last_updated.to': '2026-10-21T00:00:00.000-03:00',
        }),
      }),
    );
  });

  it('returns paging and search results without normalizing orders', async () => {
    const paging = {
      total: 1,
      offset: 0,
      limit: 50,
    };

    const results = [
      {
        id: 200000000001,
        status: 'paid',
        date_last_updated: '2026-10-20T13:00:00.000Z',
        platform_specific_field: {
          untouched: true,
        },
      },
    ];

    const transport = createTransport({
      status: 200,
      headers: {},
      body: {
        paging,
        results,
      },
    });

    const client = createClient(transport);

    const result = await client.searchOrdersPage({
      accessToken: 'access-token',
      sellerId: 'seller-123',
    });

    expect(result.paging).toBe(paging);
    expect(result.results).toBe(results);
  });

  it('uses GET /orders/{orderId} for the authoritative order detail', async () => {
    const transport = createTransport({
      status: 200,
      headers: {},
      body: createOrderBody(),
    });

    const client = createClient(transport);

    await client.getOrder({
      accessToken: 'access-token',
      orderId: '200000000001',
    });

    expect(transport.request).toHaveBeenCalledTimes(1);
    expect(transport.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/orders/200000000001',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    );
  });

  it('accepts HTTP 200 from getOrder', async () => {
    const body = createOrderBody();

    const transport = createTransport({
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
      body,
    });

    const client = createClient(transport);

    const result = await client.getOrder({
      accessToken: 'access-token',
      orderId: '200000000001',
    });

    expect(result.status).toBe(200);
    expect(result.body).toBe(body);
  });

  it('accepts HTTP 206 and preserves X-Content-Missing', async () => {
    const body = {
      id: 200000000001,
      status: 'paid',
    };

    const transport = createTransport({
      status: 206,
      headers: {
        'X-Content-Missing': 'buyer,shipping',
      },
      body,
    });

    const client = createClient(transport);

    const result = await client.getOrder({
      accessToken: 'access-token',
      orderId: '200000000001',
    });

    expect(result.status).toBe(206);
    expect(result.headers['X-Content-Missing']).toBe('buyer,shipping');
    expect(result.body).toBe(body);
  });

  it('does not call search as fallback for a partial getOrder response', async () => {
    const body = {
      id: 200000000001,
      status: 'paid',
    };

    const transport = createTransport({
      status: 206,
      headers: {
        'X-Content-Missing': 'buyer',
      },
      body,
    });

    const client = createClient(transport);

    await client.getOrder({
      accessToken: 'access-token',
      orderId: '200000000001',
    });

    expect(transport.request).toHaveBeenCalledTimes(1);
    expect(transport.request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/orders/200000000001',
      }),
    );

    expect(transport.request).not.toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/orders/search',
      }),
    );
  });

  it('uses GET /orders/{orderId}/shipments for shipment references', async () => {
    const transport = createTransport({
      status: 200,
      headers: {},
      body: [
        {
          id: 7001,
          type: 'forward',
        },
      ],
    });

    const client = createClient(transport);

    await client.getOrderShipments({
      accessToken: 'access-token',
      orderId: '200000000001',
    });

    expect(transport.request).toHaveBeenCalledTimes(1);
    expect(transport.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/orders/200000000001/shipments',
      }),
    );
  });

  it('sends X-New-Domain true when requesting order shipments', async () => {
    const transport = createTransport({
      status: 200,
      headers: {},
      body: [],
    });

    const client = createClient(transport);

    await client.getOrderShipments({
      accessToken: 'access-token',
      orderId: '200000000001',
    });

    expect(transport.request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'X-New-Domain': 'true',
        }),
      }),
    );
  });

  it('preserves the collection of shipment references', async () => {
    const shipmentRefs = [
      {
        id: 7100,
        type: 'return',
      },
      {
        id: 7001,
        type: 'forward',
      },
      {
        id: 7200,
        type: 'return_to_buyer',
      },
    ];

    const transport = createTransport({
      status: 200,
      headers: {},
      body: shipmentRefs,
    });

    const client = createClient(transport);

    const result = await client.getOrderShipments({
      accessToken: 'access-token',
      orderId: '200000000001',
    });

    expect(result).toBe(shipmentRefs);
  });

  it('maps only HTTP 204 from order shipments to an empty collection', async () => {
    const transport = createTransport({
      status: 204,
      headers: {},
    });

    const client = createClient(transport);

    const result = await client.getOrderShipments({
      accessToken: 'access-token',
      orderId: '200000000001',
    });

    expect(result).toEqual([]);
  });

  it('does not select the first shipment or the forward shipment inside the client', async () => {
    const shipmentRefs = [
      {
        id: 7100,
        type: 'return',
      },
      {
        id: 7001,
        type: 'forward',
      },
    ];

    const transport = createTransport({
      status: 200,
      headers: {},
      body: shipmentRefs,
    });

    const client = createClient(transport);

    const result = await client.getOrderShipments({
      accessToken: 'access-token',
      orderId: '200000000001',
    });

    expect(result).toBe(shipmentRefs);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 7100,
      type: 'return',
    });
    expect(result[1]).toEqual({
      id: 7001,
      type: 'forward',
    });
  });

  it('uses x-format-new true when requesting shipment detail', async () => {
    const transport = createTransport({
      status: 200,
      headers: {},
      body: {
        id: 7001,
        status: 'shipped',
      },
    });

    const client = createClient(transport);

    await client.getShipment({
      accessToken: 'access-token',
      shipmentId: '7001',
    });

    expect(transport.request).toHaveBeenCalledTimes(1);
    expect(transport.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/shipments/7001',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'x-format-new': 'true',
        }),
      }),
    );
  });

  it('fails explicitly for an unexpected HTTP status', async () => {
    const transport = createTransport({
      status: 500,
      headers: {},
      body: {
        message: 'internal_error',
      },
    });

    const client = createClient(transport);

    await expect(
      client.getShipment({
        accessToken: 'access-token',
        shipmentId: '7001',
      }),
    ).rejects.toThrow();

    expect(transport.request).toHaveBeenCalledTimes(1);
  });

  it('does not retry or refresh credentials automatically after an HTTP failure', async () => {
    const transport = createTransport({
      status: 401,
      headers: {},
      body: {
        message: 'unauthorized',
      },
    });

    const client = createClient(transport);

    await expect(
      client.getOrder({
        accessToken: 'expired-access-token',
        orderId: '200000000001',
      }),
    ).rejects.toThrow();

    expect(transport.request).toHaveBeenCalledTimes(1);
    expect(transport.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/orders/200000000001',
        headers: expect.objectContaining({
          Authorization: 'Bearer expired-access-token',
        }),
      }),
    );
  });

  it('does not forward Marto business identities or account names to the HTTP contract', async () => {
    const transport = createTransport(createSearchResponse());
    const client = createClient(transport);

    const input = {
      accessToken: 'access-token',
      sellerId: 'seller-123',
      salesChannelId: 'channel-internal',
      merchantId: 'merchant-internal',
      accountName: 'pilot-account',
    } as SearchOrdersPageInput;

    await client.searchOrdersPage(input);

    expect(transport.request).toHaveBeenCalledTimes(1);
    expect(transport.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/orders/search',
      headers: {
        Authorization: 'Bearer access-token',
      },
      query: {
        seller: 'seller-123',
      },
    });
  });

  it('returns raw order data without normalization or persistence side effects', async () => {
    const body = {
      id: 200000000001,
      status: 'paid',
      unusual_external_field: {
        mustRemainUntouched: true,
      },
      order_items: [
        {
          item: {
            id: 'MLB1234567890',
          },
        },
      ],
    };

    const transport = createTransport({
      status: 200,
      headers: {},
      body,
    });

    const client = createClient(transport);

    const result = await client.getOrder({
      accessToken: 'access-token',
      orderId: '200000000001',
    });

    expect(result.body).toBe(body);
    expect(transport.request).toHaveBeenCalledTimes(1);
  });
});
