import {
  Module,
} from '@nestjs/common';

import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';

import {
  randomUUID,
} from 'node:crypto';

import {
  PrismaModule,
} from '../../../common/prisma/prisma.module';

import {
  PrismaService,
} from '../../../common/prisma/prisma.service';

import {
  SalesChannelCredentialModule,
} from '../credentials/sales-channel-credential.module';

import {
  SalesChannelCredentialCryptoService,
} from '../credentials/sales-channel-credential-crypto.service';

import {
  MercadoLivreAccessTokenCoordinator,
  type MercadoLivreAccessTokenCoordinatorConfig,
  type MercadoLivreCredentialClock,
  type MercadoLivreRefreshAttemptIdGenerator,
} from './mercado-livre-access-token-coordinator';

import {
  MercadoLivreOAuthClient,
} from './mercado-livre.oauth-client';

import {
  MercadoLivreOAuthFetchTransport,
} from './mercado-livre.oauth-fetch-transport';

import {
  MercadoLivrePrismaCredentialStore,
  type MercadoLivreCredentialPrismaClient,
} from './mercado-livre-prisma-credential.store';

export const
MERCADO_LIVRE_CREDENTIAL_CLOCK =
  Symbol(
    'MERCADO_LIVRE_CREDENTIAL_CLOCK',
  );

export const
MERCADO_LIVRE_REFRESH_ATTEMPT_ID_GENERATOR =
  Symbol(
    'MERCADO_LIVRE_REFRESH_ATTEMPT_ID_GENERATOR',
  );

export const
MERCADO_LIVRE_ACCESS_TOKEN_COORDINATOR_CONFIG =
  Symbol(
    'MERCADO_LIVRE_ACCESS_TOKEN_COORDINATOR_CONFIG',
  );

const CLIENT_ID_CONFIG =
  'MARTO_MERCADO_LIVRE_CLIENT_ID';

const CLIENT_SECRET_CONFIG =
  'MARTO_MERCADO_LIVRE_CLIENT_SECRET';

const REFRESH_SAFETY_WINDOW_MS_CONFIG =
  'MARTO_MERCADO_LIVRE_REFRESH_SAFETY_WINDOW_MS';

const TRANSIENT_RETRY_DELAY_MS_CONFIG =
  'MARTO_MERCADO_LIVRE_TRANSIENT_RETRY_DELAY_MS';

const REFRESH_STALE_AFTER_MS_CONFIG =
  'MARTO_MERCADO_LIVRE_REFRESH_STALE_AFTER_MS';

const CONFIG_INVALID_ERROR =
  'mercado_livre_runtime_config_invalid';

function readExactNonBlank(
  configService:
    ConfigService,

  key:
    string,
): string {
  const value =
    configService.get<string>(
      key,
    );

  if (
    typeof value !==
      'string' ||
    value.length === 0 ||
    value.trim().length === 0 ||
    value.trim() !== value
  ) {
    throw new Error(
      CONFIG_INVALID_ERROR,
    );
  }

  return value;
}

function readMilliseconds(
  configService:
    ConfigService,

  key:
    string,

  allowZero:
    boolean,
): number {
  const raw =
    configService.get<string>(
      key,
    );

  if (
    typeof raw !==
      'string' ||
    !/^(?:0|[1-9][0-9]*)$/.test(
      raw,
    )
  ) {
    throw new Error(
      CONFIG_INVALID_ERROR,
    );
  }

  const value =
    Number(raw);

  if (
    !Number.isSafeInteger(
      value,
    ) ||
    (
      allowZero
        ? value < 0
        : value <= 0
    )
  ) {
    throw new Error(
      CONFIG_INVALID_ERROR,
    );
  }

  return value;
}

function createCoordinatorConfig(
  configService:
    ConfigService,
): MercadoLivreAccessTokenCoordinatorConfig {
  return {
    clientId:
      readExactNonBlank(
        configService,
        CLIENT_ID_CONFIG,
      ),

    clientSecret:
      readExactNonBlank(
        configService,
        CLIENT_SECRET_CONFIG,
      ),

    refreshSafetyWindowMs:
      readMilliseconds(
        configService,
        REFRESH_SAFETY_WINDOW_MS_CONFIG,
        true,
      ),

    transientRetryDelayMs:
      readMilliseconds(
        configService,
        TRANSIENT_RETRY_DELAY_MS_CONFIG,
        true,
      ),

    refreshStaleAfterMs:
      readMilliseconds(
        configService,
        REFRESH_STALE_AFTER_MS_CONFIG,
        false,
      ),
  };
}

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    SalesChannelCredentialModule,
  ],

  providers: [
    {
      provide:
        MercadoLivrePrismaCredentialStore,

      inject: [
        PrismaService,
      ],

      useFactory: (
        prisma:
          PrismaService,
      ): MercadoLivrePrismaCredentialStore =>
        new MercadoLivrePrismaCredentialStore(
          prisma as unknown as
            MercadoLivreCredentialPrismaClient,
        ),
    },

    {
      provide:
        MercadoLivreOAuthFetchTransport,

      useFactory:
        (): MercadoLivreOAuthFetchTransport =>
          new MercadoLivreOAuthFetchTransport(),
    },

    {
      provide:
        MercadoLivreOAuthClient,

      inject: [
        MercadoLivreOAuthFetchTransport,
      ],

      useFactory: (
        transport:
          MercadoLivreOAuthFetchTransport,
      ): MercadoLivreOAuthClient =>
        new MercadoLivreOAuthClient(
          transport,
        ),
    },

    {
      provide:
        MERCADO_LIVRE_CREDENTIAL_CLOCK,

      useFactory:
        (): MercadoLivreCredentialClock => ({
          now:
            (): Date =>
              new Date(),
        }),
    },

    {
      provide:
        MERCADO_LIVRE_REFRESH_ATTEMPT_ID_GENERATOR,

      useFactory:
        (): MercadoLivreRefreshAttemptIdGenerator => ({
          generate:
            (): string =>
              randomUUID(),
        }),
    },

    {
      provide:
        MERCADO_LIVRE_ACCESS_TOKEN_COORDINATOR_CONFIG,

      inject: [
        ConfigService,
      ],

      useFactory:
        createCoordinatorConfig,
    },

    {
      provide:
        MercadoLivreAccessTokenCoordinator,

      inject: [
        MercadoLivrePrismaCredentialStore,
        SalesChannelCredentialCryptoService,
        MercadoLivreOAuthClient,
        MERCADO_LIVRE_CREDENTIAL_CLOCK,
        MERCADO_LIVRE_REFRESH_ATTEMPT_ID_GENERATOR,
        MERCADO_LIVRE_ACCESS_TOKEN_COORDINATOR_CONFIG,
      ],

      useFactory: (
        store:
          MercadoLivrePrismaCredentialStore,

        crypto:
          SalesChannelCredentialCryptoService,

        oauthClient:
          MercadoLivreOAuthClient,

        clock:
          MercadoLivreCredentialClock,

        refreshAttemptIdGenerator:
          MercadoLivreRefreshAttemptIdGenerator,

        config:
          MercadoLivreAccessTokenCoordinatorConfig,
      ): MercadoLivreAccessTokenCoordinator =>
        new MercadoLivreAccessTokenCoordinator({
          store,
          crypto,
          oauthClient,
          clock,
          refreshAttemptIdGenerator,
          config,
        }),
    },
  ],

  exports: [
    MercadoLivreAccessTokenCoordinator,
  ],
})
export class
MercadoLivreCredentialRuntimeModule {}