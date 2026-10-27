export type MercadoLivreHttpRequest = {
  method: 'GET';
  path: string;
  headers: Record<string, string>;
  query?: Record<string, string | number>;
};

export type MercadoLivreHttpResponse = {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
};

export type MercadoLivreHttpTransport = {
  request(input: MercadoLivreHttpRequest): Promise<MercadoLivreHttpResponse>;
};

export type SearchOrdersPageInput = {
  accessToken: string;
  sellerId: string;
  offset?: number;
  limit?: number;
  updatedFrom?: string;
  updatedTo?: string;
};

export type GetOrderInput = {
  accessToken: string;
  orderId: string;
};

export type GetOrderShipmentsInput = {
  accessToken: string;
  orderId: string;
};

export type GetShipmentInput = {
  accessToken: string;
  shipmentId: string;
};

export type SearchOrdersPageResult = {
  paging: unknown;
  results: unknown[];
};

export type GetOrderResult = {
  status: 200 | 206;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

export class MercadoLivreClient {
  constructor(private readonly transport: MercadoLivreHttpTransport) {}

  async searchOrdersPage(
    input: SearchOrdersPageInput,
  ): Promise<SearchOrdersPageResult> {
    const query: Record<string, string | number> = {
      seller: input.sellerId,
    };

    if (input.offset !== undefined) {
      query.offset = input.offset;
    }

    if (input.limit !== undefined) {
      query.limit = input.limit;
    }

    if (input.updatedFrom !== undefined) {
      query['order.date_last_updated.from'] = input.updatedFrom;
    }

    if (input.updatedTo !== undefined) {
      query['order.date_last_updated.to'] = input.updatedTo;
    }

    const response = await this.transport.request({
      method: 'GET',
      path: '/orders/search',
      headers: this.getAuthorizationHeaders(input.accessToken),
      query,
    });

    if (response.status !== 200) {
      throw this.createHttpError('search orders', response.status);
    }

    const body = this.requireObject(response.body, 'search orders');

    if (!Array.isArray(body.results)) {
      throw new Error(
        'Mercado Livre search orders returned an invalid results payload.',
      );
    }

    return {
      paging: body.paging,
      results: body.results,
    };
  }

  async getOrder(input: GetOrderInput): Promise<GetOrderResult> {
    const response = await this.transport.request({
      method: 'GET',
      path: `/orders/${input.orderId}`,
      headers: this.getAuthorizationHeaders(input.accessToken),
    });

    if (response.status !== 200 && response.status !== 206) {
      throw this.createHttpError('get order', response.status);
    }

    return {
      status: response.status,
      headers: response.headers ?? {},
      body: this.requireObject(response.body, 'get order'),
    };
  }

  async getOrderShipments(
    input: GetOrderShipmentsInput,
  ): Promise<Record<string, unknown>[]> {
    const response = await this.transport.request({
      method: 'GET',
      path: `/orders/${input.orderId}/shipments`,
      headers: this.getAuthorizationHeaders(input.accessToken, {
        'X-New-Domain': 'true',
      }),
    });

    if (response.status === 204) {
      return [];
    }

    if (response.status !== 200) {
      throw this.createHttpError('get order shipments', response.status);
    }

    if (!Array.isArray(response.body)) {
      throw new Error(
        'Mercado Livre order shipments returned an invalid collection.',
      );
    }

    return response.body as Record<string, unknown>[];
  }

  async getShipment(input: GetShipmentInput): Promise<Record<string, unknown>> {
    const response = await this.transport.request({
      method: 'GET',
      path: `/shipments/${input.shipmentId}`,
      headers: this.getAuthorizationHeaders(input.accessToken, {
        'x-format-new': 'true',
      }),
    });

    if (response.status !== 200) {
      throw this.createHttpError('get shipment', response.status);
    }

    return this.requireObject(response.body, 'get shipment');
  }

  private getAuthorizationHeaders(
    accessToken: string,
    additionalHeaders: Record<string, string> = {},
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      ...additionalHeaders,
    };
  }

  private requireObject(
    value: unknown,
    operation: string,
  ): Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(
        `Mercado Livre ${operation} returned an invalid object payload.`,
      );
    }

    return value as Record<string, unknown>;
  }

  private createHttpError(operation: string, status: number): Error {
    return new Error(`Mercado Livre ${operation} failed with HTTP ${status}.`);
  }
}
