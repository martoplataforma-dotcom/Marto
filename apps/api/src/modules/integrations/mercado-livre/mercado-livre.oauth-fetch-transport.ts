import type {
  MercadoLivreOAuthHttpRequest,
  MercadoLivreOAuthHttpResponse,
  MercadoLivreOAuthHttpTransport,
} from './mercado-livre.oauth-client';

type MercadoLivreOAuthFetchHeaders = {
  forEach(
    callback: (
      value: string,
      name: string,
    ) => void,
  ): void;
};

type MercadoLivreOAuthFetchResponse = {
  status: number;
  headers: MercadoLivreOAuthFetchHeaders;
  text(): Promise<string>;
};

type MercadoLivreOAuthFetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export type MercadoLivreOAuthFetch = (
  url: string,
  init?: MercadoLivreOAuthFetchInit,
) => Promise<MercadoLivreOAuthFetchResponse>;

const DEFAULT_BASE_URL =
  'https://api.mercadolibre.com';

const TOKEN_PATH =
  '/oauth/token';

export class MercadoLivreOAuthFetchTransport
implements MercadoLivreOAuthHttpTransport {
  constructor(
    private readonly fetchImpl:
      MercadoLivreOAuthFetch =
        globalThis.fetch,

    private readonly baseUrl:
      string =
        DEFAULT_BASE_URL,
  ) {}

  async request(
    input:
      MercadoLivreOAuthHttpRequest,
  ): Promise<MercadoLivreOAuthHttpResponse> {
    this.assertTokenPath(
      input.path,
    );

    const url =
      new URL(
        input.path,
        this.baseUrl,
      );

    const form =
      new URLSearchParams();

    for (
      const [name, value]
      of Object.entries(
        input.form,
      )
    ) {
      form.set(
        name,
        value,
      );
    }

    const response =
      await this.fetchImpl(
        url.toString(),
        {
          method:
            input.method,

          headers:
            input.headers,

          body:
            form.toString(),
        },
      );

    const headers:
      Record<string, string> = {};

    response.headers.forEach(
      (
        value,
        name,
      ) => {
        headers[
          name.toLowerCase()
        ] =
          value;
      },
    );

    const responseText =
      await response.text();

    if (
      responseText === ''
    ) {
      return {
        status:
          response.status,

        headers,
      };
    }

    return {
      status:
        response.status,

      headers,

      body:
        this.parseBody(
          responseText,
        ),
    };
  }

  private assertTokenPath(
    path: string,
  ): void {
    if (
      path !== TOKEN_PATH
    ) {
      throw new Error(
        'Mercado Livre OAuth HTTP path must be exactly /oauth/token.',
      );
    }
  }

  private parseBody(
    responseText: string,
  ): unknown {
    try {
      return JSON.parse(
        responseText,
      ) as unknown;
    } catch {
      return responseText;
    }
  }
}