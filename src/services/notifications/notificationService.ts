
import { supabase } from '../supabase/client';

export type NotificationItem = {
  id: string;
  user_id: string;
  ticket_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
};

export async function getMyNotifications(): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, ticket_id, message, read_at, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Bildirimler yüklenemedi: ${error.message}`);
  }

  return (data ?? []) as NotificationItem[];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);

  if (error) {
    throw new Error(`Okunmamış bildirim sayısı alınamadı: ${error.message}`);
  }

  return count ?? 0;
}

export async function markNotificationAsRead(
  notificationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null);

  if (error) {
    throw new Error(`Bildirim okundu olarak işaretlenemedi: ${error.message}`);
  }
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);

  if (error) {
    throw new Error(`Bildirimler okundu olarak işaretlenemedi: ${error.message}`);
  }
}
