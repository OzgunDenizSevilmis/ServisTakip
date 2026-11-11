
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  CompositeNavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getCurrentUserContext,
  getMyTickets,
  getStockMovementHistory,
  type CurrentUserContext,
  type StockMovementHistoryItem,
  type TicketListItem,
} from '../../services/tickets/ticketService';
import { getUnreadNotificationCount } from '../../services/notifications';
import type {
  AppStackParamList,
  AppTabParamList,
} from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';

type HomeNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabParamList, 'Home'>,
  NativeStackNavigationProp<AppStackParamList>
>;

const STATUS_LABELS: Record<TicketListItem['status'], string> = {
  open: 'Beklemede',
  assigned: 'Atandı',
  in_progress: 'Devam Ediyor',
  waiting_parts: 'Parça Bekliyor',
  resolved: 'Çözüldü',
  closed: 'Kapatıldı',
  cancelled: 'İptal Edildi',
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Tarih bilgisi yok';
  }

  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: string) {
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

function getStatusColor(status: TicketListItem['status']) {
  switch (status) {
    case 'open':
      return '#D97706';
    case 'assigned':
    case 'in_progress':
    case 'waiting_parts':
      return colors.primary;
    case 'resolved':
    case 'closed':
      return '#16A34A';
    case 'cancelled':
      return colors.danger;
    default:
      return colors.textMuted;
  }
}

function getStatusBackground(status: TicketListItem['status']) {
  switch (status) {
    case 'open':
      return '#FEF0D5';
    case 'assigned':
    case 'in_progress':
    case 'waiting_parts':
      return colors.primaryBackground;
    case 'resolved':
    case 'closed':
      return '#D7F5E5';
    case 'cancelled':
      return '#FDE2E2';
    default:
      return colors.surface;
  }
}

function getMovementLabel(
  type: StockMovementHistoryItem['movement_type'],
) {
  switch (type) {
    case 'entry':
      return 'Stok Girişi';
    case 'usage':
      return 'Parça Kullanımı';
    case 'usage_reversal':
      return 'Kullanım İptali';
    default:
      return 'Stok Hareketi';
  }
}

function getMovementColor(
  type: StockMovementHistoryItem['movement_type'],
) {
  switch (type) {
    case 'entry':
      return '#16A34A';
    case 'usage':
      return colors.primary;
    case 'usage_reversal':
      return '#D97706';
    default:
      return colors.textMuted;
  }
}

function getRoleTitle(role: CurrentUserContext['role']) {
  switch (role) {
    case 'manager':
      return 'Yönetici Paneli';
    case 'technician':
      return 'Teknisyen Paneli';
    case 'employee':
      return 'Çalışan Paneli';
  }
}

function getRoleDescription(role: CurrentUserContext['role']) {
  switch (role) {
    case 'manager':
      return 'Servis ve stok operasyonlarının genel görünümü';
    case 'technician':
      return 'Erişebildiğiniz servis kayıtlarının güncel durumu';
    case 'employee':
      return 'Oluşturduğunuz servis kayıtlarının güncel durumu';
  }
}

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigationProp>();
  const insets = useSafeAreaInsets();

  const [currentUser, setCurrentUser] =
    useState<CurrentUserContext | null>(null);

  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [movements, setMovements] = useState<
    StockMovementHistoryItem[]
  >([]);

  const [unreadNotificationCount, setUnreadNotificationCount] =
    useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const [userContext, ticketData] = await Promise.all([
        getCurrentUserContext(),
        getMyTickets(),
      ]);

      setCurrentUser(userContext);
      setTickets(ticketData);

      if (userContext.role === 'manager') {
        const movementData = await getStockMovementHistory();
        setMovements(movementData);
      } else {
        setMovements([]);
      }

      try {
        const count = await getUnreadNotificationCount();
        setUnreadNotificationCount(count);
      } catch {
        // Bildirim sayısı yüklenemese de ana sayfa çalışmaya devam eder.
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ana sayfa bilgileri yüklenemedi.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  const statistics = useMemo(() => {
    return {
      total: tickets.length,
      pending: tickets.filter((ticket) => ticket.status === 'open').length,
      inProgress: tickets.filter((ticket) =>
        ['assigned', 'in_progress', 'waiting_parts'].includes(
          ticket.status,
        ),
      ).length,
      completed: tickets.filter((ticket) =>
        ['resolved', 'closed'].includes(ticket.status),
      ).length,
    };
  }, [tickets]);

  const recentTickets = tickets.slice(0, 5);

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.helperText}>Ana sayfa yükleniyor...</Text>
      </View>
    );
  }

  if (error && tickets.length === 0 && !currentUser) {
    return (
      <View style={styles.centerContent}>
        <Ionicons
          name="alert-circle-outline"
          size={38}
          color={colors.danger}
        />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => void loadDashboard()}
        >
          <Text style={styles.primaryButtonText}>Tekrar Dene</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top, spacing.lg),
          paddingBottom: Math.max(insets.bottom + spacing.xl, spacing.xl),
        },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadDashboard(true)}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Ana Sayfa</Text>
          <Text style={styles.description}>
            {currentUser ? getRoleTitle(currentUser.role) : 'ServisTakip'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={styles.notificationButton}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityRole="button"
            accessibilityLabel="Bildirimleri görüntüle"
          >
            <Ionicons
              name="notifications-outline"
              size={23}
              color={colors.text}
            />

            {unreadNotificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotificationCount > 99
                    ? '99+'
                    : unreadNotificationCount}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={styles.refreshButton}
            onPress={() => void loadDashboard(true)}
            accessibilityRole="button"
            accessibilityLabel="Ana sayfayı yenile"
          >
            <Ionicons name="refresh" size={19} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <View style={styles.welcomeCard}>
        <View style={styles.welcomeIcon}>
          <Ionicons
            name="grid-outline"
            size={25}
            color={colors.primary}
          />
        </View>
        <View style={styles.welcomeContent}>
          <Text style={styles.welcomeTitle}>
            {currentUser ? getRoleTitle(currentUser.role) : 'ServisTakip'}
          </Text>
          <Text style={styles.welcomeDescription}>
            {currentUser
              ? getRoleDescription(currentUser.role)
              : 'Servis operasyonlarına genel bakış'}
          </Text>
        </View>
      </View>

      {error && (
        <View style={styles.inlineError}>
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={colors.danger}
          />
          <Text style={styles.inlineErrorText}>{error}</Text>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Servis Özeti</Text>
            <Text style={styles.sectionDescription}>
              Servis kayıtlarının mevcut durumu
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ionicons
                name="documents-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <Text style={styles.statValue}>{statistics.total}</Text>
            <Text style={styles.statLabel}>Toplam Kayıt</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.pendingIcon]}>
              <Ionicons
                name="time-outline"
                size={20}
                color="#D97706"
              />
            </View>
            <Text style={styles.statValue}>{statistics.pending}</Text>
            <Text style={styles.statLabel}>Beklemede</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.progressIcon]}>
              <Ionicons
                name="construct-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <Text style={styles.statValue}>{statistics.inProgress}</Text>
            <Text style={styles.statLabel}>Devam Eden</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.completedIcon]}>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color="#16A34A"
              />
            </View>
            <Text style={styles.statValue}>{statistics.completed}</Text>
            <Text style={styles.statLabel}>Tamamlanan</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Son Servis Kayıtları</Text>
            <Text style={styles.sectionDescription}>
              En son oluşturulan veya erişilebilen kayıtlar
            </Text>
          </View>

          <Pressable
            onPress={() => navigation.navigate('MainTabs', {
              screen: 'Tickets',
            })}
            hitSlop={8}
          >
            <Text style={styles.seeAllText}>Tümünü Gör</Text>
          </Pressable>
        </View>

        {recentTickets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="file-tray-outline"
              size={30}
              color={colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              Henüz servis kaydı yok
            </Text>
            <Text style={styles.emptyText}>
              Yeni servis kayıtları oluşturulduğunda burada
              görüntülenecek.
            </Text>
          </View>
        ) : (
          recentTickets.map((ticket) => (
            <Pressable
              key={ticket.id}
              style={styles.ticketCard}
              onPress={() =>
                navigation.navigate('TicketDetail', {
                  ticketId: ticket.id,
                })
              }
            >
              <View style={styles.ticketTopRow}>
                <View style={styles.ticketNumberContainer}>
                  <Ionicons
                    name="document-text-outline"
                    size={17}
                    color={colors.primary}
                  />
                  <Text style={styles.ticketNumber}>
                    {ticket.ticket_no}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: getStatusBackground(ticket.status),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: getStatusColor(ticket.status) },
                    ]}
                  >
                    {STATUS_LABELS[ticket.status]}
                  </Text>
                </View>
              </View>

              <Text style={styles.ticketTitle} numberOfLines={2}>
                {ticket.title}
              </Text>

              <View style={styles.ticketBottomRow}>
                <Text style={styles.ticketCategory} numberOfLines={1}>
                  {ticket.category_name || 'Kategorisiz'}
                </Text>
                <Text style={styles.ticketDate}>
                  {formatDate(ticket.created_at)}
                </Text>
              </View>

              <View style={styles.ticketFooter}>
                <Text style={styles.ticketDetailLink}>Detayı Gör</Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.primary}
                />
              </View>
            </Pressable>
          ))
        )}
      </View>

      {currentUser?.role === 'manager' && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>
                Stok Hareket Geçmişi
              </Text>
              <Text style={styles.sectionDescription}>
                Sistemde gerçekleştirilen son stok işlemleri
              </Text>
            </View>

            <View style={styles.countBadge}>
              <Text style={styles.countText}>{movements.length}</Text>
            </View>
          </View>

          {movements.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons
                name="cube-outline"
                size={30}
                color={colors.textMuted}
              />
              <Text style={styles.emptyTitle}>
                Henüz stok hareketi yok
              </Text>
              <Text style={styles.emptyText}>
                Sistemde gerçekleştirilen stok işlemleri burada
                görüntülenecek.
              </Text>
            </View>
          ) : (
            movements.slice(0, 5).map((movement) => (
              <View key={movement.id} style={styles.movementCard}>
                <View style={styles.movementHeader}>
                  <View style={styles.partInfo}>
                    <Text style={styles.partName} numberOfLines={1}>
                      {movement.part_name}
                    </Text>
                    <Text style={styles.partCode}>
                      {movement.part_code}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor: getMovementColor(
                          movement.movement_type,
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.typeBadgeText}>
                      {getMovementLabel(movement.movement_type)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.quantity}>
                  {movement.movement_type === 'usage' ? '-' : '+'}
                  {movement.quantity} {movement.unit}
                </Text>

                <Text style={styles.movementDate}>
                  {formatDateTime(movement.created_at)}
                </Text>

                <View style={styles.divider} />

                <Text style={styles.detailText}>
                  İşlemi yapan: {movement.actor_name}
                </Text>

                <Text style={styles.detailText}>
                  {movement.ticket_no
                    ? `Servis kaydı: ${movement.ticket_no}`
                    : 'Genel stok işlemi'}
                </Text>

                <Text style={styles.reason} numberOfLines={2}>
                  Açıklama: {movement.reason || 'Açıklama girilmemiş.'}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  helperText: {
    ...typography.body,
    color: colors.textMuted,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 10,
    backgroundColor: '#FDE2E2',
  },
  inlineErrorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  title: {
    ...typography.title,
    color: colors.text,
    fontWeight: '700',
  },
  description: {
    ...typography.caption,
    color: colors.textMuted,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.background,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primaryBackground,
    borderRadius: 14,
    padding: spacing.md,
  },
  welcomeIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeContent: {
    flex: 1,
    gap: spacing.xs,
  },
  welcomeTitle: {
    ...typography.subheading,
    color: colors.text,
    fontWeight: '700',
  },
  welcomeDescription: {
    ...typography.caption,
    color: colors.textMuted,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionHeading: {
    flex: 1,
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
    fontWeight: '700',
  },
  sectionDescription: {
    ...typography.caption,
    color: colors.textMuted,
  },
  seeAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: 130,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  pendingIcon: {
    backgroundColor: '#FEF0D5',
  },
  progressIcon: {
    backgroundColor: colors.primaryBackground,
  },
  completedIcon: {
    backgroundColor: '#D7F5E5',
  },
  statValue: {
    ...typography.heading,
    color: colors.text,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  ticketCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  ticketTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ticketNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  ticketNumber: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    maxWidth: '48%',
  },
  statusText: {
    ...typography.small,
    fontWeight: '700',
  },
  ticketTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  ticketBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ticketCategory: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  ticketDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  ticketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  ticketDetailLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  countBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  countText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  movementCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  movementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  partInfo: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  partName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  partCode: {
    ...typography.caption,
    color: colors.textMuted,
  },
  typeBadge: {
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexShrink: 0,
  },
  typeBadgeText: {
    ...typography.small,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  quantity: {
    ...typography.heading,
    color: colors.text,
    fontWeight: '700',
  },
  movementDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  detailText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  reason: {
    ...typography.caption,
    color: colors.text,
  },
});
