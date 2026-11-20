
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  getMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationItem,
} from '../../services/notifications';
import type { AppStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';

type NotificationsNavigationProp = NativeStackNavigationProp<
  AppStackParamList,
  'Notifications'
>;

function formatNotificationDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationsScreen() {
  const navigation = useNavigation<NotificationsNavigationProp>();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadNotifications = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setErrorMessage(null);

    try {
      const result = await getMyNotifications();
      setNotifications(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Bildirimler yüklenirken bir hata oluştu.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications]),
  );

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                read_at: new Date().toISOString(),
              }
            : notification,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Bildirim güncellenirken bir hata oluştu.',
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    const hasUnread = notifications.some(
      (notification) => notification.read_at === null,
    );

    if (!hasUnread || isMarkingAll) {
      return;
    }

    setIsMarkingAll(true);

    try {
      await markAllNotificationsAsRead();

      const readAt = new Date().toISOString();

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at: notification.read_at ?? readAt,
        })),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Bildirimler güncellenirken bir hata oluştu.',
      );
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleNotificationPress = async (notification: NotificationItem) => {
    if (notification.read_at === null) {
      await handleMarkAsRead(notification.id);
    }

    if (notification.ticket_id) {
      navigation.navigate('TicketDetail', {
        ticketId: notification.ticket_id,
      });
    }
  };

  const renderNotification = ({ item }: { item: NotificationItem }) => {
    const isUnread = item.read_at === null;

    return (
      <Pressable
        style={[
          styles.notificationCard,
          isUnread && styles.unreadNotificationCard,
        ]}
        onPress={() => void handleNotificationPress(item)}
      >
        <View style={styles.notificationIcon}>
          <Ionicons
            name={isUnread ? 'notifications' : 'notifications-outline'}
            size={20}
            color={isUnread ? colors.primary : colors.textMuted}
          />
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationTitle}>
              {item.message}
            </Text>

            {isUnread && <View style={styles.unreadDot} />}
          </View>

          <Text style={styles.notificationDate}>
            {formatNotificationDate(item.created_at)}
          </Text>

          {item.ticket_id && (
            <Text style={styles.detailHint}>
              Talep detayını görüntüle
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  const unreadCount = notifications.filter(
    (notification) => notification.read_at === null,
  ).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Bildirimler</Text>
          <Text style={styles.subtitle}>
            {unreadCount > 0
              ? `${unreadCount} okunmamış bildirimin var`
              : 'Tüm bildirimlerin okundu'}
          </Text>
        </View>

        <Pressable
          style={[
            styles.markAllButton,
            (unreadCount === 0 || isMarkingAll) &&
              styles.disabledButton,
          ]}
          onPress={() => void handleMarkAllAsRead()}
          disabled={unreadCount === 0 || isMarkingAll}
        >
          {isMarkingAll ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.markAllText}>Tümünü oku</Text>
          )}
        </Pressable>
      </View>

      {errorMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable onPress={() => void loadNotifications(true)}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </Pressable>
        </View>
      )}

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Bildirimler yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={[
            styles.listContent,
            notifications.length === 0 && styles.emptyListContent,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void loadNotifications(true)}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="notifications-off-outline"
                size={42}
                color={colors.textMuted}
              />
              <Text style={styles.emptyTitle}>Henüz bildirimin yok</Text>
              <Text style={styles.emptyDescription}>
                Yeni bildirimlerin burada görüntülenecek.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  markAllButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.primaryBackground,
  },
  disabledButton: {
    opacity: 0.45,
  },
  markAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  unreadNotificationCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBackground,
  },
  notificationIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  notificationTitle: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  notificationDate: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  detailHint: {
    ...typography.small,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.subheading,
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyDescription: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  errorContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  retryText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
});
