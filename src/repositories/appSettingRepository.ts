import { AppSetting } from '../db/models/AppSetting';

/**
 * Repositório de configurações persistidas da aplicação.
 */
export const appSettingRepository = {
  /**
   * Obtém o valor de uma configuração pela chave.
   * @param key Identificador único da configuração
   * @returns Valor armazenado ou null quando ausente
   */
  async get(key: string): Promise<string | null> {
    const doc = await AppSetting.findOne({ key }).lean();
    return doc?.value ?? null;
  },

  /**
   * Persiste ou atualiza uma configuração.
   * @param key Identificador único da configuração
   * @param value Valor a ser salvo
   * @returns Documento atualizado
   */
  async set(key: string, value: string) {
    return AppSetting.findOneAndUpdate(
      { key },
      { value },
      { upsert: true, new: true },
    );
  },
};
