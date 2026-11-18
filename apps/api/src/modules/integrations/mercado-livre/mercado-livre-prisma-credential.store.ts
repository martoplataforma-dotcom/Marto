import type {
  MercadoLivreCompleteRefreshInput,
  MercadoLivreCredentialSnapshot,
  MercadoLivreCredentialStorePort,
  MercadoLivreFailRefreshInput,
  MercadoLivreRefreshClaimInput,
  MercadoLivreRefreshClaimResult,
  MercadoLivreRefreshMutationResult,
} from './mercado-livre-access-token-coordinator';

type CredentialStatus =
  | 'ACTIVE'
  | 'REFRESHING'
  | 'TRANSIENT_ERROR'
  | 'ROTATION_UNCERTAIN'
  | 'REAUTH_REQUIRED';

type CredentialLoadRecord = {
  salesChannelId: string;

  status: CredentialStatus;

  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  encryptionKeyVersion: string;

  tokenType: string | null;
  scope: string | null;

  accessTokenExpiresAt: Date;

  authorizedExternalAccountId: string;

  tokenGeneration: number;

  refreshAttemptId: string | null;
  refreshStartedAt: Date | null;

  lastErrorCode: string | null;
  lastErrorAt: Date | null;

  salesChannel: {
    type: string;
    status: string;
    externalAccountId: string;
  };
};

type CredentialFindUniqueInput = {
  where: {
    salesChannelId: string;
  };

  select: {
    salesChannelId: true;
    status: true;

    accessTokenEncrypted: true;
    refreshTokenEncrypted: true;
    encryptionKeyVersion: true;

    tokenType: true;
    scope: true;

    accessTokenExpiresAt: true;

    authorizedExternalAccountId: true;

    tokenGeneration: true;

    refreshAttemptId: true;
    refreshStartedAt: true;

    lastErrorCode: true;
    lastErrorAt: true;

    salesChannel: {
      select: {
        type: true;
        status: true;
        externalAccountId: true;
      };
    };
  };
};

type CredentialUpdateManyInput = {
  where: Record<
    string,
    unknown
  >;

  data: Record<
    string,
    unknown
  >;
};

export type MercadoLivreCredentialPrismaClient = {
  salesChannelCredential: {
    findUnique(
      input:
        CredentialFindUniqueInput,
    ): Promise<
      CredentialLoadRecord | null
    >;

    updateMany(
      input:
        CredentialUpdateManyInput,
    ): Promise<{
      count: number;
    }>;
  };
};

const LOAD_SELECT:
  CredentialFindUniqueInput['select'] = {
    salesChannelId:
      true,

    status:
      true,

    accessTokenEncrypted:
      true,

    refreshTokenEncrypted:
      true,

    encryptionKeyVersion:
      true,

    tokenType:
      true,

    scope:
      true,

    accessTokenExpiresAt:
      true,

    authorizedExternalAccountId:
      true,

    tokenGeneration:
      true,

    refreshAttemptId:
      true,

    refreshStartedAt:
      true,

    lastErrorCode:
      true,

    lastErrorAt:
      true,

    salesChannel: {
      select: {
        type:
          true,

        status:
          true,

        externalAccountId:
          true,
      },
    },
  };

const FAILURE_STATUSES =
  new Set<
    MercadoLivreFailRefreshInput[
      'targetStatus'
    ]
  >([
    'TRANSIENT_ERROR',
    'ROTATION_UNCERTAIN',
    'REAUTH_REQUIRED',
  ]);

export class MercadoLivrePrismaCredentialStore
implements MercadoLivreCredentialStorePort {
  constructor(
    private readonly prisma:
      MercadoLivreCredentialPrismaClient,
  ) {}

  async load(
    salesChannelId:
      string,
  ): Promise<
    MercadoLivreCredentialSnapshot |
    undefined
  > {
    const record =
      await this.prisma
        .salesChannelCredential
        .findUnique({
          where: {
            salesChannelId,
          },

          select:
            LOAD_SELECT,
        });

    if (record === null) {
      return undefined;
    }

    return this.toSnapshot(
      record,
    );
  }

  async tryClaimRefresh(
    input:
      MercadoLivreRefreshClaimInput,
  ): Promise<
    MercadoLivreRefreshClaimResult
  > {
    if (
      input.expectedStatus !==
        'ACTIVE' &&
      input.expectedStatus !==
        'TRANSIENT_ERROR'
    ) {
      throw new Error(
        'credential_claim_status_invalid',
      );
    }

    const result =
      await this.prisma
        .salesChannelCredential
        .updateMany({
          where: {
            salesChannelId:
              input.salesChannelId,

            tokenGeneration:
              input.expectedTokenGeneration,

            status:
              input.expectedStatus,

            refreshAttemptId:
              null,

            refreshStartedAt:
              null,

            salesChannel: {
              is: {
                type:
                  'MERCADO_LIVRE',

                status:
                  'ACTIVE',
              },
            },
          },

          data: {
            status:
              'REFRESHING',

            refreshAttemptId:
              input.refreshAttemptId,

            refreshStartedAt:
              input.refreshStartedAt,
          },
        });

    if (result.count === 1) {
      return {
        claimed:
          true,
      };
    }

    this.assertValidCasCount(
      result.count,
    );

    return {
      claimed:
        false,

      ...(
        await this.currentResult(
          input.salesChannelId,
        )
      ),
    };
  }

  async completeRefresh(
    input:
      MercadoLivreCompleteRefreshInput,
  ): Promise<
    MercadoLivreRefreshMutationResult
  > {
    this.validateCompleteInput(
      input,
    );

    const result =
      await this.prisma
        .salesChannelCredential
        .updateMany({
          where: {
            salesChannelId:
              input.salesChannelId,

            status:
              'REFRESHING',

            tokenGeneration:
              input.expectedTokenGeneration,

            refreshAttemptId:
              input.refreshAttemptId,

            authorizedExternalAccountId:
              input
                .authorizedExternalAccountId,

            salesChannel: {
              is: {
                type:
                  'MERCADO_LIVRE',

                externalAccountId:
                  input
                    .authorizedExternalAccountId,
              },
            },
          },

          data: {
            status:
              'ACTIVE',

            accessTokenEncrypted:
              input.accessTokenEncrypted,

            refreshTokenEncrypted:
              input.refreshTokenEncrypted,

            encryptionKeyVersion:
              input.encryptionKeyVersion,

            tokenType:
              input.tokenType,

            scope:
              input.scope ??
              null,

            accessTokenExpiresAt:
              input.accessTokenExpiresAt,

            authorizedExternalAccountId:
              input
                .authorizedExternalAccountId,

            tokenGeneration:
              input.newTokenGeneration,

            refreshAttemptId:
              null,

            refreshStartedAt:
              null,

            lastRotatedAt:
              input.lastRotatedAt,

            lastErrorCode:
              null,

            lastErrorAt:
              null,
          },
        });

    if (result.count === 1) {
      return {
        committed:
          true,
      };
    }

    this.assertValidCasCount(
      result.count,
    );

    return {
      committed:
        false,

      ...(
        await this.currentResult(
          input.salesChannelId,
        )
      ),
    };
  }

  async failRefresh(
    input:
      MercadoLivreFailRefreshInput,
  ): Promise<
    MercadoLivreRefreshMutationResult
  > {
    if (
      !FAILURE_STATUSES.has(
        input.targetStatus,
      )
    ) {
      throw new Error(
        'credential_failure_status_invalid',
      );
    }

    const where:
      Record<string, unknown> = {
      salesChannelId:
        input.salesChannelId,

      status:
        'REFRESHING',

      tokenGeneration:
        input.expectedTokenGeneration,

      refreshAttemptId:
        input.refreshAttemptId,
    };

    if (
      input.expectedRefreshStartedAt !==
      undefined
    ) {
      where.refreshStartedAt =
        input.expectedRefreshStartedAt;
    }

    const result =
      await this.prisma
        .salesChannelCredential
        .updateMany({
          where,

          data: {
            status:
              input.targetStatus,

            lastErrorCode:
              input.lastErrorCode,

            lastErrorAt:
              input.errorAt,

            refreshAttemptId:
              null,

            refreshStartedAt:
              null,
          },
        });

    if (result.count === 1) {
      return {
        committed:
          true,
      };
    }

    this.assertValidCasCount(
      result.count,
    );

    return {
      committed:
        false,

      ...(
        await this.currentResult(
          input.salesChannelId,
        )
      ),
    };
  }

  private validateCompleteInput(
    input:
      MercadoLivreCompleteRefreshInput,
  ): void {
    if (
      input.status !==
        'ACTIVE' ||
      input.refreshAttemptIdAfterCommit !==
        null ||
      input.refreshStartedAtAfterCommit !==
        null ||
      input.lastErrorCodeAfterCommit !==
        null ||
      input.lastErrorAtAfterCommit !==
        null ||
      !Number.isSafeInteger(
        input.expectedTokenGeneration,
      ) ||
      !Number.isSafeInteger(
        input.newTokenGeneration,
      ) ||
      input.newTokenGeneration !==
        input.expectedTokenGeneration +
        1
    ) {
      throw new Error(
        'credential_generation_invalid',
      );
    }
  }

  private assertValidCasCount(
    count:
      number,
  ): void {
    if (count === 0) {
      return;
    }

    throw new Error(
      'credential_cas_count_invalid',
    );
  }

  private async currentResult(
    salesChannelId:
      string,
  ): Promise<{
    current?:
      MercadoLivreCredentialSnapshot;
  }> {
    const current =
      await this.load(
        salesChannelId,
      );

    if (current === undefined) {
      return {};
    }

    return {
      current,
    };
  }

  private toSnapshot(
    record:
      CredentialLoadRecord,
  ): MercadoLivreCredentialSnapshot {
    const snapshot:
      MercadoLivreCredentialSnapshot = {
      salesChannelId:
        record.salesChannelId,

      salesChannelType:
        record.salesChannel.type,

      salesChannelStatus:
        record.salesChannel.status,

      externalAccountId:
        record
          .salesChannel
          .externalAccountId,

      credentialStatus:
        record.status,

      accessTokenEncrypted:
        record.accessTokenEncrypted,

      refreshTokenEncrypted:
        record.refreshTokenEncrypted,

      encryptionKeyVersion:
        record.encryptionKeyVersion,

      accessTokenExpiresAt:
        new Date(
          record.accessTokenExpiresAt,
        ),

      authorizedExternalAccountId:
        record
          .authorizedExternalAccountId,

      tokenGeneration:
        record.tokenGeneration,
    };

    if (record.tokenType !== null) {
      snapshot.tokenType =
        record.tokenType;
    }

    if (record.scope !== null) {
      snapshot.scope =
        record.scope;
    }

    if (
      record.refreshAttemptId !==
      null
    ) {
      snapshot.refreshAttemptId =
        record.refreshAttemptId;
    }

    if (
      record.refreshStartedAt !==
      null
    ) {
      snapshot.refreshStartedAt =
        new Date(
          record.refreshStartedAt,
        );
    }

    if (
      record.lastErrorCode !==
      null
    ) {
      snapshot.lastErrorCode =
        record.lastErrorCode;
    }

    if (
      record.lastErrorAt !==
      null
    ) {
      snapshot.lastErrorAt =
        new Date(
          record.lastErrorAt,
        );
    }

    return snapshot;
  }
}
