import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import { URL } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { createLogger } from '../../logger';
import { GuildConnectionModel } from '../../db/models/GuildConnection';
import { verifyAccessToken } from '../../services/authService';
import { getGuildLiveDashboard } from '../../services/dashboardLiveService';
import {
  liveActivityBroadcaster,
  type LiveActivityClientMessage,
  type LiveActivityServerMessage,
} from '../../services/liveActivityBroadcaster';
import { assertOrgMembership } from '../middleware/tenant';

const log = createLogger('ws-live');
const WS_PATH = '/api/v1/ws/live';

interface LiveSocketState {
  userId: string;
  payload?: ReturnType<typeof verifyAccessToken>;
  unsubscribe?: () => void;
  subscribedOrgId?: string;
  subscribedGuildId?: string;
}

/**
 * Anexa servidor WebSocket de atividade ao vivo no HTTP server existente.
 * @param server Servidor HTTP compartilhado com Koa
 */
export function attachLiveActivityWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '', `http://${request.headers.host ?? 'localhost'}`).pathname;
    if (pathname !== WS_PATH) {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    void handleConnection(ws, request);
  });

  log.info({ path: WS_PATH }, 'WebSocket de atividade ao vivo registrado');
}

/**
 * Processa conexão WebSocket autenticada por JWT.
 * @param ws Conexão WebSocket
 * @param request Requisição HTTP de upgrade
 */
async function handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
  const state: LiveSocketState = { userId: '' };

  try {
    const token = extractToken(request);
    const payload = verifyAccessToken(token);
    state.userId = payload.id;
    state.payload = payload;
    sendMessage(ws, { type: 'connected' });
  } catch (error) {
    log.warn({ err: error }, 'Falha na autenticação WebSocket');
    sendMessage(ws, { type: 'error', message: 'Token inválido ou expirado' });
    ws.close(4401, 'Unauthorized');
    return;
  }

  ws.on('message', (raw) => {
    void handleClientMessage(ws, state, raw.toString());
  });

  ws.on('close', () => {
    state.unsubscribe?.();
  });
}

/**
 * Processa mensagens do cliente (subscribe / ping).
 * @param ws Conexão WebSocket
 * @param state Estado da conexão
 * @param raw Payload JSON recebido
 */
async function handleClientMessage(ws: WebSocket, state: LiveSocketState, raw: string): Promise<void> {
  let message: LiveActivityClientMessage;
  try {
    message = JSON.parse(raw) as LiveActivityClientMessage;
  } catch {
    sendMessage(ws, { type: 'error', message: 'JSON inválido' });
    return;
  }

  if (message.type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong' }));
    return;
  }

  if (message.type !== 'subscribe') {
    sendMessage(ws, { type: 'error', message: 'Tipo de mensagem não suportado' });
    return;
  }

  const organizationId = message.organizationId?.trim();
  const guildId = message.guildId?.trim();
  if (!organizationId || !guildId) {
    sendMessage(ws, { type: 'error', message: 'organizationId e guildId são obrigatórios' });
    return;
  }

  try {
    if (!state.payload) {
      sendMessage(ws, { type: 'error', message: 'Sessão WebSocket inválida' });
      return;
    }
    assertOrgMembership(state.payload, organizationId);
  } catch {
    sendMessage(ws, { type: 'error', message: 'Sem permissão para esta organização' });
    return;
  }

  const connection = await GuildConnectionModel.findOne({
    organizationId,
    guildId,
    isActive: true,
    isMonitoringEnabled: true,
  })
    .select('_id')
    .lean()
    .exec();

  if (!connection) {
    sendMessage(ws, { type: 'error', message: 'Servidor Discord não monitorado para esta organização' });
    return;
  }

  state.unsubscribe?.();
  state.subscribedOrgId = organizationId;
  state.subscribedGuildId = guildId;
  state.unsubscribe = liveActivityBroadcaster.subscribe(organizationId, guildId, (payload) => {
    sendMessage(ws, payload);
  });

  sendMessage(ws, { type: 'subscribed', organizationId, guildId });

  try {
    const snapshot = await getGuildLiveDashboard(guildId, organizationId);
    sendMessage(ws, { type: 'snapshot', data: snapshot });
  } catch (error) {
    sendMessage(ws, { type: 'error', message: (error as Error).message });
  }
}

/**
 * Extrai token JWT da query string ou header Authorization.
 * @param request Requisição HTTP de upgrade
 * @returns Token JWT
 * @throws {Error} Quando token ausente
 */
function extractToken(request: IncomingMessage): string {
  const url = new URL(request.url ?? '', `http://${request.headers.host ?? 'localhost'}`);
  const fromQuery = url.searchParams.get('token');
  if (fromQuery?.trim()) {
    return fromQuery.trim();
  }

  const authorization = request.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  throw new Error('Token ausente');
}

/**
 * Envia mensagem JSON para o cliente WebSocket.
 * @param ws Conexão WebSocket
 * @param message Payload serializável
 */
function sendMessage(ws: WebSocket, message: LiveActivityServerMessage | { type: 'pong' }): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
