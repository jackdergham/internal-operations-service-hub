export type NotificationItem = {
  id: string
  type: string
  title: string
  message: string
  requestId: string | null
  readAt: string | null
  createdAt: string
}

export async function listNotifications(apiBaseUrl: string, actorId: string): Promise<NotificationItem[]> {
  const response = await fetch(`${apiBaseUrl}/notifications/mine`, {
    headers: { 'x-actor-id': actorId },
  })
  if (!response.ok) throw new Error('Notifications could not be loaded.')
  return response.json() as Promise<NotificationItem[]>
}

export async function markNotificationRead(
  apiBaseUrl: string,
  actorId: string,
  notificationId: string,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: { 'x-actor-id': actorId },
  })
  if (!response.ok) throw new Error('Notification could not be updated.')
}