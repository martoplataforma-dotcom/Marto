import { Module } from '@nestjs/common';
import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';

import {
  SalesChannelCredentialConfigKeyring,
} from './sales-channel-credential-config.keyring';

import {
  SalesChannelCredentialCryptoService,
  type SalesChannelCredentialKeyring,
} from './sales-channel-credential-crypto.service';

import {
  SALES_CHANNEL_CREDENTIAL_KEYRING,
} from './sales-channel-credential.tokens';

const CURRENT_KEY_VERSION_CONFIG =
  'MARTO_CREDENTIAL_ENCRYPTION_CURRENT_KEY_VERSION';

const KEYS_CONFIG =
  'MARTO_CREDENTIAL_ENCRYPTION_KEYS';

@Module({
  imports: [
    ConfigModule,
  ],

  providers: [
    {
      provide:
        SALES_CHANNEL_CREDENTIAL_KEYRING,

      inject: [
        ConfigService,
      ],

      useFactory: (
        configService: ConfigService,
      ): SalesChannelCredentialKeyring =>
        new SalesChannelCredentialConfigKeyring({
          currentKeyVersion:
            configService.get<string>(
              CURRENT_KEY_VERSION_CONFIG,
            ),

          serializedKeys:
            configService.get<string>(
              KEYS_CONFIG,
            ),
        }),
    },

    {
      provide:
        SalesChannelCredentialCryptoService,

      inject: [
        SALES_CHANNEL_CREDENTIAL_KEYRING,
      ],

      useFactory: (
        keyring:
          SalesChannelCredentialKeyring,
      ): SalesChannelCredentialCryptoService =>
        new SalesChannelCredentialCryptoService(
          keyring,
        ),
    },
  ],

  exports: [
    SALES_CHANNEL_CREDENTIAL_KEYRING,
    SalesChannelCredentialCryptoService,
  ],
})
export class SalesChannelCredentialModule {}
