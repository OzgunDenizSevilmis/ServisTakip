
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getCurrentUserContext,
  getStockMovementHistory,
  type StockMovementHistoryItem,
} from '../../services/tickets/ticketService';
import type { CurrentUserContext } from '../../services/tickets/ticketService';
import { colors, spacing, typography } from '../../theme';

function formatDate(value: string): string {
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

function getMovementLabel(
  type: StockMovementHistoryItem['movement_type'],
): string {
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
): string {
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

function getMovementPrefix(
  type: StockMovementHistoryItem['movement_type'],
): string {
  return type === 'usage' ? '-' : '+';
}

export function HomeScreen() {
  const [currentUser, setCurrentUser] =
    useState<CurrentUserContext | null>(null);

  const [movements, setMovements] = useState<
    StockMovementHistoryItem[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const userContext = await getCurrentUserContext();

      setCurrentUser(userContext);

      if (userContext.role !== 'manager') {
        setMovements([]);
        return;
      }

      const movementData = await getStockMovementHistory();

      setMovements(movementData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ana sayfa bilgileri yüklenemedi.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    const initializeDashboard = async () => {
      try {
        const userContext = await getCurrentUserContext();

        if (!isActive) return;

        setCurrentUser(userContext);

        if (userContext.role !== 'manager') {
          setMovements([]);
          return;
        }

        const movementData = await getStockMovementHistory();

        if (!isActive) return;

        setMovements(movementData);
      } catch (err) {
        if (!isActive) return;

        setError(
          err instanceof Error
            ? err.message
            : 'Ana sayfa bilgileri yüklenemedi.',
        );
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    initializeDashboard();

    return () => {
      isActive = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.helperText}>
          Ana sayfa yükleniyor...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.errorText}>{error}</Text>

        <Pressable
          style={styles.primaryButton}
          onPress={loadDashboard}
        >
          <Text style={styles.primaryButtonText}>
            Tekrar Dene
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Ana Sayfa</Text>
          <Text style={styles.description}>
            Servis operasyonlarına genel bakış
          </Text>
        </View>

        <Pressable
          style={styles.refreshButton}
          onPress={loadDashboard}
        >
          <Text style={styles.refreshButtonText}>
            Yenile
          </Text>
        </Pressable>
      </View>

      {currentUser?.role === 'manager' ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>
                Stok Hareket Geçmişi
              </Text>
              <Text style={styles.sectionDescription}>
                Sistemde gerçekleştirilen stok işlemleri
              </Text>
            </View>

            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {movements.length}
              </Text>
            </View>
          </View>

          {movements.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                Henüz stok hareketi yok
              </Text>
              <Text style={styles.emptyText}>
                Gerçekleştirilen stok girişleri ve parça kullanımları
                burada görüntülenecek.
              </Text>
            </View>
          ) : (
            movements.map((movement) => (
              <View
                key={movement.id}
                style={styles.movementCard}
              >
                <View style={styles.movementHeader}>
                  <View style={styles.partInfo}>
                    <Text style={styles.partName}>
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
                  {getMovementPrefix(movement.movement_type)}
                  {movement.quantity} {movement.unit}
                </Text>

                <Text style={styles.movementDate}>
                  {formatDate(movement.created_at)}
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

                <Text style={styles.reason}>
                  Açıklama:{' '}
                  {movement.reason || 'Açıklama girilmemiş.'}
                </Text>
              </View>
            ))
          )}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            ServisTakip
          </Text>
          <Text style={styles.emptyText}>
            Servis operasyonlarına genel bakış burada görüntülenecek.
          </Text>
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
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
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
  },
  title: {
    ...typography.title,
    color: colors.text,
    fontWeight: '700',
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
  },
  refreshButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  refreshButtonText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
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
  sectionHeaderText: {
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
    ...typography.body,
    color: colors.text,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
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
});
