/**
 * Mutex por chave: serializa execuções assíncronas que compartilham a mesma
 * chave, permitindo paralelismo entre chaves distintas.
 */
export interface KeyedMutex {
  /**
   * Executa a tarefa com exclusão mútua por chave.
   * @param key Chave de serialização (ex.: usuário/guild)
   * @param task Função assíncrona a executar
   * @returns Promise com o resultado da tarefa
   */
  runExclusive<T>(key: string, task: () => Promise<T>): Promise<T>;
}

/**
 * Cria um mutex por chave em memória.
 *
 * Útil para evitar corridas quando múltiplos eventos do mesmo usuário chegam
 * quase simultâneos (ex.: várias trocas de canal de voz), garantindo que o
 * fluxo "fechar sessões abertas + abrir nova" rode atomicamente por usuário.
 * @returns Instância de {@link KeyedMutex}
 * @example
 * const mutex = createKeyedMutex();
 * await mutex.runExclusive(`${guildId}:${userId}`, () => processarEvento());
 */
export function createKeyedMutex(): KeyedMutex {
  const tails = new Map<string, Promise<unknown>>();

  return {
    async runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
      const previous = tails.get(key) ?? Promise.resolve();

      // Encadeia após a tarefa anterior; o catch evita que um erro anterior
      // bloqueie ou contamine a próxima execução da mesma chave.
      const run = previous.catch(() => undefined).then(() => task());

      // A cauda armazenada nunca rejeita, para encadear a próxima com segurança.
      const settled = run.then(
        () => undefined,
        () => undefined,
      );
      tails.set(key, settled);

      try {
        return await run;
      } finally {
        // Libera a entrada quando nenhuma execução mais recente assumiu a fila.
        if (tails.get(key) === settled) {
          tails.delete(key);
        }
      }
    },
  };
}
