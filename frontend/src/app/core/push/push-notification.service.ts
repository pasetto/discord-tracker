import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Resposta da API para chave pública VAPID.
 */
interface PushPublicKeyResponse {
  publicKey: string;
}

/**
 * Payload enviado ao backend para registrar assinatura web push.
 */
interface PushSubscribeRequest {
  subscription: PushSubscriptionJSON;
}

/**
 * Serviço responsável por inscrição e sincronização de Web Push no navegador.
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Solicita permissão de notificação e registra assinatura push no backend.
   * @param {string} organizationId Organização ativa do usuário autenticado.
   * @returns {Promise<void>} Não retorna valor.
   */
  async enableInactivityPushNotifications(organizationId: string): Promise<void> {
    if (!organizationId || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return;
    }

    const vapid = await this.getVapidPublicKey(organizationId);
    if (!vapid) {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToArrayBuffer(vapid),
      });
    }

    await firstValueFrom(
      this.httpClient.post<void>(`/api/v1/org/${organizationId}/push/subscribe`, {
        subscription: subscription.toJSON(),
      } satisfies PushSubscribeRequest),
    );
  }

  /**
   * Remove assinatura push local e no backend para o usuário atual.
   * @param {string} organizationId Organização ativa do usuário autenticado.
   * @returns {Promise<void>} Não retorna valor.
   */
  async disableInactivityPushNotifications(organizationId: string): Promise<void> {
    if (!organizationId || !('serviceWorker' in navigator)) {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return;
    }

    await firstValueFrom(
      this.httpClient.post<void>(`/api/v1/org/${organizationId}/push/unsubscribe`, {
        endpoint: subscription.endpoint,
      }),
    );
    await subscription.unsubscribe();
  }

  /**
   * Busca chave pública VAPID no backend para inscrição no navegador.
   * @param {string} organizationId Organização ativa.
   * @returns {Promise<string | null>} Chave pública ou `null` quando indisponível.
   */
  private async getVapidPublicKey(organizationId: string): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.httpClient.get<PushPublicKeyResponse>(`/api/v1/org/${organizationId}/push/public-key`),
      );
      return response.publicKey;
    } catch {
      return null;
    }
  }

  /**
   * Converte VAPID base64 URL-safe em bytes para Push API.
   * @param {string} base64String Chave VAPID pública codificada em base64url.
   * @returns {ArrayBuffer} Buffer utilizado em `applicationServerKey`.
   */
  private urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let index = 0; index < rawData.length; index += 1) {
      outputArray[index] = rawData.charCodeAt(index);
    }

    return outputArray.buffer as ArrayBuffer;
  }
}
