import {
  Module,
} from '@nestjs/common';

import {
  ConditionalModule,
} from '@nestjs/config';

import {
  MercadoLivreCredentialRuntimeModule,
} from './mercado-livre-credential-runtime.module';

export const
MARTO_MERCADO_LIVRE_ENABLED =
  'MARTO_MERCADO_LIVRE_ENABLED';

const ACTIVATION_CONFIG_INVALID =
  'mercado_livre_activation_config_invalid';

function shouldEnableMercadoLivre(
  env:
    NodeJS.ProcessEnv,
): boolean {
  const value =
    env[
      MARTO_MERCADO_LIVRE_ENABLED
    ];

  if (
    value === undefined ||
    value === 'false'
  ) {
    return false;
  }

  if (value === 'true') {
    return true;
  }

  throw new Error(
    ACTIVATION_CONFIG_INVALID,
  );
}

@Module({
  imports: [
    ConditionalModule.registerWhen(
      MercadoLivreCredentialRuntimeModule,
      shouldEnableMercadoLivre,
      {
        debug:
          false,
      },
    ),
  ],
})
export class
MercadoLivreActivationModule {}