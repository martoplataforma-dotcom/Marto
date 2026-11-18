import {
  readFileSync,
} from 'fs';

import {
  join,
} from 'path';

type CredentialStatus =
  | 'ACTIVE'
  | 'REFRESHING'
  | 'TRANSIENT_ERROR'
  | 'ROTATION_UNCERTAIN'
  | 'REAUTH_REQUIRED';

type CredentialSnapshot = {
  salesChannelId: string;
  salesChannelType: string;
  salesChannelStatus: string;

  externalAccountId: string;

  credentialStatus:
    CredentialStatus;

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

type RefreshClaimInput = {
  salesChannelId: string;
  expectedTokenGeneration: number;

  expectedStatus:
    | 'ACTIVE'
    | 'TRANSIENT_ERROR';

  refreshAttemptId: string;
  refreshStartedAt: Date;
};

type RefreshClaimResult = {
  claimed: boolean;
  current?: CredentialSnapshot;
};

type CompleteRefreshInput = {
  salesChannelId: string;
  expectedTokenGeneration: number;
  refreshAttemptId: string;

  status: 'ACTIVE';

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

type FailRefreshInput = {
  salesChannelId: string;
  expectedTokenGeneration: number;
  refreshAttemptId: string;

  expectedRefreshStartedAt?: Date;

  targetStatus:
    | 'TRANSIENT_ERROR'
    | 'ROTATION_UNCERTAIN'
    | 'REAUTH_REQUIRED';

  lastErrorCode: string;
  errorAt: Date;
};

type MutationResult = {
  committed: boolean;
  current?: CredentialSnapshot;
};

type CredentialStoreContract = {
  load(
    salesChannelId: string,
  ): Promise<
    CredentialSnapshot | undefined
  >;

  tryClaimRefresh(
    input: RefreshClaimInput,
  ): Promise<RefreshClaimResult>;

  completeRefresh(
    input: CompleteRefreshInput,
  ): Promise<MutationResult>;

  failRefresh(
    input: FailRefreshInput,
  ): Promise<MutationResult>;
};

type DbCredentialRecord = {
  salesChannelId: string;

  status:
    CredentialStatus;

  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  encryptionKeyVersion: string;

  tokenType: string | null;
  scope: string | null;

  accessTokenExpiresAt: Date;

  authorizedExternalAccountId:
    string;

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

type FindUniqueArgs = {
  where: {
    salesChannelId: string;
  };

  select: Record<
    string,
    unknown
  >;
};

type UpdateManyArgs = {
  where:
    Record<string, unknown>;

  data:
    Record<string, unknown>;
};

type FindUniqueFn = (
  input: FindUniqueArgs,
) => Promise<
  DbCredentialRecord | null
>;

type UpdateManyFn = (
  input: UpdateManyArgs,
) => Promise<{
  count: number;
}>;

type PrismaLike = {
  salesChannelCredential: {
    findUnique:
      jest.MockedFunction<
        FindUniqueFn
      >;

    updateMany:
      jest.MockedFunction<
        UpdateManyFn
      >;
  };
};

type StoreModule = {
  MercadoLivrePrismaCredentialStore:
    new (
      prisma: PrismaLike,
    ) => CredentialStoreContract;
};

const SALES_CHANNEL_ID =
  'sales-channel-synthetic-1';

const EXTERNAL_ACCOUNT_ID =
  'seller-123456';

const ATTEMPT_ID =
  'refresh-attempt-synthetic-1';

const WINNER_ATTEMPT_ID =
  'refresh-attempt-winner';

const STARTED_AT =
  new Date(
    '2026-11-17T21:00:00.000Z',
  );

const OTHER_STARTED_AT =
  new Date(
    '2026-11-17T21:00:01.000Z',
  );

const EXPIRES_AT =
  new Date(
    '2026-11-17T22:00:00.000Z',
  );

const ROTATED_AT =
  new Date(
    '2026-11-17T21:00:07.000Z',
  );

const ERROR_AT =
  new Date(
    '2026-11-17T21:00:09.000Z',
  );

const EXPECTED_LOAD_SELECT = {
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

function loadStoreModule():
  StoreModule {
  return jest.requireActual<
    StoreModule
  >(
    './mercado-livre-prisma-credential.store',
  );
}

function dbRecord(
  overrides:
    Partial<DbCredentialRecord> & {
      salesChannel?:
        Partial<
          DbCredentialRecord[
            'salesChannel'
          ]
        >;
    } = {},
): DbCredentialRecord {
  const base:
    DbCredentialRecord = {
    salesChannelId:
      SALES_CHANNEL_ID,

    status:
      'ACTIVE',

    accessTokenEncrypted:
      'enc-access-db',

    refreshTokenEncrypted:
      'enc-refresh-db',

    encryptionKeyVersion:
      'key-v1',

    tokenType:
      'Bearer',

    scope:
      'read write',

    accessTokenExpiresAt:
      new Date(
        EXPIRES_AT,
      ),

    authorizedExternalAccountId:
      EXTERNAL_ACCOUNT_ID,

    tokenGeneration:
      7,

    refreshAttemptId:
      null,

    refreshStartedAt:
      null,

    lastErrorCode:
      null,

    lastErrorAt:
      null,

    salesChannel: {
      type:
        'MERCADO_LIVRE',

      status:
        'ACTIVE',

      externalAccountId:
        EXTERNAL_ACCOUNT_ID,
    },
  };

  return {
    ...base,
    ...overrides,

    salesChannel: {
      ...base.salesChannel,
      ...(
        overrides.salesChannel ??
        {}
      ),
    },
  };
}

function expectedSnapshot(
  record:
    DbCredentialRecord,
): CredentialSnapshot {
  const result:
    CredentialSnapshot = {
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
    result.tokenType =
      record.tokenType;
  }

  if (record.scope !== null) {
    result.scope =
      record.scope;
  }

  if (
    record.refreshAttemptId !==
    null
  ) {
    result.refreshAttemptId =
      record.refreshAttemptId;
  }

  if (
    record.refreshStartedAt !==
    null
  ) {
    result.refreshStartedAt =
      new Date(
        record.refreshStartedAt,
      );
  }

  if (
    record.lastErrorCode !==
    null
  ) {
    result.lastErrorCode =
      record.lastErrorCode;
  }

  if (
    record.lastErrorAt !==
    null
  ) {
    result.lastErrorAt =
      new Date(
        record.lastErrorAt,
      );
  }

  return result;
}

function claimInput(
  overrides:
    Partial<RefreshClaimInput> = {},
): RefreshClaimInput {
  return {
    salesChannelId:
      SALES_CHANNEL_ID,

    expectedTokenGeneration:
      7,

    expectedStatus:
      'ACTIVE',

    refreshAttemptId:
      ATTEMPT_ID,

    refreshStartedAt:
      new Date(
        STARTED_AT,
      ),

    ...overrides,
  };
}

function completeInput(
  overrides:
    Partial<CompleteRefreshInput> = {},
): CompleteRefreshInput {
  return {
    salesChannelId:
      SALES_CHANNEL_ID,

    expectedTokenGeneration:
      7,

    refreshAttemptId:
      ATTEMPT_ID,

    status:
      'ACTIVE',

    accessTokenEncrypted:
      'enc-access-new',

    refreshTokenEncrypted:
      'enc-refresh-new',

    encryptionKeyVersion:
      'key-v2',

    tokenType:
      'Bearer',

    scope:
      'read write',

    accessTokenExpiresAt:
      new Date(
        EXPIRES_AT,
      ),

    authorizedExternalAccountId:
      EXTERNAL_ACCOUNT_ID,

    newTokenGeneration:
      8,

    refreshAttemptIdAfterCommit:
      null,

    refreshStartedAtAfterCommit:
      null,

    lastRotatedAt:
      new Date(
        ROTATED_AT,
      ),

    lastErrorCodeAfterCommit:
      null,

    lastErrorAtAfterCommit:
      null,

    ...overrides,
  };
}

function failInput(
  overrides:
    Partial<FailRefreshInput> = {},
): FailRefreshInput {
  return {
    salesChannelId:
      SALES_CHANNEL_ID,

    expectedTokenGeneration:
      7,

    refreshAttemptId:
      ATTEMPT_ID,

    targetStatus:
      'TRANSIENT_ERROR',

    lastErrorCode:
      'oauth_http_429',

    errorAt:
      new Date(
        ERROR_AT,
      ),

    ...overrides,
  };
}

function createHarness(
  options: {
    record?:
      DbCredentialRecord |
      null;

    updateCount?:
      number;
  } = {},
) {
  const module =
    loadStoreModule();

  const findUnique =
    jest.fn<
      ReturnType<FindUniqueFn>,
      Parameters<FindUniqueFn>
    >();

  const updateMany =
    jest.fn<
      ReturnType<UpdateManyFn>,
      Parameters<UpdateManyFn>
    >();

  findUnique.mockResolvedValue(
    Object.prototype.hasOwnProperty.call(
      options,
      'record',
    )
      ? options.record!
      : dbRecord(),
  );

  updateMany.mockResolvedValue({
    count:
      options.updateCount ??
      1,
  });

  const prisma:
    PrismaLike = {
    salesChannelCredential: {
      findUnique,
      updateMany,
    },
  };

  const store =
    new module
      .MercadoLivrePrismaCredentialStore(
        prisma,
      );

  return {
    module,
    prisma,
    store,
  };
}

function firstUpdateArgs(
  prisma:
    PrismaLike,
): UpdateManyArgs {
  expect(
    prisma
      .salesChannelCredential
      .updateMany,
  ).toHaveBeenCalled();

  return prisma
    .salesChannelCredential
    .updateMany
    .mock.calls[0][0];
}

describe(
  'MercadoLivrePrismaCredentialStore RED contracts',
  () => {

    it('1. missing credential returns undefined', async () => {
      const test =
        createHarness({
          record:
            null,
        });

      await expect(
        test.store.load(
          SALES_CHANNEL_ID,
        ),
      ).resolves.toBeUndefined();
    });

    it('2. load maps credential and SalesChannel context into the coordinator snapshot', async () => {
      const record =
        dbRecord();

      const test =
        createHarness({
          record,
        });

      await expect(
        test.store.load(
          SALES_CHANNEL_ID,
        ),
      ).resolves.toEqual(
        expectedSnapshot(
          record,
        ),
      );
    });

    it('3. load keeps tokens encrypted and never exposes plaintext token fields', async () => {
      const test =
        createHarness();

      const result =
        await test.store.load(
          SALES_CHANNEL_ID,
        );

      expect(
        result,
      ).toEqual(
        expect.objectContaining({
          accessTokenEncrypted:
            'enc-access-db',

          refreshTokenEncrypted:
            'enc-refresh-db',
        }),
      );

      expect(
        result,
      ).not.toHaveProperty(
        'accessToken',
      );

      expect(
        result,
      ).not.toHaveProperty(
        'refreshToken',
      );
    });

    it('4. load selects only the fields required by the credential snapshot', async () => {
      const test =
        createHarness();

      await test.store.load(
        SALES_CHANNEL_ID,
      );

      expect(
        test.prisma
          .salesChannelCredential
          .findUnique,
      ).toHaveBeenCalledTimes(
        1,
      );

      expect(
        test.prisma
          .salesChannelCredential
          .findUnique,
      ).toHaveBeenCalledWith({
        where: {
          salesChannelId:
            SALES_CHANNEL_ID,
        },

        select:
          EXPECTED_LOAD_SELECT,
      });
    });

    it('5. claim CAS filters by salesChannelId', async () => {
      const test =
        createHarness();

      await test.store
        .tryClaimRefresh(
          claimInput(),
        );

      const args =
        firstUpdateArgs(
          test.prisma,
        );

      expect(
        args.where,
      ).toEqual(
        expect.objectContaining({
          salesChannelId:
            SALES_CHANNEL_ID,
        }),
      );
    });

    it('6. claim CAS filters by expected tokenGeneration', async () => {
      const test =
        createHarness();

      await test.store
        .tryClaimRefresh(
          claimInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).where,
      ).toEqual(
        expect.objectContaining({
          tokenGeneration:
            7,
        }),
      );
    });

    it('7. claim CAS filters by expected credential status', async () => {
      const test =
        createHarness();

      await test.store
        .tryClaimRefresh(
          claimInput({
            expectedStatus:
              'TRANSIENT_ERROR',
          }),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).where,
      ).toEqual(
        expect.objectContaining({
          status:
            'TRANSIENT_ERROR',
        }),
      );
    });

    it('8. claim CAS requires refreshAttemptId to still be null', async () => {
      const test =
        createHarness();

      await test.store
        .tryClaimRefresh(
          claimInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).where,
      ).toEqual(
        expect.objectContaining({
          refreshAttemptId:
            null,
        }),
      );
    });

    it('9. claim CAS requires refreshStartedAt to still be null', async () => {
      const test =
        createHarness();

      await test.store
        .tryClaimRefresh(
          claimInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).where,
      ).toEqual(
        expect.objectContaining({
          refreshStartedAt:
            null,
        }),
      );
    });

    it('10. claim CAS requires SalesChannel type MERCADO_LIVRE', async () => {
      const test =
        createHarness();

      await test.store
        .tryClaimRefresh(
          claimInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).where.salesChannel,
      ).toEqual({
        is: {
          type:
            'MERCADO_LIVRE',

          status:
            'ACTIVE',
        },
      });
    });

    it('11. claim CAS requires SalesChannel status ACTIVE', async () => {
      const test =
        createHarness();

      await test.store
        .tryClaimRefresh(
          claimInput(),
        );

      const relation =
        firstUpdateArgs(
          test.prisma,
        ).where
          .salesChannel as {
          is?: Record<
            string,
            unknown
          >;
        };

      expect(
        relation.is,
      ).toEqual(
        expect.objectContaining({
          status:
            'ACTIVE',
        }),
      );
    });

    it('12. winning claim writes credential status REFRESHING', async () => {
      const test =
        createHarness();

      await test.store
        .tryClaimRefresh(
          claimInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          status:
            'REFRESHING',
        }),
      );
    });

    it('13. winning claim writes the received refreshAttemptId', async () => {
      const test =
        createHarness();

      await test.store
        .tryClaimRefresh(
          claimInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          refreshAttemptId:
            ATTEMPT_ID,
        }),
      );
    });

    it('14. winning claim writes the received refreshStartedAt', async () => {
      const test =
        createHarness();

      await test.store
        .tryClaimRefresh(
          claimInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          refreshStartedAt:
            STARTED_AT,
        }),
      );
    });

    it('15. claim never mutates tokenGeneration', async () => {
      const test =
        createHarness();

      await test.store
        .tryClaimRefresh(
          claimInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).not.toHaveProperty(
        'tokenGeneration',
      );
    });

    it('16. count one means the refresh claim was acquired', async () => {
      const test =
        createHarness({
          updateCount:
            1,
        });

      await expect(
        test.store
          .tryClaimRefresh(
            claimInput(),
          ),
      ).resolves.toEqual({
        claimed:
          true,
      });
    });

    it('17. winning claim does not perform a post-CAS read', async () => {
      const test =
        createHarness({
          updateCount:
            1,
        });

      await test.store
        .tryClaimRefresh(
          claimInput(),
        );

      expect(
        test.prisma
          .salesChannelCredential
          .findUnique,
      ).not.toHaveBeenCalled();
    });

    it('18. count zero means claim lost and returns the observed current snapshot', async () => {
      const currentRecord =
        dbRecord({
          status:
            'REFRESHING',

          refreshAttemptId:
            WINNER_ATTEMPT_ID,

          refreshStartedAt:
            STARTED_AT,
        });

      const test =
        createHarness({
          record:
            currentRecord,

          updateCount:
            0,
        });

      await expect(
        test.store
          .tryClaimRefresh(
            claimInput(),
          ),
      ).resolves.toEqual({
        claimed:
          false,

        current:
          expectedSnapshot(
            currentRecord,
          ),
      });
    });

    it('19. lost claim performs at most one observational read', async () => {
      const test =
        createHarness({
          updateCount:
            0,
        });

      await test.store
        .tryClaimRefresh(
          claimInput(),
        );

      expect(
        test.prisma
          .salesChannelCredential
          .findUnique,
      ).toHaveBeenCalledTimes(
        1,
      );
    });

    it('20. lost claim never performs a second updateMany attempt', async () => {
      const test =
        createHarness({
          updateCount:
            0,
        });

      await test.store
        .tryClaimRefresh(
          claimInput(),
        );

      expect(
        test.prisma
          .salesChannelCredential
          .updateMany,
      ).toHaveBeenCalledTimes(
        1,
      );
    });

    it('21. completeRefresh CAS requires credential status REFRESHING', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).where,
      ).toEqual(
        expect.objectContaining({
          status:
            'REFRESHING',
        }),
      );
    });

    it('22. completeRefresh CAS requires expected tokenGeneration', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).where,
      ).toEqual(
        expect.objectContaining({
          tokenGeneration:
            7,
        }),
      );
    });

    it('23. completeRefresh CAS requires the winning refreshAttemptId', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).where,
      ).toEqual(
        expect.objectContaining({
          refreshAttemptId:
            ATTEMPT_ID,
        }),
      );
    });

    it('24. completeRefresh CAS requires the expected authorized identity', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).where,
      ).toEqual(
        expect.objectContaining({
          authorizedExternalAccountId:
            EXTERNAL_ACCOUNT_ID,
        }),
      );
    });

    it('25. completeRefresh CAS requires SalesChannel type MERCADO_LIVRE', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      const relation =
        firstUpdateArgs(
          test.prisma,
        ).where
          .salesChannel as {
          is?: Record<
            string,
            unknown
          >;
        };

      expect(
        relation.is,
      ).toEqual(
        expect.objectContaining({
          type:
            'MERCADO_LIVRE',
        }),
      );
    });

    it('26. completeRefresh CAS requires SalesChannel externalAccountId to remain compatible', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      const relation =
        firstUpdateArgs(
          test.prisma,
        ).where
          .salesChannel as {
          is?: Record<
            string,
            unknown
          >;
        };

      expect(
        relation.is,
      ).toEqual(
        expect.objectContaining({
          externalAccountId:
            EXTERNAL_ACCOUNT_ID,
        }),
      );
    });

    it('27. completeRefresh intentionally does not require SalesChannel status ACTIVE', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      const relation =
        firstUpdateArgs(
          test.prisma,
        ).where
          .salesChannel as {
          is?: Record<
            string,
            unknown
          >;
        };

      expect(
        relation.is,
      ).not.toHaveProperty(
        'status',
      );
    });

    it('28. completeRefresh rejects any newTokenGeneration other than expected generation plus one', async () => {
      const test =
        createHarness();

      await expect(
        test.store
          .completeRefresh(
            completeInput({
              newTokenGeneration:
                9,
            }),
          ),
      ).rejects.toThrow();

      expect(
        test.prisma
          .salesChannelCredential
          .updateMany,
      ).not.toHaveBeenCalled();
    });

    it('29. completeRefresh persists access and refresh token in the same mutation', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          accessTokenEncrypted:
            'enc-access-new',

          refreshTokenEncrypted:
            'enc-refresh-new',
        }),
      );

      expect(
        test.prisma
          .salesChannelCredential
          .updateMany,
      ).toHaveBeenCalledTimes(
        1,
      );
    });

    it('30. completeRefresh persists the new encryptionKeyVersion', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          encryptionKeyVersion:
            'key-v2',
        }),
      );
    });

    it('31. completeRefresh persists the new accessTokenExpiresAt', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          accessTokenExpiresAt:
            EXPIRES_AT,
        }),
      );
    });

    it('32. completeRefresh persists tokenType', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          tokenType:
            'Bearer',
        }),
      );
    });

    it('33. completeRefresh converts absent scope to null', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput({
            scope:
              undefined,
          }),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          scope:
            null,
        }),
      );
    });

    it('34. completeRefresh increments tokenGeneration exactly by one', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          tokenGeneration:
            8,
        }),
      );
    });

    it('35. completeRefresh clears refreshAttemptId', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          refreshAttemptId:
            null,
        }),
      );
    });

    it('36. completeRefresh clears refreshStartedAt', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          refreshStartedAt:
            null,
        }),
      );
    });

    it('37. completeRefresh clears the previous error metadata', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          lastErrorCode:
            null,

          lastErrorAt:
            null,
        }),
      );
    });

    it('38. completeRefresh records lastRotatedAt', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          lastRotatedAt:
            ROTATED_AT,
        }),
      );
    });

    it('39. successful completeRefresh returns committed true', async () => {
      const test =
        createHarness({
          updateCount:
            1,
        });

      await expect(
        test.store
          .completeRefresh(
            completeInput(),
          ),
      ).resolves.toEqual({
        committed:
          true,
      });
    });

    it('40. successful completeRefresh performs no observational read', async () => {
      const test =
        createHarness({
          updateCount:
            1,
        });

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        test.prisma
          .salesChannelCredential
          .findUnique,
      ).not.toHaveBeenCalled();
    });

    it('41. completeRefresh conflict returns committed false with the observed snapshot', async () => {
      const currentRecord =
        dbRecord({
          status:
            'ACTIVE',

          tokenGeneration:
            8,
        });

      const test =
        createHarness({
          record:
            currentRecord,

          updateCount:
            0,
        });

      await expect(
        test.store
          .completeRefresh(
            completeInput(),
          ),
      ).resolves.toEqual({
        committed:
          false,

        current:
          expectedSnapshot(
            currentRecord,
          ),
      });
    });

    it('42. completeRefresh conflict never retries updateMany', async () => {
      const test =
        createHarness({
          updateCount:
            0,
        });

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        test.prisma
          .salesChannelCredential
          .updateMany,
      ).toHaveBeenCalledTimes(
        1,
      );
    });

    it('43. completeRefresh conflict performs at most one observational read', async () => {
      const test =
        createHarness({
          updateCount:
            0,
        });

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        test.prisma
          .salesChannelCredential
          .findUnique,
      ).toHaveBeenCalledTimes(
        1,
      );
    });

    it('44. failRefresh CAS requires credential status REFRESHING', async () => {
      const test =
        createHarness();

      await test.store
        .failRefresh(
          failInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).where,
      ).toEqual(
        expect.objectContaining({
          status:
            'REFRESHING',
        }),
      );
    });

    it('45. failRefresh CAS requires expected tokenGeneration', async () => {
      const test =
        createHarness();

      await test.store
        .failRefresh(
          failInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).where,
      ).toEqual(
        expect.objectContaining({
          tokenGeneration:
            7,
        }),
      );
    });

    it('46. failRefresh CAS requires the expected refreshAttemptId', async () => {
      const test =
        createHarness();

      await test.store
        .failRefresh(
          failInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).where,
      ).toEqual(
        expect.objectContaining({
          refreshAttemptId:
            ATTEMPT_ID,
        }),
      );
    });

    it('47. failRefresh includes expectedRefreshStartedAt in the CAS when supplied', async () => {
      const test =
        createHarness();

      await test.store
        .failRefresh(
          failInput({
            expectedRefreshStartedAt:
              STARTED_AT,
          }),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).where,
      ).toEqual(
        expect.objectContaining({
          refreshStartedAt:
            STARTED_AT,
        }),
      );
    });

    it('48. failRefresh does not add refreshStartedAt CAS when expectedRefreshStartedAt is absent', async () => {
      const test =
        createHarness();

      await test.store
        .failRefresh(
          failInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).where,
      ).not.toHaveProperty(
        'refreshStartedAt',
      );
    });

    it('49. failRefresh rejects a target status outside the three permitted failure states', async () => {
      const test =
        createHarness();

      const invalid =
        failInput() as
          FailRefreshInput & {
            targetStatus:
              string;
          };

      invalid.targetStatus =
        'ACTIVE';

      await expect(
        test.store
          .failRefresh(
            invalid as FailRefreshInput,
          ),
      ).rejects.toThrow();

      expect(
        test.prisma
          .salesChannelCredential
          .updateMany,
      ).not.toHaveBeenCalled();
    });

    it('50. failRefresh writes lastErrorCode', async () => {
      const test =
        createHarness();

      await test.store
        .failRefresh(
          failInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          lastErrorCode:
            'oauth_http_429',
        }),
      );
    });

    it('51. failRefresh writes lastErrorAt from errorAt', async () => {
      const test =
        createHarness();

      await test.store
        .failRefresh(
          failInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          lastErrorAt:
            ERROR_AT,
        }),
      );
    });

    it('52. failRefresh clears refreshAttemptId', async () => {
      const test =
        createHarness();

      await test.store
        .failRefresh(
          failInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          refreshAttemptId:
            null,
        }),
      );
    });

    it('53. failRefresh clears refreshStartedAt', async () => {
      const test =
        createHarness();

      await test.store
        .failRefresh(
          failInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).toEqual(
        expect.objectContaining({
          refreshStartedAt:
            null,
        }),
      );
    });

    it('54. failRefresh preserves encrypted tokens and encryption metadata', async () => {
      const test =
        createHarness();

      await test.store
        .failRefresh(
          failInput(),
        );

      const data =
        firstUpdateArgs(
          test.prisma,
        ).data;

      expect(
        data,
      ).not.toHaveProperty(
        'accessTokenEncrypted',
      );

      expect(
        data,
      ).not.toHaveProperty(
        'refreshTokenEncrypted',
      );

      expect(
        data,
      ).not.toHaveProperty(
        'encryptionKeyVersion',
      );
    });

    it('55. failRefresh preserves tokenGeneration', async () => {
      const test =
        createHarness();

      await test.store
        .failRefresh(
          failInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).not.toHaveProperty(
        'tokenGeneration',
      );
    });

    it('56. failRefresh preserves the authorized external identity', async () => {
      const test =
        createHarness();

      await test.store
        .failRefresh(
          failInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).data,
      ).not.toHaveProperty(
        'authorizedExternalAccountId',
      );
    });

    it('57. successful failRefresh returns committed true', async () => {
      const test =
        createHarness({
          updateCount:
            1,
        });

      await expect(
        test.store
          .failRefresh(
            failInput(),
          ),
      ).resolves.toEqual({
        committed:
          true,
      });
    });

    it('58. failRefresh conflict returns committed false with the observed snapshot', async () => {
      const currentRecord =
        dbRecord({
          status:
            'ACTIVE',

          tokenGeneration:
            8,
        });

      const test =
        createHarness({
          record:
            currentRecord,

          updateCount:
            0,
        });

      await expect(
        test.store
          .failRefresh(
            failInput(),
          ),
      ).resolves.toEqual({
        committed:
          false,

        current:
          expectedSnapshot(
            currentRecord,
          ),
      });
    });

    it('59. failRefresh conflict never retries updateMany', async () => {
      const test =
        createHarness({
          updateCount:
            0,
        });

      await test.store
        .failRefresh(
          failInput(),
        );

      expect(
        test.prisma
          .salesChannelCredential
          .updateMany,
      ).toHaveBeenCalledTimes(
        1,
      );
    });

    it('60. failRefresh conflict performs at most one observational read', async () => {
      const test =
        createHarness({
          updateCount:
            0,
        });

      await test.store
        .failRefresh(
          failInput(),
        );

      expect(
        test.prisma
          .salesChannelCredential
          .findUnique,
      ).toHaveBeenCalledTimes(
        1,
      );
    });

    it('61. a second claim for the same generation loses after the first claim wins', async () => {
      const currentRecord =
        dbRecord({
          status:
            'REFRESHING',

          refreshAttemptId:
            ATTEMPT_ID,

          refreshStartedAt:
            STARTED_AT,
        });

      const test =
        createHarness({
          record:
            currentRecord,
        });

      test.prisma
        .salesChannelCredential
        .updateMany
        .mockReset();

      test.prisma
        .salesChannelCredential
        .updateMany
        .mockResolvedValueOnce({
          count:
            1,
        })
        .mockResolvedValueOnce({
          count:
            0,
        });

      const first =
        await test.store
          .tryClaimRefresh(
            claimInput(),
          );

      const second =
        await test.store
          .tryClaimRefresh(
            claimInput({
              refreshAttemptId:
                'second-attempt',
            }),
          );

      expect(first).toEqual({
        claimed:
          true,
      });

      expect(second).toEqual({
        claimed:
          false,

        current:
          expectedSnapshot(
            currentRecord,
          ),
      });

      expect(
        test.prisma
          .salesChannelCredential
          .updateMany,
      ).toHaveBeenCalledTimes(
        2,
      );
    });

    it('62. completeRefresh using a stale generation loses the CAS', async () => {
      const currentRecord =
        dbRecord({
          status:
            'ACTIVE',

          tokenGeneration:
            8,
        });

      const test =
        createHarness({
          record:
            currentRecord,

          updateCount:
            0,
        });

      const result =
        await test.store
          .completeRefresh(
            completeInput(),
          );

      expect(
        result.committed,
      ).toBe(
        false,
      );

      expect(
        result.current
          ?.tokenGeneration,
      ).toBe(
        8,
      );
    });

    it('63. completeRefresh using a stale refreshAttemptId loses the CAS', async () => {
      const currentRecord =
        dbRecord({
          status:
            'REFRESHING',

          refreshAttemptId:
            WINNER_ATTEMPT_ID,

          refreshStartedAt:
            STARTED_AT,
        });

      const test =
        createHarness({
          record:
            currentRecord,

          updateCount:
            0,
        });

      const result =
        await test.store
          .completeRefresh(
            completeInput({
              refreshAttemptId:
                ATTEMPT_ID,
            }),
          );

      expect(
        result,
      ).toEqual({
        committed:
          false,

        current:
          expectedSnapshot(
            currentRecord,
          ),
      });
    });

    it('64. completeRefresh cannot overwrite a concurrently changed external identity', async () => {
      const attackerIdentity =
        'seller-other';

      const currentRecord =
        dbRecord({
          authorizedExternalAccountId:
            attackerIdentity,

          salesChannel: {
            externalAccountId:
              attackerIdentity,
          },
        });

      const test =
        createHarness({
          record:
            currentRecord,

          updateCount:
            0,
        });

      const result =
        await test.store
          .completeRefresh(
            completeInput(),
          );

      expect(
        result.committed,
      ).toBe(
        false,
      );

      const where =
        firstUpdateArgs(
          test.prisma,
        ).where;

      expect(
        where,
      ).toEqual(
        expect.objectContaining({
          authorizedExternalAccountId:
            EXTERNAL_ACCOUNT_ID,
        }),
      );
    });

    it('65. failRefresh from a stale tokenGeneration loses the CAS', async () => {
      const currentRecord =
        dbRecord({
          status:
            'ACTIVE',

          tokenGeneration:
            8,
        });

      const test =
        createHarness({
          record:
            currentRecord,

          updateCount:
            0,
        });

      const result =
        await test.store
          .failRefresh(
            failInput(),
          );

      expect(
        result.committed,
      ).toBe(
        false,
      );

      expect(
        result.current
          ?.tokenGeneration,
      ).toBe(
        8,
      );
    });

    it('66. failRefresh from a stale refreshAttemptId loses the CAS', async () => {
      const currentRecord =
        dbRecord({
          status:
            'REFRESHING',

          refreshAttemptId:
            WINNER_ATTEMPT_ID,

          refreshStartedAt:
            STARTED_AT,
        });

      const test =
        createHarness({
          record:
            currentRecord,

          updateCount:
            0,
        });

      await expect(
        test.store
          .failRefresh(
            failInput(),
          ),
      ).resolves.toEqual({
        committed:
          false,

        current:
          expectedSnapshot(
            currentRecord,
          ),
      });
    });

    it('67. stale REFRESHING failure with a different refreshStartedAt loses the CAS', async () => {
      const currentRecord =
        dbRecord({
          status:
            'REFRESHING',

          refreshAttemptId:
            ATTEMPT_ID,

          refreshStartedAt:
            OTHER_STARTED_AT,
        });

      const test =
        createHarness({
          record:
            currentRecord,

          updateCount:
            0,
        });

      const result =
        await test.store
          .failRefresh(
            failInput({
              expectedRefreshStartedAt:
                STARTED_AT,
            }),
          );

      expect(
        result.committed,
      ).toBe(
        false,
      );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).where,
      ).toEqual(
        expect.objectContaining({
          refreshStartedAt:
            STARTED_AT,
        }),
      );
    });

    it('68. a lost CAS never triggers a compensating mutation', async () => {
      const test =
        createHarness({
          updateCount:
            0,
        });

      await test.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        test.prisma
          .salesChannelCredential
          .updateMany,
      ).toHaveBeenCalledTimes(
        1,
      );

      expect(
        test.prisma
          .salesChannelCredential
          .findUnique,
      ).toHaveBeenCalledTimes(
        1,
      );
    });

    it('69. store source has no Redis or BullMQ dependency', () => {
      loadStoreModule();

      const source =
        readFileSync(
          join(
            __dirname,
            'mercado-livre-prisma-credential.store.ts',
          ),
          'utf8',
        );

      expect(
        source,
      ).not.toMatch(
        /from\s+['"][^'"]*(?:redis|bullmq)[^'"]*['"]/i,
      );

      expect(
        source,
      ).not.toMatch(
        /require\s*\(\s*['"][^'"]*(?:redis|bullmq)[^'"]*['"]\s*\)/i,
      );
    });

    it('70. store source has no sleep polling or retry loop', () => {
      loadStoreModule();

      const source =
        readFileSync(
          join(
            __dirname,
            'mercado-livre-prisma-credential.store.ts',
          ),
          'utf8',
        );

      expect(
        source,
      ).not.toMatch(
        /\bsetTimeout\b|\bsetInterval\b|\bsleep\s*\(|\bwhile\s*\(/,
      );

      expect(
        source,
      ).not.toMatch(
        /\bfor\s*\(\s*;\s*;\s*\)/,
      );
    });
  },
);
describe(
  'MercadoLivrePrismaCredentialStore adversarial audit',
  () => {

    it('71. claim mutation contains only the three fields required to acquire REFRESHING ownership', async () => {
      const test =
        createHarness();

      await test.store
        .tryClaimRefresh(
          claimInput(),
        );

      const data =
        firstUpdateArgs(
          test.prisma,
        ).data;

      expect(
        Object.keys(
          data,
        ).sort(),
      ).toEqual(
        [
          'refreshAttemptId',
          'refreshStartedAt',
          'status',
        ].sort(),
      );
    });

    it('72. claim CAS contains exactly the intended ownership preconditions', async () => {
      const test =
        createHarness();

      await test.store
        .tryClaimRefresh(
          claimInput(),
        );

      const where =
        firstUpdateArgs(
          test.prisma,
        ).where;

      expect(
        Object.keys(
          where,
        ).sort(),
      ).toEqual(
        [
          'refreshAttemptId',
          'refreshStartedAt',
          'salesChannel',
          'salesChannelId',
          'status',
          'tokenGeneration',
        ].sort(),
      );
    });

    it('73. claim rejects an impossible updateMany count greater than one without observational read', async () => {
      const test =
        createHarness({
          updateCount:
            2,
        });

      await expect(
        test.store
          .tryClaimRefresh(
            claimInput(),
          ),
      ).rejects.toThrow();

      expect(
        test.prisma
          .salesChannelCredential
          .findUnique,
      ).not.toHaveBeenCalled();

      expect(
        test.prisma
          .salesChannelCredential
          .updateMany,
      ).toHaveBeenCalledTimes(
        1,
      );
    });

    it('74. lost claim tolerates the credential disappearing before the observational read', async () => {
      const test =
        createHarness({
          record:
            null,

          updateCount:
            0,
        });

      await expect(
        test.store
          .tryClaimRefresh(
            claimInput(),
          ),
      ).resolves.toEqual({
        claimed:
          false,
      });
    });

    it('75. completeRefresh identity relation contains type and externalAccountId but intentionally no channel status', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      const relation =
        firstUpdateArgs(
          test.prisma,
        ).where
          .salesChannel as {
          is?: Record<
            string,
            unknown
          >;
        };

      expect(
        relation,
      ).toEqual({
        is: {
          type:
            'MERCADO_LIVRE',

          externalAccountId:
            EXTERNAL_ACCOUNT_ID,
        },
      });
    });

    it('76. completeRefresh mutation contains the whole new generation and no unrelated field', async () => {
      const test =
        createHarness();

      await test.store
        .completeRefresh(
          completeInput(),
        );

      const data =
        firstUpdateArgs(
          test.prisma,
        ).data;

      expect(
        Object.keys(
          data,
        ).sort(),
      ).toEqual(
        [
          'accessTokenEncrypted',
          'accessTokenExpiresAt',
          'authorizedExternalAccountId',
          'encryptionKeyVersion',
          'lastErrorAt',
          'lastErrorCode',
          'lastRotatedAt',
          'refreshAttemptId',
          'refreshStartedAt',
          'refreshTokenEncrypted',
          'scope',
          'status',
          'tokenGeneration',
          'tokenType',
        ].sort(),
      );
    });

    it('77. completeRefresh rejects reusing the same tokenGeneration before touching Prisma', async () => {
      const test =
        createHarness();

      await expect(
        test.store
          .completeRefresh(
            completeInput({
              newTokenGeneration:
                7,
            }),
          ),
      ).rejects.toThrow();

      expect(
        test.prisma
          .salesChannelCredential
          .updateMany,
      ).not.toHaveBeenCalled();
    });

    it('78. completeRefresh rejects generation regression before touching Prisma', async () => {
      const test =
        createHarness();

      await expect(
        test.store
          .completeRefresh(
            completeInput({
              newTokenGeneration:
                6,
            }),
          ),
      ).rejects.toThrow();

      expect(
        test.prisma
          .salesChannelCredential
          .updateMany,
      ).not.toHaveBeenCalled();
    });

    it('79. completeRefresh rejects unsafe generation overflow before touching Prisma', async () => {
      const test =
        createHarness();

      await expect(
        test.store
          .completeRefresh(
            completeInput({
              expectedTokenGeneration:
                Number.MAX_SAFE_INTEGER,

              newTokenGeneration:
                Number.MAX_SAFE_INTEGER +
                1,
            }),
          ),
      ).rejects.toThrow();

      expect(
        test.prisma
          .salesChannelCredential
          .updateMany,
      ).not.toHaveBeenCalled();
    });

    it('80. completeRefresh rejects an impossible updateMany count greater than one without observational read', async () => {
      const test =
        createHarness({
          updateCount:
            2,
        });

      await expect(
        test.store
          .completeRefresh(
            completeInput(),
          ),
      ).rejects.toThrow();

      expect(
        test.prisma
          .salesChannelCredential
          .findUnique,
      ).not.toHaveBeenCalled();

      expect(
        test.prisma
          .salesChannelCredential
          .updateMany,
      ).toHaveBeenCalledTimes(
        1,
      );
    });

    it('81. completeRefresh conflict tolerates the credential disappearing before the observational read', async () => {
      const test =
        createHarness({
          record:
            null,

          updateCount:
            0,
        });

      await expect(
        test.store
          .completeRefresh(
            completeInput(),
          ),
      ).resolves.toEqual({
        committed:
          false,
      });
    });

    it('82. failRefresh CAS without stale timestamp contains only generation and attempt ownership predicates', async () => {
      const test =
        createHarness();

      await test.store
        .failRefresh(
          failInput(),
        );

      const where =
        firstUpdateArgs(
          test.prisma,
        ).where;

      expect(
        Object.keys(
          where,
        ).sort(),
      ).toEqual(
        [
          'refreshAttemptId',
          'salesChannelId',
          'status',
          'tokenGeneration',
        ].sort(),
      );
    });

    it('83. failRefresh mutation contains only failure metadata and claim cleanup fields', async () => {
      const test =
        createHarness();

      await test.store
        .failRefresh(
          failInput(),
        );

      const data =
        firstUpdateArgs(
          test.prisma,
        ).data;

      expect(
        Object.keys(
          data,
        ).sort(),
      ).toEqual(
        [
          'lastErrorAt',
          'lastErrorCode',
          'refreshAttemptId',
          'refreshStartedAt',
          'status',
        ].sort(),
      );
    });

    it('84. failRefresh intentionally does not depend on current SalesChannel ACTIVE state', async () => {
      const test =
        createHarness();

      await test.store
        .failRefresh(
          failInput(),
        );

      expect(
        firstUpdateArgs(
          test.prisma,
        ).where,
      ).not.toHaveProperty(
        'salesChannel',
      );
    });

    it('85. failRefresh rejects an impossible updateMany count greater than one without observational read', async () => {
      const test =
        createHarness({
          updateCount:
            2,
        });

      await expect(
        test.store
          .failRefresh(
            failInput(),
          ),
      ).rejects.toThrow();

      expect(
        test.prisma
          .salesChannelCredential
          .findUnique,
      ).not.toHaveBeenCalled();

      expect(
        test.prisma
          .salesChannelCredential
          .updateMany,
      ).toHaveBeenCalledTimes(
        1,
      );
    });

    it('86. failRefresh conflict tolerates the credential disappearing before the observational read', async () => {
      const test =
        createHarness({
          record:
            null,

          updateCount:
            0,
        });

      await expect(
        test.store
          .failRefresh(
            failInput(),
          ),
      ).resolves.toEqual({
        committed:
          false,
      });
    });

    it('87. every lost CAS observational read is bound to the same salesChannelId', async () => {
      const claim =
        createHarness({
          updateCount:
            0,
        });

      await claim.store
        .tryClaimRefresh(
          claimInput(),
        );

      expect(
        claim.prisma
          .salesChannelCredential
          .findUnique,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            salesChannelId:
              SALES_CHANNEL_ID,
          },
        }),
      );

      const complete =
        createHarness({
          updateCount:
            0,
        });

      await complete.store
        .completeRefresh(
          completeInput(),
        );

      expect(
        complete.prisma
          .salesChannelCredential
          .findUnique,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            salesChannelId:
              SALES_CHANNEL_ID,
          },
        }),
      );

      const failure =
        createHarness({
          updateCount:
            0,
        });

      await failure.store
        .failRefresh(
          failInput(),
        );

      expect(
        failure.prisma
          .salesChannelCredential
          .findUnique,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            salesChannelId:
              SALES_CHANNEL_ID,
          },
        }),
      );
    });

    it('88. load returns defensive Date copies instead of exposing Prisma record Date references', async () => {
      const refreshStartedAt =
        new Date(
          STARTED_AT,
        );

      const lastErrorAt =
        new Date(
          ERROR_AT,
        );

      const expiresAt =
        new Date(
          EXPIRES_AT,
        );

      const record =
        dbRecord({
          accessTokenExpiresAt:
            expiresAt,

          refreshAttemptId:
            ATTEMPT_ID,

          refreshStartedAt,

          lastErrorCode:
            'synthetic_error',

          lastErrorAt,
        });

      const test =
        createHarness({
          record,
        });

      const result =
        await test.store.load(
          SALES_CHANNEL_ID,
        );

      expect(
        result
          ?.accessTokenExpiresAt,
      ).not.toBe(
        expiresAt,
      );

      expect(
        result
          ?.refreshStartedAt,
      ).not.toBe(
        refreshStartedAt,
      );

      expect(
        result
          ?.lastErrorAt,
      ).not.toBe(
        lastErrorAt,
      );

      expect(
        result
          ?.accessTokenExpiresAt,
      ).toEqual(
        expiresAt,
      );

      expect(
        result
          ?.refreshStartedAt,
      ).toEqual(
        refreshStartedAt,
      );

      expect(
        result
          ?.lastErrorAt,
      ).toEqual(
        lastErrorAt,
      );
    });

    it('89. store source uses only findUnique and updateMany database primitives and opens no independent Prisma connection', () => {
      const source =
        readFileSync(
          join(
            __dirname,
            'mercado-livre-prisma-credential.store.ts',
          ),
          'utf8',
        );

      const findUniqueCalls =
        source.match(
          /\.findUnique\s*\(/g,
        ) ?? [];

      const updateManyCalls =
        source.match(
          /\.updateMany\s*\(/g,
        ) ?? [];

      expect(
        findUniqueCalls,
      ).toHaveLength(
        1,
      );

      expect(
        updateManyCalls,
      ).toHaveLength(
        3,
      );

      expect(
        source,
      ).not.toMatch(
        /\.create\s*\(|\.createMany\s*\(|\.upsert\s*\(|\.delete\s*\(|\.deleteMany\s*\(|\.update\s*\(/,
      );

      expect(
        source,
      ).not.toMatch(
        /\$queryRaw|\$executeRaw|\$transaction|new\s+PrismaClient\s*\(/,
      );
    });

    it('90. completeRefresh rejects non-null after-commit sentinels before touching Prisma', async () => {
      const invalidVariants:
        Array<
          Record<
            string,
            unknown
          >
        > = [
          {
            refreshAttemptIdAfterCommit:
              'should-be-null',
          },

          {
            refreshStartedAtAfterCommit:
              STARTED_AT,
          },

          {
            lastErrorCodeAfterCommit:
              'should-be-null',
          },

          {
            lastErrorAtAfterCommit:
              ERROR_AT,
          },
        ];

      for (
        const override
        of invalidVariants
      ) {
        const test =
          createHarness();

        await expect(
          test.store
            .completeRefresh(
              {
                ...completeInput(),
                ...override,
              } as CompleteRefreshInput,
            ),
        ).rejects.toThrow();

        expect(
          test.prisma
            .salesChannelCredential
            .updateMany,
        ).not.toHaveBeenCalled();
      }
    });
  },
);
