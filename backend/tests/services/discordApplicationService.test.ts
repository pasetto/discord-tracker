import { describe, expect, it } from 'vitest';
import {
  formatDiscordBotTokenError,
  validateDiscordApplicationInputFormat,
} from '../../src/services/discordApplicationService';

describe('validateDiscordApplicationInputFormat', () => {
  const validInput = {
    name: 'Meu bot',
    clientId: '1234567890123456789',
    clientSecret: 'abcdefghijklmnopqrstuvwxyz123456',
    botToken: 'MTUxNzU3OTQ4Mjc5NjY1ODgxMA.GA_y8s.TP0mOkBVA66VhKfiNPtqtp0rrQ_MjuHkdi6aRE',
  };

  it('aceita credenciais com formato válido do Discord', () => {
    expect(() => validateDiscordApplicationInputFormat(validInput)).not.toThrow();
  });

  it('rejeita clientId que não é snowflake numérico', () => {
    expect(() =>
      validateDiscordApplicationInputFormat({ ...validInput, clientId: 'ula@ula.com' }),
    ).toThrow(/Client ID inválido/);
  });

  it('rejeita bot token curto ou sem formato de token', () => {
    expect(() => validateDiscordApplicationInputFormat({ ...validInput, botToken: '123' })).toThrow(
      /Bot Token inválido/,
    );
  });

  it('rejeita client secret muito curto', () => {
    expect(() => validateDiscordApplicationInputFormat({ ...validInput, clientSecret: '1234' })).toThrow(
      /Client Secret inválido/,
    );
  });
});

describe('formatDiscordBotTokenError', () => {
  it('traduz 401 para mensagem amigável em português', () => {
    const message = formatDiscordBotTokenError(401, '{"message":"401: Unauthorized"}');
    expect(message).toContain('401 Unauthorized');
    expect(message).toContain('Bot Token');
  });
});
