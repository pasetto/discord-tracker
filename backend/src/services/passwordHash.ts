import bcrypt from 'bcryptjs';

/** Custo do bcrypt para hash de senha. */
export const PASSWORD_SALT_ROUNDS = 12;

/** Comprimento mínimo aceito para senhas de usuários da plataforma. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Gera hash bcrypt para senha em texto puro.
 * @param password Senha informada pelo usuário
 * @returns Hash persistível no banco
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

/**
 * Compara senha informada com hash armazenado.
 * @param password Senha em texto puro
 * @param passwordHash Hash salvo no banco
 * @returns `true` quando a senha confere
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
