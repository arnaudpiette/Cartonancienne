import { notifyBookingRecipient, type BookingMail, type BookingRecipient } from './notifications';

type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => any };

/** Claims each recipient before touching the transport, so retries cannot double-send. */
export async function deliverBookingNotification(client: RpcClient, notificationId: string, mail: BookingMail, notificationToken?: string) {
  const outcomes: { recipient: BookingRecipient; delivered: boolean; simulated?: boolean; skipped?: boolean; error?: string }[] = [];
  for (const recipient of ['customer', 'admin'] as const) {
    const { data, error } = await client.rpc('claim_booking_notification_delivery', { p_notification_id: notificationId, p_recipient: recipient, p_notification_token: notificationToken || null });
    const claim = Array.isArray(data) ? data[0] as { claimed?: boolean; lease_id?: string } : undefined;
    if (error || !claim?.claimed || !claim.lease_id) {
      outcomes.push({ recipient, delivered: false, skipped: true, error: error?.message });
      continue;
    }
    try {
      const result = await notifyBookingRecipient(mail, recipient);
      const completion = await client.rpc('complete_booking_notification_delivery', { p_notification_id: notificationId, p_recipient: recipient, p_lease_id: claim.lease_id, p_success: true, p_error: null, p_notification_token: notificationToken || null });
      if (completion.error) throw new Error(completion.error.message || 'Résultat d’envoi non enregistré');
      outcomes.push({ recipient, delivered: true, simulated: result.simulated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur d’envoi';
      const completion = await client.rpc('complete_booking_notification_delivery', { p_notification_id: notificationId, p_recipient: recipient, p_lease_id: claim.lease_id, p_success: false, p_error: message, p_notification_token: notificationToken || null });
      outcomes.push({ recipient, delivered: false, error: completion.error?.message || message });
    }
  }
  return outcomes;
}
