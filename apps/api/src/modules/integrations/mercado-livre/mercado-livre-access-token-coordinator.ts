export type MercadoLivreCredentialStatus =
  | 'ACTIVE'
  | 'REFRESHING'
  | 'TRANSIENT_ERROR'
  | 'ROTATION_UNCERTAIN'
  | 'REAUTH_REQUIRED';

export type MercadoLivreSalesChannelType =
  | 'MERCADO_LIVRE'
  | 'SHOPEE'
  | 'SITE'
  | string;

export type MercadoLivreSalesChannelStatus =
  | 'ACTIVE'
  | 'DISCONNECTED'
  | 'PAUSED'
  | 'ERROR'
  | string;

export type MercadoLivreCredentialSnapshot = {
  salesChannelId: string;
  salesChannelType:
    MercadoLivreSalesChannelType;
  salesChannelStatus:
    MercadoLivreSalesChannelStatus;

  externalAccountId: string;

  credentialStatus:
    MercadoLivreCredentialStatus;

  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  encryptionKeyVersion: string;

  tokenType?: string;
  scope?: string;

  accessTokenExpiresAt: Date;

  authorizedExternalAccountId:
    string;

  tokenGeneration: number;

  refreshAttemptId?: string;
  refreshStartedAt?: Date;

  lastErrorCode?: string;
  lastErrorAt?: Date;
};

export type MercadoLivreRefreshClaimInput = {
  salesChannelId: string;
  expectedTokenGeneration: number;

  expectedStatus:
    | 'ACTIVE'
    | 'TRANSIENT_ERROR';

  refreshAttemptId: string;
  refreshStartedAt: Date;
};

export type MercadoLivreRefreshClaimResult = {
  claimed: boolean;

  current?:
    MercadoLivreCredentialSnapshot;
};

export type MercadoLivreCompleteRefreshInput = {
  salesChannelId: string;
  expectedTokenGeneration: number;
  refreshAttemptId: string;

  status:
    'ACTIVE';

  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  encryptionKeyVersion: string;

  tokenType: string;
  scope?: string;

  accessTokenExpiresAt: Date;

  authorizedExternalAccountId:
    string;

  newTokenGeneration: number;

  refreshAttemptIdAfterCommit:
    null;

  refreshStartedAtAfterCommit:
    null;

  lastRotatedAt: Date;

  lastErrorCodeAfterCommit:
    null;

  lastErrorAtAfterCommit:
    null;
};

export type MercadoLivreFailRefreshInput = {
  salesChannelId: string;
  expectedTokenGeneration: number;
  refreshAttemptId: string;

  expectedRefreshStartedAt?:
    Date;

  targetStatus:
    | 'TRANSIENT_ERROR'
    | 'ROTATION_UNCERTAIN'
    | 'REAUTH_REQUIRED';

  lastErrorCode: string;
  errorAt: Date;
};

export type MercadoLivreRefreshMutationResult = {
  committed: boolean;

  current?:
    MercadoLivreCredentialSnapshot;
};

export type MercadoLivreCredentialStorePort = {
  load(
    salesChannelId: string,
  ): Promise<
    MercadoLivreCredentialSnapshot | undefined
  >;

  tryClaimRefresh(
    input:
      MercadoLivreRefreshClaimInput,
  ): Promise<
    MercadoLivreRefreshClaimResult
  >;

  completeRefresh(
    input:
      MercadoLivreCompleteRefreshInput,
  ): Promise<
    MercadoLivreRefreshMutationResult
  >;

  failRefresh(
    input:
      MercadoLivreFailRefreshInput,
  ): Promise<
    MercadoLivreRefreshMutationResult
  >;
};

export type MercadoLivreCredentialDecryptInput = {
  encryptedValue: string;
  keyVersion: string;
};

export type MercadoLivreCredentialEncryptResult = {
  encryptedValue: string;
  keyVersion: string;
};

export type SalesChannelCredentialCryptoPort = {
  decrypt(
    input:
      MercadoLivreCredentialDecryptInput,
  ): string;

  encrypt(
    plaintext: string,
  ): MercadoLivreCredentialEncryptResult;
};

export type MercadoLivreRefreshAccessTokenInput = {
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

export type MercadoLivreOAuthRefreshClientPort = {
  refreshAccessToken(
    input:
      MercadoLivreRefreshAccessTokenInput,
  ): Promise<
    MercadoLivreOAuthTokenResult
  >;
};

export type MercadoLivreCredentialClock = {
  now(): Date;
};

export type MercadoLivreRefreshAttemptIdGenerator = {
  generate(): string;
};

export type MercadoLivreAccessTokenCoordinatorConfig = {
  clientId: string;
  clientSecret: string;
  refreshSafetyWindowMs: number;
  transientRetryDelayMs: number;
  refreshStaleAfterMs: number;
};

export type MercadoLivreAccessTokenCoordinatorDependencies = {
  store:
    MercadoLivreCredentialStorePort;

  crypto:
    SalesChannelCredentialCryptoPort;

  oauthClient:
    MercadoLivreOAuthRefreshClientPort;

  clock:
    MercadoLivreCredentialClock;

  refreshAttemptIdGenerator:
    MercadoLivreRefreshAttemptIdGenerator;

  config:
    MercadoLivreAccessTokenCoordinatorConfig;
};

export type MercadoLivreGetAccessTokenInput = {
  salesChannelId: string;
};

export type MercadoLivreAccessTokenResult = {
  accessToken: string;
  tokenType?: string;
  accessTokenExpiresAt: Date;

  authorizedExternalAccountId:
    string;

  tokenGeneration: number;

  source:
    | 'CACHED'
    | 'REFRESHED';
};

export type MercadoLivreAccessTokenCoordinatorErrorCode =
  | 'credential_input_invalid'
  | 'credential_not_found'
  | 'credential_channel_unavailable'
  | 'credential_identity_mismatch'
  | 'credential_state_invalid'
  | 'credential_crypto_unavailable'
  | 'credential_refresh_in_progress'
  | 'credential_refresh_backoff'
  | 'credential_refresh_conflict'
  | 'credential_refresh_failed'
  | 'credential_rotation_uncertain'
  | 'credential_reauth_required';

export class MercadoLivreAccessTokenCoordinatorError
  extends Error {
  constructor(
    public readonly code:
      MercadoLivreAccessTokenCoordinatorErrorCode,
  ) {
    super(code);

    this.name =
      'MercadoLivreAccessTokenCoordinatorError';
  }
}

export class MercadoLivreAccessTokenCoordinator {
  constructor(
    private readonly dependencies:
      MercadoLivreAccessTokenCoordinatorDependencies,
  ) {
    this.validateConfig();
  }

  async getAccessToken(
    input:
      MercadoLivreGetAccessTokenInput,
  ): Promise<
    MercadoLivreAccessTokenResult
  > {
    if (
      !input ||
      !this.isNonBlankString(
        input.salesChannelId,
      )
    ) {
      throw this.error(
        'credential_input_invalid',
      );
    }

    const current =
      await this.dependencies.store.load(
        input.salesChannelId,
      );

    if (!current) {
      throw this.error(
        'credential_not_found',
      );
    }

    this.validateSnapshot(
      current,
      input.salesChannelId,
    );

    const now =
      this.readNow();

    return await this.resolveInitialSnapshot(
      current,
      now,
    );
  }

  private async resolveInitialSnapshot(
    current:
      MercadoLivreCredentialSnapshot,

    now:
      Date,
  ): Promise<
    MercadoLivreAccessTokenResult
  > {
    if (
      current.credentialStatus ===
      'REAUTH_REQUIRED'
    ) {
      throw this.error(
        'credential_reauth_required',
      );
    }

    if (
      current.credentialStatus ===
      'ROTATION_UNCERTAIN'
    ) {
      throw this.error(
        'credential_rotation_uncertain',
      );
    }

    if (
      current.credentialStatus ===
      'REFRESHING'
    ) {
      return await this.handleRefreshing(
        current,
        now,
      );
    }

    if (
      current.credentialStatus !==
        'ACTIVE' &&
      current.credentialStatus !==
        'TRANSIENT_ERROR'
    ) {
      throw this.error(
        'credential_state_invalid',
      );
    }

    if (
      this.isAccessTokenUsable(
        current,
        now,
      )
    ) {
      return this.cachedResult(
        current,
      );
    }

    if (
      current.credentialStatus ===
      'TRANSIENT_ERROR'
    ) {
      this.assertTransientRetryAllowed(
        current,
        now,
      );
    }

    return await this.refreshClaimedGeneration(
      current,
      now,
    );
  }

  private async handleRefreshing(
    current:
      MercadoLivreCredentialSnapshot,

    now:
      Date,
  ): Promise<
    MercadoLivreAccessTokenResult
  > {
    if (
      !this.isNonBlankString(
        current.refreshAttemptId,
      ) ||
      !this.isValidDate(
        current.refreshStartedAt,
      )
    ) {
      throw this.error(
        'credential_state_invalid',
      );
    }

    const staleAt =
      current.refreshStartedAt.getTime() +
      this.dependencies.config
        .refreshStaleAfterMs;

    if (
      now.getTime() <
      staleAt
    ) {
      throw this.error(
        'credential_refresh_in_progress',
      );
    }

    await this.transitionOrConflict({
      snapshot:
        current,

      refreshAttemptId:
        current.refreshAttemptId,

      targetStatus:
        'ROTATION_UNCERTAIN',

      lastErrorCode:
        'credential_refresh_stale',

      errorAt:
        now,

      expectedRefreshStartedAt:
        current.refreshStartedAt,
    });

    throw this.error(
      'credential_rotation_uncertain',
    );
  }

  private async refreshClaimedGeneration(
    current:
      MercadoLivreCredentialSnapshot,

    startedAt:
      Date,
  ): Promise<
    MercadoLivreAccessTokenResult
  > {
    const refreshAttemptId =
      this.dependencies
        .refreshAttemptIdGenerator
        .generate();

    if (
      !this.isNonBlankString(
        refreshAttemptId,
      )
    ) {
      throw this.error(
        'credential_state_invalid',
      );
    }

    const expectedStatus =
      current.credentialStatus;

    if (
      expectedStatus !== 'ACTIVE' &&
      expectedStatus !== 'TRANSIENT_ERROR'
    ) {
      throw this.error(
        'credential_state_invalid',
      );
    }

    let claim:
      MercadoLivreRefreshClaimResult;

    try {
      claim =
        await this.dependencies.store
          .tryClaimRefresh({
            salesChannelId:
              current.salesChannelId,

            expectedTokenGeneration:
              current.tokenGeneration,

            expectedStatus,

            refreshAttemptId,

            refreshStartedAt:
              startedAt,
          });
    } catch {
      throw this.error(
        'credential_refresh_conflict',
      );
    }

    if (!claim.claimed) {
      return await this.resolveLostClaim(
        current,
        claim.current,
        startedAt,
      );
    }

    let refreshToken:
      string;

    try {
      refreshToken =
        this.dependencies.crypto.decrypt({
          encryptedValue:
            current
              .refreshTokenEncrypted,

          keyVersion:
            current
              .encryptionKeyVersion,
        });

      if (
        !this.isNonBlankString(
          refreshToken,
        )
      ) {
        throw new Error(
          'invalid_plaintext',
        );
      }
    } catch {
      await this.transitionOrConflict({
        snapshot:
          current,

        refreshAttemptId,

        targetStatus:
          'TRANSIENT_ERROR',

        lastErrorCode:
          'credential_decryption_failed',

        errorAt:
          this.readNow(),
      });

      throw this.error(
        'credential_crypto_unavailable',
      );
    }

    let token:
      MercadoLivreOAuthTokenResult;

    try {
      token =
        await this.dependencies
          .oauthClient
          .refreshAccessToken({
            clientId:
              this.dependencies
                .config
                .clientId,

            clientSecret:
              this.dependencies
                .config
                .clientSecret,

            refreshToken,
          });
    } catch (error) {
      await this.handleOAuthFailure(
        current,
        refreshAttemptId,
        error,
      );
    }

    const responseReceivedAt =
      this.readNow();

    if (
      !this.isValidOAuthTokenResult(
        token!,
      )
    ) {
      await this.markRotationUncertain(
        current,
        refreshAttemptId,
        'oauth_token_payload_invalid',
        responseReceivedAt,
      );

      throw this.error(
        'credential_rotation_uncertain',
      );
    }

    if (
      token!.userId !==
        current
          .authorizedExternalAccountId ||
      token!.userId !==
        current.externalAccountId
    ) {
      await this.transitionOrConflict({
        snapshot:
          current,

        refreshAttemptId,

        targetStatus:
          'REAUTH_REQUIRED',

        lastErrorCode:
          'credential_identity_mismatch',

        errorAt:
          responseReceivedAt,
      });

      throw this.error(
        'credential_identity_mismatch',
      );
    }

    let encryptedAccess:
      MercadoLivreCredentialEncryptResult;

    let encryptedRefresh:
      MercadoLivreCredentialEncryptResult;

    try {
      encryptedAccess =
        this.dependencies.crypto.encrypt(
          token!.accessToken,
        );

      encryptedRefresh =
        this.dependencies.crypto.encrypt(
          token!.refreshToken,
        );

      if (
        !this.isValidEncryptedResult(
          encryptedAccess,
        ) ||
        !this.isValidEncryptedResult(
          encryptedRefresh,
        ) ||
        encryptedAccess.keyVersion !==
          encryptedRefresh.keyVersion
      ) {
        throw new Error(
          'invalid_encryption_result',
        );
      }
    } catch {
      await this.markRotationUncertain(
        current,
        refreshAttemptId,
        'credential_encryption_failed',
        responseReceivedAt,
      );

      throw this.error(
        'credential_rotation_uncertain',
      );
    }

    const expirationMs =
      responseReceivedAt.getTime() +
      token!.expiresIn *
      1000;

    if (
      !Number.isFinite(
        expirationMs,
      )
    ) {
      await this.markRotationUncertain(
        current,
        refreshAttemptId,
        'credential_expiration_invalid',
        responseReceivedAt,
      );

      throw this.error(
        'credential_rotation_uncertain',
      );
    }

    const accessTokenExpiresAt =
      new Date(
        expirationMs,
      );

    let completion:
      MercadoLivreRefreshMutationResult;

    try {
      completion =
        await this.dependencies.store
          .completeRefresh({
            salesChannelId:
              current.salesChannelId,

            expectedTokenGeneration:
              current.tokenGeneration,

            refreshAttemptId,

            status:
              'ACTIVE',

            accessTokenEncrypted:
              encryptedAccess
                .encryptedValue,

            refreshTokenEncrypted:
              encryptedRefresh
                .encryptedValue,

            encryptionKeyVersion:
              encryptedAccess
                .keyVersion,

            tokenType:
              token!.tokenType,

            ...(
              token!.scope !== undefined
                ? {
                    scope:
                      token!.scope,
                  }
                : {}
            ),

            accessTokenExpiresAt,

            authorizedExternalAccountId:
              current
                .authorizedExternalAccountId,

            newTokenGeneration:
              current.tokenGeneration +
              1,

            refreshAttemptIdAfterCommit:
              null,

            refreshStartedAtAfterCommit:
              null,

            lastRotatedAt:
              responseReceivedAt,

            lastErrorCodeAfterCommit:
              null,

            lastErrorAtAfterCommit:
              null,
          });
    } catch {
      await this.markRotationUncertain(
        current,
        refreshAttemptId,
        'credential_rotation_commit_failed',
        responseReceivedAt,
      );

      throw this.error(
        'credential_rotation_uncertain',
      );
    }

    if (!completion.committed) {
      await this.markRotationUncertain(
        current,
        refreshAttemptId,
        'credential_rotation_commit_conflict',
        responseReceivedAt,
      );

      throw this.error(
        'credential_rotation_uncertain',
      );
    }

    return {
      accessToken:
        token!.accessToken,

      tokenType:
        token!.tokenType,

      accessTokenExpiresAt,

      authorizedExternalAccountId:
        current
          .authorizedExternalAccountId,

      tokenGeneration:
        current.tokenGeneration +
        1,

      source:
        'REFRESHED',
    };
  }

  private async resolveLostClaim(
    claimedSnapshot:
      MercadoLivreCredentialSnapshot,

    current:
      MercadoLivreCredentialSnapshot |
      undefined,

    now:
      Date,
  ): Promise<
    MercadoLivreAccessTokenResult
  > {
    if (!current) {
      throw this.error(
        'credential_refresh_conflict',
      );
    }

    if (
      current.salesChannelId !==
      claimedSnapshot.salesChannelId
    ) {
      throw this.error(
        'credential_refresh_conflict',
      );
    }

    this.validateSnapshot(
      current,
      claimedSnapshot.salesChannelId,
    );

    if (
      current.externalAccountId !==
        claimedSnapshot.externalAccountId ||
      current.authorizedExternalAccountId !==
        claimedSnapshot
          .authorizedExternalAccountId
    ) {
      throw this.error(
        'credential_identity_mismatch',
      );
    }

    if (
      current.tokenGeneration <
      claimedSnapshot.tokenGeneration
    ) {
      throw this.error(
        'credential_refresh_conflict',
      );
    }

    if (
      current.credentialStatus ===
      'REAUTH_REQUIRED'
    ) {
      throw this.error(
        'credential_reauth_required',
      );
    }

    if (
      current.credentialStatus ===
      'ROTATION_UNCERTAIN'
    ) {
      throw this.error(
        'credential_rotation_uncertain',
      );
    }

    if (
      current.credentialStatus ===
      'REFRESHING'
    ) {
      return await this.handleRefreshing(
        current,
        now,
      );
    }

    if (
      current.credentialStatus ===
        'ACTIVE' ||
      current.credentialStatus ===
        'TRANSIENT_ERROR'
    ) {
      if (
        current.tokenGeneration <=
        claimedSnapshot.tokenGeneration
      ) {
        throw this.error(
          'credential_refresh_conflict',
        );
      }

      if (
        this.isAccessTokenUsable(
          current,
          now,
        )
      ) {
        return this.cachedResult(
          current,
        );
      }

      if (
        current.credentialStatus ===
        'TRANSIENT_ERROR'
      ) {
        if (
          !this.isValidDate(
            current.lastErrorAt,
          )
        ) {
          throw this.error(
            'credential_state_invalid',
          );
        }

        const retryAt =
          current.lastErrorAt.getTime() +
          this.dependencies.config
            .transientRetryDelayMs;

        if (
          now.getTime() <
          retryAt
        ) {
          throw this.error(
            'credential_refresh_backoff',
          );
        }
      }

      throw this.error(
        'credential_refresh_conflict',
      );
    }

    throw this.error(
      'credential_state_invalid',
    );
  }

  private cachedResult(
    current:
      MercadoLivreCredentialSnapshot,
  ): MercadoLivreAccessTokenResult {
    let accessToken:
      string;

    try {
      accessToken =
        this.dependencies.crypto.decrypt({
          encryptedValue:
            current
              .accessTokenEncrypted,

          keyVersion:
            current
              .encryptionKeyVersion,
        });

      if (
        !this.isNonBlankString(
          accessToken,
        )
      ) {
        throw new Error(
          'invalid_plaintext',
        );
      }
    } catch {
      throw this.error(
        'credential_crypto_unavailable',
      );
    }

    return {
      accessToken,

      ...(
        current.tokenType !== undefined
          ? {
              tokenType:
                current.tokenType,
            }
          : {}
      ),

      accessTokenExpiresAt:
        new Date(
          current
            .accessTokenExpiresAt,
        ),

      authorizedExternalAccountId:
        current
          .authorizedExternalAccountId,

      tokenGeneration:
        current.tokenGeneration,

      source:
        'CACHED',
    };
  }

  private assertTransientRetryAllowed(
    current:
      MercadoLivreCredentialSnapshot,

    now:
      Date,
  ): void {
    if (
      !this.isValidDate(
        current.lastErrorAt,
      )
    ) {
      throw this.error(
        'credential_state_invalid',
      );
    }

    const retryAt =
      current.lastErrorAt.getTime() +
      this.dependencies.config
        .transientRetryDelayMs;

    if (
      now.getTime() <
      retryAt
    ) {
      throw this.error(
        'credential_refresh_backoff',
      );
    }
  }

  private isAccessTokenUsable(
    current:
      MercadoLivreCredentialSnapshot,

    now:
      Date,
  ): boolean {
    if (
      !this.isValidDate(
        current
          .accessTokenExpiresAt,
      )
    ) {
      throw this.error(
        'credential_state_invalid',
      );
    }

    const safeUntil =
      now.getTime() +
      this.dependencies.config
        .refreshSafetyWindowMs;

    return (
      current
        .accessTokenExpiresAt
        .getTime() >
      safeUntil
    );
  }

  private validateSnapshot(
    current:
      MercadoLivreCredentialSnapshot,

    requestedSalesChannelId:
      string,
  ): void {
    if (
      !this.isNonBlankString(
        current.salesChannelId,
      ) ||
      current.salesChannelId !==
        requestedSalesChannelId ||
      !Number.isInteger(
        current.tokenGeneration,
      ) ||
      current.tokenGeneration < 1 ||
      !this.isValidDate(
        current
          .accessTokenExpiresAt,
      )
    ) {
      throw this.error(
        'credential_state_invalid',
      );
    }

    if (
      current.salesChannelType !==
      'MERCADO_LIVRE' ||
      current.salesChannelStatus !==
      'ACTIVE'
    ) {
      throw this.error(
        'credential_channel_unavailable',
      );
    }

    if (
      !this.isNonBlankString(
        current.externalAccountId,
      ) ||
      !this.isNonBlankString(
        current
          .authorizedExternalAccountId,
      )
    ) {
      throw this.error(
        'credential_state_invalid',
      );
    }

    if (
      current.externalAccountId !==
      current
        .authorizedExternalAccountId
    ) {
      throw this.error(
        'credential_identity_mismatch',
      );
    }

    if (
      !this.isNonBlankString(
        current
          .encryptionKeyVersion,
      ) ||
      !this.isNonBlankString(
        current
          .accessTokenEncrypted,
      ) ||
      !this.isNonBlankString(
        current
          .refreshTokenEncrypted,
      )
    ) {
      throw this.error(
        'credential_state_invalid',
      );
    }
  }

  private async handleOAuthFailure(
    current:
      MercadoLivreCredentialSnapshot,

    refreshAttemptId:
      string,

    failure:
      unknown,
  ): Promise<never> {
    const errorAt =
      this.readNow();

    const oauthCode =
      this.readOAuthCode(
        failure,
      );

    const status =
      this.readOAuthStatus(
        failure,
      );

    if (
      oauthCode ===
      'invalid_grant'
    ) {
      await this.transitionOrConflict({
        snapshot:
          current,

        refreshAttemptId,

        targetStatus:
          'REAUTH_REQUIRED',

        lastErrorCode:
          'oauth_invalid_grant',

        errorAt,
      });

      throw this.error(
        'credential_reauth_required',
      );
    }

    if (
      status === 429
    ) {
      await this.transitionOrConflict({
        snapshot:
          current,

        refreshAttemptId,

        targetStatus:
          'TRANSIENT_ERROR',

        lastErrorCode:
          'oauth_http_429',

        errorAt,
      });

      throw this.error(
        'credential_refresh_failed',
      );
    }

    if (
      status !== undefined &&
      status >= 400 &&
      status < 500
    ) {
      await this.transitionOrConflict({
        snapshot:
          current,

        refreshAttemptId,

        targetStatus:
          'TRANSIENT_ERROR',

        lastErrorCode:
          'oauth_http_4xx',

        errorAt,
      });

      throw this.error(
        'credential_refresh_failed',
      );
    }

    if (
      status !== undefined &&
      status >= 500
    ) {
      await this.markRotationUncertain(
        current,
        refreshAttemptId,
        'oauth_http_5xx',
        errorAt,
      );

      throw this.error(
        'credential_rotation_uncertain',
      );
    }

    await this.markRotationUncertain(
      current,
      refreshAttemptId,
      'oauth_transport_ambiguous',
      errorAt,
    );

    throw this.error(
      'credential_rotation_uncertain',
    );
  }

  private async transitionOrConflict(
    input: {
      snapshot:
        MercadoLivreCredentialSnapshot;

      refreshAttemptId:
        string;

      targetStatus:
        | 'TRANSIENT_ERROR'
        | 'ROTATION_UNCERTAIN'
        | 'REAUTH_REQUIRED';

      lastErrorCode:
        string;

      errorAt:
        Date;

      expectedRefreshStartedAt?:
        Date;
    },
  ): Promise<void> {
    let result:
      MercadoLivreRefreshMutationResult;

    try {
      result =
        await this.dependencies.store
          .failRefresh({
            salesChannelId:
              input.snapshot
                .salesChannelId,

            expectedTokenGeneration:
              input.snapshot
                .tokenGeneration,

            refreshAttemptId:
              input
                .refreshAttemptId,

            ...(
              input
                .expectedRefreshStartedAt
                !== undefined
                ? {
                    expectedRefreshStartedAt:
                      input
                        .expectedRefreshStartedAt,
                  }
                : {}
            ),

            targetStatus:
              input.targetStatus,

            lastErrorCode:
              input.lastErrorCode,

            errorAt:
              input.errorAt,
          });
    } catch {
      throw this.error(
        'credential_refresh_conflict',
      );
    }

    if (!result.committed) {
      throw this.error(
        'credential_refresh_conflict',
      );
    }
  }

  private async markRotationUncertain(
    current:
      MercadoLivreCredentialSnapshot,

    refreshAttemptId:
      string,

    lastErrorCode:
      string,

    errorAt:
      Date,
  ): Promise<void> {
    try {
      await this.dependencies.store
        .failRefresh({
          salesChannelId:
            current.salesChannelId,

          expectedTokenGeneration:
            current.tokenGeneration,

          refreshAttemptId,

          targetStatus:
            'ROTATION_UNCERTAIN',

          lastErrorCode,

          errorAt,
        });
    } catch {
      return;
    }
  }

  private validateConfig(): void {
    const config =
      this.dependencies.config;

    if (
      !config ||
      !this.isNonBlankString(
        config.clientId,
      ) ||
      !this.isNonBlankString(
        config.clientSecret,
      ) ||
      !this.isNonNegativeFinite(
        config
          .refreshSafetyWindowMs,
      ) ||
      !this.isNonNegativeFinite(
        config
          .transientRetryDelayMs,
      ) ||
      !this.isPositiveFinite(
        config
          .refreshStaleAfterMs,
      )
    ) {
      throw this.error(
        'credential_input_invalid',
      );
    }
  }

  private readNow(): Date {
    const now =
      this.dependencies.clock.now();

    if (
      !this.isValidDate(
        now,
      )
    ) {
      throw this.error(
        'credential_state_invalid',
      );
    }

    return new Date(
      now,
    );
  }

  private isValidOAuthTokenResult(
    token:
      MercadoLivreOAuthTokenResult,
  ): boolean {
    return (
      token !== null &&
      typeof token ===
        'object' &&
      this.isNonBlankString(
        token.accessToken,
      ) &&
      this.isNonBlankString(
        token.tokenType,
      ) &&
      Number.isFinite(
        token.expiresIn,
      ) &&
      token.expiresIn > 0 &&
      this.isNonBlankString(
        token.userId,
      ) &&
      this.isNonBlankString(
        token.refreshToken,
      ) &&
      (
        token.scope === undefined ||
        typeof token.scope ===
          'string'
      )
    );
  }

  private isValidEncryptedResult(
    value:
      MercadoLivreCredentialEncryptResult,
  ): boolean {
    return (
      value !== null &&
      typeof value ===
        'object' &&
      this.isNonBlankString(
        value.encryptedValue,
      ) &&
      this.isNonBlankString(
        value.keyVersion,
      )
    );
  }

  private readOAuthStatus(
    failure:
      unknown,
  ): number | undefined {
    if (
      failure === null ||
      typeof failure !==
        'object'
    ) {
      return undefined;
    }

    const status =
      (
        failure as {
          status?: unknown;
        }
      ).status;

    if (
      typeof status !==
        'number' ||
      !Number.isFinite(
        status,
      )
    ) {
      return undefined;
    }

    return status;
  }

  private readOAuthCode(
    failure:
      unknown,
  ): string | undefined {
    if (
      failure === null ||
      typeof failure !==
        'object'
    ) {
      return undefined;
    }

    const oauthCode =
      (
        failure as {
          oauthCode?: unknown;
        }
      ).oauthCode;

    if (
      !this.isNonBlankString(
        oauthCode,
      )
    ) {
      return undefined;
    }

    return oauthCode;
  }

  private isValidDate(
    value:
      unknown,
  ): value is Date {
    return (
      value instanceof Date &&
      Number.isFinite(
        value.getTime(),
      )
    );
  }

  private isNonBlankString(
    value:
      unknown,
  ): value is string {
    return (
      typeof value ===
        'string' &&
      value.trim() !==
        ''
    );
  }

  private isNonNegativeFinite(
    value:
      unknown,
  ): value is number {
    return (
      typeof value ===
        'number' &&
      Number.isFinite(
        value,
      ) &&
      value >= 0
    );
  }

  private isPositiveFinite(
    value:
      unknown,
  ): value is number {
    return (
      typeof value ===
        'number' &&
      Number.isFinite(
        value,
      ) &&
      value > 0
    );
  }

  private error(
    code:
      MercadoLivreAccessTokenCoordinatorErrorCode,
  ): MercadoLivreAccessTokenCoordinatorError {
    return new
      MercadoLivreAccessTokenCoordinatorError(
        code,
      );
  }
}