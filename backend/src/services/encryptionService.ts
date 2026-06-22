import crypto from 'node:crypto';

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Carrega a chave de criptografia AES-256-GCM a partir de ENCRYPTION_KEY.
 * @returns Buffer com 32 bytes da chave
 * @throws {Error} Quando a variável não está definida ou é inválida
 */
function getEncryptionKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('ENCRYPTION_KEY é obrigatório para criptografar credenciais do Discord');
  }

  let decodedKey: Buffer;
  try {
    decodedKey = Buffer.from(rawKey, 'base64');
  } catch (error) {
    throw new Error(`ENCRYPTION_KEY inválido: ${(error as Error).message}`);
  }

  if (decodedKey.length !== 32) {
    throw new Error('ENCRYPTION_KEY deve ser base64 de 32 bytes');
  }

  return decodedKey;
}

/**
 * Criptografa um segredo usando AES-256-GCM.
 * @param plaintext Valor em texto puro
 * @returns Valor cifrado no formato base64 `iv:authTag:cipherText`
 */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Descriptografa um segredo cifrado por `encryptSecret`.
 * @param encryptedValue Valor cifrado no formato `iv:authTag:cipherText`
 * @returns Valor em texto puro
 * @throws {Error} Quando o payload não é válido ou falha autenticação GCM
 */
export function decryptSecret(encryptedValue: string): string {
  const [ivBase64, authTagBase64, cipherTextBase64] = encryptedValue.split(':');
  if (!ivBase64 || !authTagBase64 || !cipherTextBase64) {
    throw new Error('Payload criptografado inválido');
  }

  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const cipherText = Buffer.from(cipherTextBase64, 'base64');
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, getEncryptionKey(), iv);

  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return decrypted.toString('utf8');
}
