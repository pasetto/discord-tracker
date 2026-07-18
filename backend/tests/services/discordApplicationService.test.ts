import { describe, expect, it } from 'vitest';
import {
  buildDiscordBotInstallUrl,
  formatDiscordBotTokenError,
  validateDiscordApplicationInputFormat,
} from '../../src/services/discordApplicationService';

describe('validateDiscordApplicationInputFormat', () => {
  const validInput = {
    name: 'Meu bot',
    clientId: '1234567890123456789',
    clientSecret: 'abcdefghijklmnopqrstuvwxyz123456',
    botToken: 'MTUxNzU3OTQ4Mjc5NjY1ODgxMA.GA_y8s.TP0mOkBVA66VhKfiNPtqtp0rrQ_MjuHkdi123321',
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

describe('buildDiscordBotInstallUrl', () => {
  it('usa somente scope bot (sem applications.commands) e permissões de monitoramento', () => {
    const url = buildDiscordBotInstallUrl('123456789012345678', 'org-1');
    const parsed = new URL(url);
    const scope = parsed.searchParams.get('scope');

    expect(parsed.origin + parsed.pathname).toBe('https://discord.com/api/oauth2/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('123456789012345678');
    expect(parsed.searchParams.get('permissions')).toBe('36818496');
    expect(parsed.searchParams.get('state')).toBe('org-1');
    expect(scope).toBe('bot');
    expect(scope).not.toContain('applications.commands');
  });
});
