import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

export type SalesChannelCredentialEncryptionKey = {
  version: string;
  key: Buffer;
};

export type SalesChannelCredentialKeyring = {
  current(): SalesChannelCredentialEncryptionKey;
  resolve(version: string): Buffer | undefined;
};

export type SalesChannelCredentialEncryptResult = {
  encryptedValue: string;
  keyVersion: string;
};

export type SalesChannelCredentialDecryptInput = {
  encryptedValue: string;
  keyVersion: string;
};

const ALGORITHM = 'aes-256-gcm';
const ENVELOPE_VERSION = 'v1';

const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;

const AUTHENTICATED_CONTEXT = Buffer.from(
  'marto:sales-channel-credential:v1',
  'utf8',
);

export class SalesChannelCredentialCryptoService {
  constructor(
    private readonly keyring: SalesChannelCredentialKeyring,
  ) {
    const current = this.keyring.current();

    this.assertKeyVersion(current.version);
    this.assertKeyMaterial(current.key);
  }

  encrypt(
    plaintext: string,
  ): SalesChannelCredentialEncryptResult {
    if (typeof plaintext !== 'string' || plaintext.length === 0) {
      throw new Error('credential_plaintext_required');
    }

    const current = this.keyring.current();

    this.assertKeyVersion(current.version);
    this.assertKeyMaterial(current.key);

    const nonce = randomBytes(NONCE_BYTES);

    const cipher = createCipheriv(
      ALGORITHM,
      current.key,
      nonce,
      {
        authTagLength: AUTH_TAG_BYTES,
      },
    );

    cipher.setAAD(AUTHENTICATED_CONTEXT);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authenticationTag =
      cipher.getAuthTag();

    return {
      encryptedValue: [
        ENVELOPE_VERSION,
        nonce.toString('base64url'),
        ciphertext.toString('base64url'),
        authenticationTag.toString('base64url'),
      ].join('.'),

      keyVersion: current.version,
    };
  }

  decrypt(
    input: SalesChannelCredentialDecryptInput,
  ): string {
    const key =
      this.keyring.resolve(input.keyVersion);

    if (!key) {
      throw new Error(
        'credential_encryption_key_not_found',
      );
    }

    this.assertKeyMaterial(key);

    try {
      const parts =
        input.encryptedValue.split('.');

      if (
        parts.length !== 4 ||
        parts[0] !== ENVELOPE_VERSION
      ) {
        throw new Error('invalid_envelope');
      }

      const noncePart = parts[1];
      const ciphertextPart = parts[2];
      const tagPart = parts[3];

      if (
        !this.isBase64Url(noncePart) ||
        !this.isBase64Url(ciphertextPart) ||
        !this.isBase64Url(tagPart)
      ) {
        throw new Error('invalid_envelope');
      }

      const nonce =
        Buffer.from(noncePart, 'base64url');

      const ciphertext =
        Buffer.from(
          ciphertextPart,
          'base64url',
        );

      const authenticationTag =
        Buffer.from(tagPart, 'base64url');

      if (
        nonce.length !== NONCE_BYTES ||
        ciphertext.length === 0 ||
        authenticationTag.length !==
          AUTH_TAG_BYTES
      ) {
        throw new Error('invalid_envelope');
      }

      const decipher = createDecipheriv(
        ALGORITHM,
        key,
        nonce,
        {
          authTagLength: AUTH_TAG_BYTES,
        },
      );

      decipher.setAAD(
        AUTHENTICATED_CONTEXT,
      );

      decipher.setAuthTag(
        authenticationTag,
      );

      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return plaintext.toString('utf8');
    } catch {
      throw new Error(
        'credential_decryption_failed',
      );
    }
  }

  private assertKeyMaterial(
    key: Buffer,
  ): void {
    if (
      !Buffer.isBuffer(key) ||
      key.length !== KEY_BYTES
    ) {
      throw new Error(
        'credential_encryption_key_invalid',
      );
    }
  }

  private assertKeyVersion(
    version: string,
  ): void {
    if (
      typeof version !== 'string' ||
      version.trim().length === 0
    ) {
      throw new Error(
        'credential_encryption_key_invalid',
      );
    }
  }

  private isBase64Url(
    value: string,
  ): boolean {
    return (
      value.length > 0 &&
      /^[A-Za-z0-9_-]+$/.test(value)
    );
  }
}
