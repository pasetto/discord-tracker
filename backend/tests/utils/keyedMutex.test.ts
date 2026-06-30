import { describe, expect, it } from 'vitest';
import { createKeyedMutex } from '../../src/utils/keyedMutex';

/**
 * Aguarda um número de milissegundos.
 * @param ms Milissegundos
 * @returns Promise resolvida após o tempo
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('createKeyedMutex', () => {
  it('serializa execuções para a mesma chave (sem sobreposição)', async () => {
    const mutex = createKeyedMutex();
    const events: string[] = [];

    const task = (id: string) =>
      mutex.runExclusive('user-1', async () => {
        events.push(`start-${id}`);
        await delay(20);
        events.push(`end-${id}`);
      });

    await Promise.all([task('a'), task('b')]);

    // A segunda só pode começar depois que a primeira terminou.
    expect(events).toEqual(['start-a', 'end-a', 'start-b', 'end-b']);
  });

  it('permite execução concorrente para chaves diferentes', async () => {
    const mutex = createKeyedMutex();
    const events: string[] = [];

    const task = (key: string, id: string) =>
      mutex.runExclusive(key, async () => {
        events.push(`start-${id}`);
        await delay(20);
        events.push(`end-${id}`);
      });

    await Promise.all([task('user-1', 'a'), task('user-2', 'b')]);

    // Ambas começam antes de qualquer uma terminar.
    expect(events.slice(0, 2).sort()).toEqual(['start-a', 'start-b']);
  });

  it('libera a chave mesmo quando a tarefa lança erro', async () => {
    const mutex = createKeyedMutex();

    await expect(
      mutex.runExclusive('user-1', async () => {
        throw new Error('falha');
      }),
    ).rejects.toThrow('falha');

    // A chave deve estar livre para uma nova execução bem-sucedida.
    const result = await mutex.runExclusive('user-1', async () => 'ok');
    expect(result).toBe('ok');
  });

  it('propaga o valor de retorno da tarefa', async () => {
    const mutex = createKeyedMutex();
    const value = await mutex.runExclusive('k', async () => 42);
    expect(value).toBe(42);
  });
});
