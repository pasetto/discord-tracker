import { afterEach, describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from '../../src/services/encryptionService';

const originalEncryptionKey = process.env.ENCRYPTION_KEY;

describe('encryptionService', () => {
  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });

  it('criptografa e descriptografa segredo com a mesma chave', () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 'a').toString('base64');

    const encrypted = encryptSecret('discord-secret');
    const decrypted = decryptSecret(encrypted);

    expect(encrypted.split(':')).toHaveLength(3);
    expect(decrypted).toBe('discord-secret');
  });

  it('falha quando ENCRYPTION_KEY não está definida', () => {
    delete process.env.ENCRYPTION_KEY;

    expect(() => encryptSecret('value')).toThrow(
      'ENCRYPTION_KEY é obrigatório para criptografar credenciais do Discord',
    );
  });

  it('falha quando ENCRYPTION_KEY não possui 32 bytes em base64', () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(16, 'b').toString('base64');

    expect(() => encryptSecret('value')).toThrow('ENCRYPTION_KEY deve ser base64 de 32 bytes');
  });

  it('falha quando payload criptografado é inválido', () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 'c').toString('base64');

    expect(() => decryptSecret('invalid')).toThrow('Payload criptografado inválido');
  });
});
