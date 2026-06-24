import { User, IUser } from '../db/models/User';

/**
 * Dados para upsert de usuário Discord.
 */
export interface UpsertUserData {
  discordId: string;
  username: string;
  displayName: string;
}

/**
 * Repositório de acesso a dados de usuários.
 */
export const userRepository = {
  /**
   * Busca usuário pelo ID Discord.
   * @param discordId ID do usuário no Discord
   * @returns Documento do usuário ou null
   */
  async findByDiscordId(discordId: string): Promise<IUser | null> {
    return User.findOne({ discordId });
  },

  /**
   * Cria ou atualiza um usuário com base no ID Discord.
   * @param data Dados do usuário
   * @returns Documento persistido
   */
  async upsert(data: UpsertUserData): Promise<IUser> {
    const now = new Date();
    return User.findOneAndUpdate(
      { discordId: data.discordId },
      {
        $set: {
          username: data.username,
          displayName: data.displayName,
          lastSeenAt: now,
        },
        $setOnInsert: {
          discordId: data.discordId,
          firstSeenAt: now,
        },
      },
      { upsert: true, new: true },
    );
  },

  /**
   * Conta total de usuários cadastrados.
   * @returns Quantidade de usuários
   */
  async countAll(): Promise<number> {
    return User.countDocuments();
  },

  /**
   * Lista todos os usuários.
   * @returns Array de usuários
   */
  async findAll(): Promise<IUser[]> {
    return User.find().sort({ username: 1 });
  },
};
