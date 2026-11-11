
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
import {
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    return 'Tarih bilgisi yok';
  }

  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationsScreen() {
  const navigation = useNavigation<NotificationsNavigationProp>();
  const insets = useSafeAreaInsets();

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

  const handleMarkAsRead = async (
    notificationId: string,
  ): Promise<boolean> => {
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

      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Bildirim güncellenirken bir hata oluştu.',
      );

      return false;
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

  const handleNotificationPress = async (
    notification: NotificationItem,
  ) => {
    if (notification.read_at === null) {
      const success = await handleMarkAsRead(notification.id);

      if (!success) {
        return;
      }
    }

    if (notification.ticket_id) {
      navigation.navigate('TicketDetail', {
        ticketId: notification.ticket_id,
      });
    }
  };

  const unreadCount = notifications.filter(
    (notification) => notification.read_at === null,
  ).length;

  const renderNotification = ({
    item,
  }: {
    item: NotificationItem;
  }) => {
    const isUnread = item.read_at === null;

    return (
      <Pressable
        style={[
          styles.notificationCard,
          isUnread && styles.unreadCard,
        ]}
        onPress={() => void handleNotificationPress(item)}
      >
        <View
          style={[
            styles.notificationIcon,
            isUnread && styles.unreadIcon,
          ]}
        >
          <Ionicons
            name={
              isUnread
                ? 'notifications'
                : 'notifications-outline'
            }
            size={21}
            color={isUnread ? colors.primary : colors.textMuted}
          />
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationTitleRow}>
            <Text style={styles.notificationMessage}>
              {item.message}
            </Text>

            {isUnread && <View style={styles.unreadDot} />}
          </View>

          <View style={styles.notificationFooter}>
            <View style={styles.dateContainer}>
              <Ionicons
                name="time-outline"
                size={13}
                color={colors.textMuted}
              />
              <Text style={styles.notificationDate}>
                {formatNotificationDate(item.created_at)}
              </Text>
            </View>

            {item.ticket_id && (
              <View style={styles.detailLink}>
                <Text style={styles.detailLinkText}>
                  Detayı gör
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={13}
                  color={colors.primary}
                />
              </View>
            )}
          </View>

          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusIndicator,
                isUnread ? styles.unreadStatus : styles.readStatus,
              ]}
            />
            <Text
              style={[
                styles.statusText,
                isUnread && styles.unreadStatusText,
              ]}
            >
              {isUnread ? 'Okunmadı' : 'Okundu'}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.headerContainer,
          { paddingTop: insets.top + spacing.sm },
        ]}
      >
        <View style={styles.navigationHeader}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Geri dön"
          >
            <Ionicons
              name="arrow-back"
              size={23}
              color={colors.text}
            />
          </Pressable>

          <Text style={styles.navigationTitle}>Bildirimler</Text>

          <View style={styles.headerRightPlaceholder} />
        </View>

        <View style={styles.headerContent}>
          <View style={styles.headerDescription}>
            <Text style={styles.pageTitle}>Bildirim Merkezi</Text>
            <Text style={styles.pageDescription}>
              Servis kayıtlarınla ilgili güncellemeler burada.
            </Text>
          </View>

          <View style={styles.unreadSummary}>
            <Text style={styles.unreadNumber}>{unreadCount}</Text>
            <Text style={styles.unreadLabel}>Okunmamış</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Text style={styles.sectionTitle}>Tüm Bildirimler</Text>

          <Pressable
            onPress={() => void handleMarkAllAsRead()}
            disabled={unreadCount === 0 || isMarkingAll}
            style={[
              styles.markAllButton,
              unreadCount === 0 && styles.disabledButton,
            ]}
          >
            {isMarkingAll ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
              />
            ) : (
              <>
                <Ionicons
                  name="checkmark-done-outline"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.markAllText}>Tümünü oku</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      {errorMessage && (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color={colors.danger}
          />
          <View style={styles.errorContent}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable
              onPress={() => void loadNotifications(true)}
            >
              <Text style={styles.retryText}>Tekrar dene</Text>
            </Pressable>
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />
          <Text style={styles.loadingText}>
            Bildirimler yükleniyor...
          </Text>
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
          ItemSeparatorComponent={() => (
            <View style={styles.listSeparator} />
          )}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void loadNotifications(true)}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="notifications-off-outline"
                  size={38}
                  color={colors.textMuted}
                />
              </View>

              <Text style={styles.emptyTitle}>
                Henüz bildirimin yok
              </Text>

              <Text style={styles.emptyDescription}>
                Yeni servis güncellemeleri ve işlemlerle ilgili
                bildirimlerin burada görünecek.
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
  headerContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navigationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationTitle: {
    ...typography.subheading,
    color: colors.text,
    fontWeight: '700',
  },
  headerRightPlaceholder: {
    width: 42,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerDescription: {
    flex: 1,
    gap: spacing.xs,
  },
  pageTitle: {
    ...typography.title,
    color: colors.text,
    fontWeight: '700',
  },
  pageDescription: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 20,
  },
  unreadSummary: {
    minWidth: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadNumber: {
    ...typography.heading,
    color: colors.primary,
    fontWeight: '700',
  },
  unreadLabel: {
    ...typography.small,
    color: colors.primary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
    fontWeight: '700',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.primaryBackground,
  },
  disabledButton: {
    opacity: 0.4,
  },
  markAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  listSeparator: {
    height: spacing.sm,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unreadCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBackground,
  },
  notificationIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadIcon: {
    backgroundColor: colors.surface,
  },
  notificationContent: {
    flex: 1,
    gap: spacing.sm,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  notificationMessage: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    lineHeight: 22,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  notificationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  notificationDate: {
    ...typography.small,
    color: colors.textMuted,
    flexShrink: 1,
  },
  detailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailLinkText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusIndicator: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  unreadStatus: {
    backgroundColor: colors.primary,
  },
  readStatus: {
    backgroundColor: colors.textMuted,
  },
  statusText: {
    ...typography.small,
    color: colors.textMuted,
  },
  unreadStatusText: {
    color: colors.primary,
    fontWeight: '600',
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
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.subheading,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDescription: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  errorContent: {
    flex: 1,
    gap: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  retryText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
});

export default NotificationsScreen;
