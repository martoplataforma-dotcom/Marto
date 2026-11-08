export type MercadoLivreAuthorizationMode =
  | 'CONNECT'
  | 'RECONNECT';

export type MercadoLivreBeginAuthorizationInput = {
  initiatorUserId: string;
  merchantId: string;
  mode: MercadoLivreAuthorizationMode;
  salesChannelId?: string;
};

export type MercadoLivreCompleteAuthorizationInput = {
  state: string;
  code: string;
};

export type MercadoLivreAuthorizationIntent = {
  state: string;
  initiatorUserId: string;
  merchantId: string;
  mode: MercadoLivreAuthorizationMode;
  salesChannelId?: string;
  expectedExternalAccountId?: string;
  codeVerifier?: string;
  expiresAt: Date;
};

export type MercadoLivreAuthorizationTargetContext = {
  initiatorUserId: string;
  merchantId: string;
  mode: MercadoLivreAuthorizationMode;
  salesChannelId?: string;
  expectedExternalAccountId?: string;
};

export type MercadoLivreRevalidateReconnectInput = {
  initiatorUserId: string;
  merchantId: string;
  salesChannelId: string;
  expectedExternalAccountId: string;
};

export type MercadoLivreOAuthTokenResult = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  scope?: string;
  userId: string;
  refreshToken: string;
};

export type MercadoLivreExchangeAuthorizationCodeInput = {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
};

export type MercadoLivreAuthorizationResult = {
  initiatorUserId: string;
  merchantId: string;
  mode: MercadoLivreAuthorizationMode;
  salesChannelId?: string;
  authorizedExternalAccountId: string;
  token: MercadoLivreOAuthTokenResult;
};

export type MercadoLivreAuthorizationStateGenerator = {
  generate(): string;
};

export type MercadoLivreAuthorizationStateStore = {
  save(
    intent: MercadoLivreAuthorizationIntent,
  ): Promise<void>;

  consume(
    state: string,
  ): Promise<
    MercadoLivreAuthorizationIntent | undefined
  >;
};

export type MercadoLivrePkceGenerator = {
  generate(): {
    codeVerifier: string;
    codeChallenge: string;
  };
};

export type MercadoLivreAuthorizationTargetPort = {
  resolveForBegin(
    input: MercadoLivreBeginAuthorizationInput,
  ): Promise<MercadoLivreAuthorizationTargetContext>;

  revalidateReconnect(
    input: MercadoLivreRevalidateReconnectInput,
  ): Promise<void>;
};

export type MercadoLivreOAuthClientPort = {
  exchangeAuthorizationCode(
    input: MercadoLivreExchangeAuthorizationCodeInput,
  ): Promise<MercadoLivreOAuthTokenResult>;
};

export type MercadoLivreAuthorizationClock = {
  now(): Date;
};

export type MercadoLivreAuthorizationConfig = {
  authorizationUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  stateTtlMs: number;
  pkceEnabled: boolean;
};

export type MercadoLivreAuthorizationDependencies = {
  stateGenerator:
    MercadoLivreAuthorizationStateGenerator;
  stateStore:
    MercadoLivreAuthorizationStateStore;
  pkceGenerator:
    MercadoLivrePkceGenerator;
  target:
    MercadoLivreAuthorizationTargetPort;
  oauthClient:
    MercadoLivreOAuthClientPort;
  clock:
    MercadoLivreAuthorizationClock;
  config:
    MercadoLivreAuthorizationConfig;
};

export type MercadoLivreBeginAuthorizationResult = {
  state: string;
  authorizationUrl: string;
};

export type MercadoLivreAuthorizationFlowErrorCode =
  | 'authorization_input_invalid'
  | 'authorization_state_invalid'
  | 'authorization_state_expired'
  | 'authorization_target_invalid'
  | 'authorization_identity_mismatch';

const ERROR_MESSAGES:
  Record<
    MercadoLivreAuthorizationFlowErrorCode,
    string
  > = {
    authorization_input_invalid:
      'Mercado Livre authorization input is invalid.',
    authorization_state_invalid:
      'Mercado Livre authorization state is invalid.',
    authorization_state_expired:
      'Mercado Livre authorization state has expired.',
    authorization_target_invalid:
      'Mercado Livre authorization target is invalid.',
    authorization_identity_mismatch:
      'Mercado Livre authorization identity does not match the expected account.',
  };

export class MercadoLivreAuthorizationFlowError
  extends Error {
  readonly code:
    MercadoLivreAuthorizationFlowErrorCode;

  constructor(
    code:
      MercadoLivreAuthorizationFlowErrorCode,
  ) {
    super(ERROR_MESSAGES[code]);

    this.name =
      'MercadoLivreAuthorizationFlowError';

    this.code =
      code;
  }
}

function isNonBlankString(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0
  );
}

function isValidDate(
  value: Date,
): boolean {
  return (
    value instanceof Date &&
    Number.isFinite(
      value.getTime(),
    )
  );
}

export class MercadoLivreAuthorizationFlow {
  constructor(
    private readonly dependencies:
      MercadoLivreAuthorizationDependencies,
  ) {}

  async beginAuthorization(
    input:
      MercadoLivreBeginAuthorizationInput,
  ): Promise<MercadoLivreBeginAuthorizationResult> {
    this.validateBeginInput(input);

    const target =
      await this.dependencies.target
        .resolveForBegin(input);

    this.validateTargetForBegin(
      input,
      target,
    );

    const state =
      this.dependencies.stateGenerator
        .generate();

    if (!isNonBlankString(state)) {
      throw new MercadoLivreAuthorizationFlowError(
        'authorization_state_invalid',
      );
    }

    const now =
      this.dependencies.clock.now();

    const ttl =
      this.dependencies.config
        .stateTtlMs;

    if (
      !isValidDate(now) ||
      !Number.isFinite(ttl) ||
      ttl <= 0
    ) {
      throw new MercadoLivreAuthorizationFlowError(
        'authorization_input_invalid',
      );
    }

    let codeVerifier:
      string | undefined;

    let codeChallenge:
      string | undefined;

    if (
      this.dependencies.config
        .pkceEnabled
    ) {
      const pkce =
        this.dependencies.pkceGenerator
          .generate();

      if (
        !isNonBlankString(
          pkce.codeVerifier,
        ) ||
        !isNonBlankString(
          pkce.codeChallenge,
        )
      ) {
        throw new MercadoLivreAuthorizationFlowError(
          'authorization_input_invalid',
        );
      }

      codeVerifier =
        pkce.codeVerifier;

      codeChallenge =
        pkce.codeChallenge;
    }

    const intent:
      MercadoLivreAuthorizationIntent = {
        state,
        initiatorUserId:
          target.initiatorUserId,
        merchantId:
          target.merchantId,
        mode:
          target.mode,
        expiresAt:
          new Date(
            now.getTime() +
            ttl,
          ),
      };

    if (
      target.mode ===
      'RECONNECT'
    ) {
      intent.salesChannelId =
        target.salesChannelId;

      intent.expectedExternalAccountId =
        target.expectedExternalAccountId;
    }

    if (codeVerifier !== undefined) {
      intent.codeVerifier =
        codeVerifier;
    }

    await this.dependencies.stateStore
      .save(intent);

    const authorizationUrl =
      new URL(
        this.dependencies.config
          .authorizationUrl,
      );

    authorizationUrl.searchParams.set(
      'response_type',
      'code',
    );

    authorizationUrl.searchParams.set(
      'client_id',
      this.dependencies.config
        .clientId,
    );

    authorizationUrl.searchParams.set(
      'redirect_uri',
      this.dependencies.config
        .redirectUri,
    );

    authorizationUrl.searchParams.set(
      'state',
      state,
    );

    if (
      codeChallenge !== undefined
    ) {
      authorizationUrl.searchParams.set(
        'code_challenge',
        codeChallenge,
      );

      authorizationUrl.searchParams.set(
        'code_challenge_method',
        'S256',
      );
    }

    return {
      state,
      authorizationUrl:
        authorizationUrl.toString(),
    };
  }

  async completeAuthorization(
    input:
      MercadoLivreCompleteAuthorizationInput,
  ): Promise<MercadoLivreAuthorizationResult> {
    if (
      !isNonBlankString(
        input?.state,
      ) ||
      !isNonBlankString(
        input?.code,
      )
    ) {
      throw new MercadoLivreAuthorizationFlowError(
        'authorization_input_invalid',
      );
    }

    const intent =
      await this.dependencies.stateStore
        .consume(input.state);

    if (
      intent === undefined ||
      intent.state !== input.state
    ) {
      throw new MercadoLivreAuthorizationFlowError(
        'authorization_state_invalid',
      );
    }

    const now =
      this.dependencies.clock.now();

    if (
      !isValidDate(now) ||
      !isValidDate(
        intent.expiresAt,
      )
    ) {
      throw new MercadoLivreAuthorizationFlowError(
        'authorization_state_invalid',
      );
    }

    if (
      now.getTime() >=
      intent.expiresAt.getTime()
    ) {
      throw new MercadoLivreAuthorizationFlowError(
        'authorization_state_expired',
      );
    }

    this.validateConsumedIntent(
      intent,
    );

    if (
      intent.mode ===
      'RECONNECT'
    ) {
      await this.dependencies.target
        .revalidateReconnect({
          initiatorUserId:
            intent.initiatorUserId,
          merchantId:
            intent.merchantId,
          salesChannelId:
            intent.salesChannelId!,
          expectedExternalAccountId:
            intent.expectedExternalAccountId!,
        });
    }

    const exchangeInput:
      MercadoLivreExchangeAuthorizationCodeInput = {
        clientId:
          this.dependencies.config
            .clientId,
        clientSecret:
          this.dependencies.config
            .clientSecret,
        code:
          input.code,
        redirectUri:
          this.dependencies.config
            .redirectUri,
      };

    if (
      isNonBlankString(
        intent.codeVerifier,
      )
    ) {
      exchangeInput.codeVerifier =
        intent.codeVerifier;
    }

    const token =
      await this.dependencies.oauthClient
        .exchangeAuthorizationCode(
          exchangeInput,
        );

    if (
      !isNonBlankString(
        token.userId,
      )
    ) {
      throw new MercadoLivreAuthorizationFlowError(
        'authorization_identity_mismatch',
      );
    }

    if (
      intent.mode ===
        'RECONNECT' &&
      token.userId !==
        intent.expectedExternalAccountId
    ) {
      throw new MercadoLivreAuthorizationFlowError(
        'authorization_identity_mismatch',
      );
    }

    const result:
      MercadoLivreAuthorizationResult = {
        initiatorUserId:
          intent.initiatorUserId,
        merchantId:
          intent.merchantId,
        mode:
          intent.mode,
        authorizedExternalAccountId:
          token.userId,
        token,
      };

    if (
      intent.mode ===
      'RECONNECT'
    ) {
      result.salesChannelId =
        intent.salesChannelId;
    }

    return result;
  }

  private validateBeginInput(
    input:
      MercadoLivreBeginAuthorizationInput,
  ): void {
    if (
      !input ||
      !isNonBlankString(
        input.initiatorUserId,
      ) ||
      !isNonBlankString(
        input.merchantId,
      ) ||
      (
        input.mode !==
          'CONNECT' &&
        input.mode !==
          'RECONNECT'
      )
    ) {
      throw new MercadoLivreAuthorizationFlowError(
        'authorization_input_invalid',
      );
    }

    if (
      input.mode ===
        'RECONNECT' &&
      !isNonBlankString(
        input.salesChannelId,
      )
    ) {
      throw new MercadoLivreAuthorizationFlowError(
        'authorization_input_invalid',
      );
    }
  }

  private validateTargetForBegin(
    input:
      MercadoLivreBeginAuthorizationInput,
    target:
      MercadoLivreAuthorizationTargetContext,
  ): void {
    if (
      !target ||
      target.mode !== input.mode ||
      !isNonBlankString(
        target.initiatorUserId,
      ) ||
      target.initiatorUserId !==
        input.initiatorUserId ||
      !isNonBlankString(
        target.merchantId,
      ) ||
      target.merchantId !==
        input.merchantId
    ) {
      throw new MercadoLivreAuthorizationFlowError(
        'authorization_target_invalid',
      );
    }

    if (
      target.mode ===
      'RECONNECT' &&
      (
        !isNonBlankString(
          target.salesChannelId,
        ) ||
        target.salesChannelId !==
          input.salesChannelId ||
        !isNonBlankString(
          target.expectedExternalAccountId,
        )
      )
    ) {
      throw new MercadoLivreAuthorizationFlowError(
        'authorization_target_invalid',
      );
    }
  }

  private validateConsumedIntent(
    intent:
      MercadoLivreAuthorizationIntent,
  ): void {
    if (
      !isNonBlankString(
        intent.initiatorUserId,
      ) ||
      !isNonBlankString(
        intent.merchantId,
      ) ||
      (
        intent.mode !==
          'CONNECT' &&
        intent.mode !==
          'RECONNECT'
      )
    ) {
      throw new MercadoLivreAuthorizationFlowError(
        'authorization_state_invalid',
      );
    }

    if (
      intent.mode ===
      'RECONNECT' &&
      (
        !isNonBlankString(
          intent.salesChannelId,
        ) ||
        !isNonBlankString(
          intent.expectedExternalAccountId,
        )
      )
    ) {
      throw new MercadoLivreAuthorizationFlowError(
        'authorization_state_invalid',
      );
    }
  }
}
