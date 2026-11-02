export type MercadoLivreOAuthHttpRequest = {
  method: 'POST';
  path: string;
  headers: Record<string, string>;
  form: Record<string, string>;
};

export type MercadoLivreOAuthHttpResponse = {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
};

export type MercadoLivreOAuthHttpTransport = {
  request(
    input: MercadoLivreOAuthHttpRequest,
  ): Promise<MercadoLivreOAuthHttpResponse>;
};

export type ExchangeAuthorizationCodeInput = {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
};

export type RefreshAccessTokenInput = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export type MercadoLivreOAuthTokenResult = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  scope?: string;
  userId: string;
  refreshToken: string;
};

export class MercadoLivreOAuthHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly oauthCode?: string,
  ) {
    super(
      `Mercado Livre OAuth failed with HTTP ${status}.`,
    );

    this.name =
      'MercadoLivreOAuthHttpError';
  }
}

export class MercadoLivreOAuthClient {
  constructor(
    private readonly transport:
      MercadoLivreOAuthHttpTransport,
  ) {}

  async exchangeAuthorizationCode(
    input: ExchangeAuthorizationCodeInput,
  ): Promise<MercadoLivreOAuthTokenResult> {
    const form: Record<string, string> = {
      grant_type:
        'authorization_code',
      client_id:
        input.clientId,
      client_secret:
        input.clientSecret,
      code:
        input.code,
      redirect_uri:
        input.redirectUri,
    };

    if (input.codeVerifier !== undefined) {
      form.code_verifier =
        input.codeVerifier;
    }

    return await this.requestToken(form);
  }

  async refreshAccessToken(
    input: RefreshAccessTokenInput,
  ): Promise<MercadoLivreOAuthTokenResult> {
    return await this.requestToken({
      grant_type:
        'refresh_token',
      client_id:
        input.clientId,
      client_secret:
        input.clientSecret,
      refresh_token:
        input.refreshToken,
    });
  }

  private async requestToken(
    form: Record<string, string>,
  ): Promise<MercadoLivreOAuthTokenResult> {
    const response =
      await this.transport.request({
        method: 'POST',
        path: '/oauth/token',
        headers: {
          accept:
            'application/json',
          'content-type':
            'application/x-www-form-urlencoded',
        },
        form,
      });

    if (
      response.status < 200 ||
      response.status >= 300
    ) {
      throw new MercadoLivreOAuthHttpError(
        response.status,
        this.readOAuthErrorCode(
          response.body,
        ),
      );
    }

    return this.normalizeTokenResponse(
      response.body,
    );
  }

  private normalizeTokenResponse(
    body: unknown,
  ): MercadoLivreOAuthTokenResult {
    if (
      body === null ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      throw this.invalidTokenPayload();
    }

    const payload =
      body as Record<string, unknown>;

    const accessToken =
      payload.access_token;

    const tokenType =
      payload.token_type;

    const expiresIn =
      payload.expires_in;

    const scope =
      payload.scope;

    const userId =
      payload.user_id;

    const refreshToken =
      payload.refresh_token;

    if (
      !this.isNonBlankString(
        accessToken,
      ) ||
      !this.isNonBlankString(
        tokenType,
      ) ||
      typeof expiresIn !== 'number' ||
      !Number.isFinite(expiresIn) ||
      expiresIn <= 0 ||
      !this.isValidUserId(userId) ||
      !this.isNonBlankString(
        refreshToken,
      ) ||
      (
        scope !== undefined &&
        typeof scope !== 'string'
      )
    ) {
      throw this.invalidTokenPayload();
    }

    return {
      accessToken,
      tokenType,
      expiresIn,
      ...(scope !== undefined
        ? {
            scope,
          }
        : {}),
      userId:
        String(userId),
      refreshToken,
    };
  }

  private readOAuthErrorCode(
    body: unknown,
  ): string | undefined {
    if (
      body === null ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      return undefined;
    }

    const errorCode =
      (
        body as Record<string, unknown>
      ).error;

    if (
      typeof errorCode !== 'string' ||
      errorCode.trim() === ''
    ) {
      return undefined;
    }

    return errorCode;
  }

  private isNonBlankString(
    value: unknown,
  ): value is string {
    return (
      typeof value === 'string' &&
      value.trim() !== ''
    );
  }

  private isValidUserId(
    value: unknown,
  ): value is string | number {
    if (
      typeof value === 'string'
    ) {
      return value.trim() !== '';
    }

    return (
      typeof value === 'number' &&
      Number.isFinite(value)
    );
  }

  private invalidTokenPayload(): Error {
    return new Error(
      'Mercado Livre OAuth returned an invalid token payload.',
    );
  }
}
