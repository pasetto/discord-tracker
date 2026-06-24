import { TestBed } from '@angular/core/testing';
import { DashboardLiveSnapshot, LiveActivitySocketService, LiveVoiceTransitionEvent } from './live-activity-socket.service';

/** Mock de WebSocket para testes do serviço em tempo real. */
class MockWebSocket {
  static readonly OPEN = 1;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readonly sent: string[] = [];

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(): void {
    this.readyState = 3;
  }

  /** Dispara mensagem recebida do servidor simulado. */
  emitMessage(data: string): void {
    this.onmessage?.({ data });
  }
}

describe('LiveActivitySocketService', () => {
  let service: LiveActivitySocketService;
  const globalScope = globalThis as unknown as { WebSocket: typeof WebSocket };
  const originalWebSocket = globalScope.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    globalScope.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    jasmine.clock().install();

    TestBed.configureTestingModule({});
    service = TestBed.inject(LiveActivitySocketService);
  });

  afterEach(() => {
    service.ngOnDestroy();
    jasmine.clock().uninstall();
    globalScope.WebSocket = originalWebSocket;
  });

  it('conecta e envia subscribe para o guild monitorado', () => {
    service.connect('org-1', 'guild-1', 'jwt-token');

    const socket = MockWebSocket.instances[0];
    expect(socket.url).toContain('/api/v1/ws/live?token=');
    socket.onopen?.();
    expect(socket.sent[0]).toContain('"type":"subscribe"');
    expect(socket.sent[0]).toContain('"organizationId":"org-1"');
  });

  it('emite snapshot e transição ao receber mensagens válidas', () => {
    const snapshots: DashboardLiveSnapshot[] = [];
    const transitions: LiveVoiceTransitionEvent[] = [];

    service.snapshot$.subscribe((snapshot) => snapshots.push(snapshot));
    service.transition$.subscribe((transition) => transitions.push(transition));

    service.connect('org-1', 'guild-1', 'jwt-token');
    const socket = MockWebSocket.instances[0];
    socket.onopen?.();

    socket.emitMessage(
      JSON.stringify({
        type: 'snapshot',
        data: {
          generatedAt: '2026-06-24T12:00:00.000Z',
          guildId: 'guild-1',
          guildName: 'Servidor',
          activeCount: 1,
          activeMembers: [],
          onlineRanking: [],
          recentTransitions: [],
        },
      }),
    );

    socket.emitMessage(
      JSON.stringify({
        type: 'transition',
        data: {
          organizationId: 'org-1',
          guildId: 'guild-1',
          discordId: '1',
          displayName: 'Ana',
          eventType: 'JOIN',
          fromIgnored: false,
          toIgnored: false,
          countsAsCollaboration: true,
          occurredAt: '2026-06-24T12:00:00.000Z',
        },
      }),
    );

    expect(snapshots.length).toBe(1);
    expect(transitions.length).toBe(1);
  });

  it('emite erro para payload inválido ou mensagem de erro do servidor', () => {
    const errors: string[] = [];
    service.error$.subscribe((message) => errors.push(message));

    service.connect('org-1', 'guild-1', 'jwt-token');
    const socket = MockWebSocket.instances[0];
    socket.emitMessage('not-json');
    socket.emitMessage(JSON.stringify({ type: 'error', message: 'Falha no subscribe' }));

    expect(errors).toContain('Resposta inválida do servidor em tempo real.');
    expect(errors).toContain('Falha no subscribe');
  });

  it('marca conexão ativa após confirmação de subscribe', () => {
    const states: boolean[] = [];
    service.connected$.subscribe((connected) => states.push(connected));

    service.connect('org-1', 'guild-1', 'jwt-token');
    const socket = MockWebSocket.instances[0];
    socket.emitMessage(JSON.stringify({ type: 'subscribed', organizationId: 'org-1', guildId: 'guild-1' }));

    expect(states).toContain(true);
  });

  it('reconecta automaticamente após desconexão inesperada', () => {
    service.connect('org-1', 'guild-1', 'jwt-token');
    const firstSocket = MockWebSocket.instances[0];
    firstSocket.onclose?.();

    jasmine.clock().tick(5_000);

    expect(MockWebSocket.instances.length).toBe(2);
  });

  it('encerra conexão e limpa contexto ao desconectar', () => {
    service.connect('org-1', 'guild-1', 'jwt-token');
    const socket = MockWebSocket.instances[0];

    service.disconnect();

    expect(socket.onclose).toBeNull();
    expect(MockWebSocket.instances[0].readyState).toBe(3);
  });
});
