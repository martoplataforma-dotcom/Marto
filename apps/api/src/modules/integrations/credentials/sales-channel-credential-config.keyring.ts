import type {
  SalesChannelCredentialEncryptionKey,
  SalesChannelCredentialKeyring,
} from './sales-channel-credential-crypto.service';

export type SalesChannelCredentialConfigKeyringInput = {
  currentKeyVersion?: string;
  serializedKeys?: string;
};

const KEY_BYTES = 32;

const CONFIG_INVALID_ERROR =
  'credential_keyring_config_invalid';

const CURRENT_KEY_NOT_FOUND_ERROR =
  'credential_keyring_current_key_not_found';

export class SalesChannelCredentialConfigKeyring
  implements SalesChannelCredentialKeyring
{
  private readonly currentKeyVersion: string;

  private readonly keys: Map<string, Buffer>;

  constructor(
    input: SalesChannelCredentialConfigKeyringInput = {},
  ) {
    this.currentKeyVersion =
      this.parseCurrentKeyVersion(
        input.currentKeyVersion,
      );

    this.keys =
      this.parseKeys(
        input.serializedKeys,
      );

    if (!this.keys.has(this.currentKeyVersion)) {
      throw new Error(
        CURRENT_KEY_NOT_FOUND_ERROR,
      );
    }
  }

  current(): SalesChannelCredentialEncryptionKey {
    const key =
      this.keys.get(this.currentKeyVersion);

    if (!key) {
      throw new Error(
        CURRENT_KEY_NOT_FOUND_ERROR,
      );
    }

    return {
      version: this.currentKeyVersion,
      key: Buffer.from(key),
    };
  }

  resolve(
    version: string,
  ): Buffer | undefined {
    const key =
      this.keys.get(version);

    if (!key) {
      return undefined;
    }

    return Buffer.from(key);
  }

  private parseCurrentKeyVersion(
    value: string | undefined,
  ): string {
    if (
      typeof value !== 'string' ||
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

  private parseKeys(
    serializedKeys: string | undefined,
  ): Map<string, Buffer> {
    if (
      typeof serializedKeys !== 'string' ||
      serializedKeys.trim().length === 0
    ) {
      throw new Error(
        CONFIG_INVALID_ERROR,
      );
    }

    let parsed: unknown;

    try {
      parsed =
        JSON.parse(serializedKeys);
    } catch {
      throw new Error(
        CONFIG_INVALID_ERROR,
      );
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error(
        CONFIG_INVALID_ERROR,
      );
    }

    const entries =
      Object.entries(
        parsed as Record<string, unknown>,
      );

    if (entries.length === 0) {
      throw new Error(
        CONFIG_INVALID_ERROR,
      );
    }

    const keys =
      new Map<string, Buffer>();

    for (const [version, encodedKey] of entries) {
      if (
        version.length === 0 ||
        version.trim().length === 0 ||
        version.trim() !== version
      ) {
        throw new Error(
          CONFIG_INVALID_ERROR,
        );
      }

      if (
        typeof encodedKey !== 'string' ||
        !this.isCanonicalBase64(encodedKey)
      ) {
        throw new Error(
          CONFIG_INVALID_ERROR,
        );
      }

      const key =
        Buffer.from(
          encodedKey,
          'base64',
        );

      if (key.length !== KEY_BYTES) {
        throw new Error(
          CONFIG_INVALID_ERROR,
        );
      }

      keys.set(
        version,
        Buffer.from(key),
      );
    }

    return keys;
  }

  private isCanonicalBase64(
    value: string,
  ): boolean {
    if (
      value.length === 0 ||
      value.length % 4 !== 0
    ) {
      return false;
    }

    if (
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        value,
      )
    ) {
      return false;
    }

    let decoded: Buffer;

    try {
      decoded =
        Buffer.from(
          value,
          'base64',
        );
    } catch {
      return false;
    }

    return (
      decoded.toString('base64') === value
    );
  }
}
