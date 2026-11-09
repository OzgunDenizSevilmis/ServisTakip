
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { AppStackParamList } from '../../navigation/types';
import {
  getTicketDetail,
  getTicketHistory,
  getTicketPeople,
  type TicketDetail,
  type TicketHistoryItem,
  type TicketPerson,
} from '../../services/tickets/ticketService';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'TicketDetail'>;

const statusLabels: Record<string, string> = {
  open: 'Açık',
  assigned: 'Atandı',
  in_progress: 'İşlemde',
  waiting_parts: 'Parça Bekleniyor',
  resolved: 'Çözüldü',
  closed: 'Kapatıldı',
  cancelled: 'İptal Edildi',
};

const priorityLabels: Record<string, string> = {
  low: 'Düşük',
  normal: 'Normal',
  high: 'Yüksek',
};

const roleLabels: Record<string, string> = {
  manager: 'Yönetici',
  technician: 'Teknisyen',
  employee: 'Çalışan',
};

const fieldLabels: Record<string, string> = {
  title: 'Başlık',
  description: 'Açıklama',
  category_id: 'Kategori',
  location: 'Konum',
  priority: 'Öncelik',
  status: 'Durum',
  assigned_to: 'Atanan personel',
  due_at: 'Termin tarihi',
  request_id: 'İlişkili talep',
};

function formatDate(value: string | null) {
  if (!value) return 'Belirtilmemiş';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Belirtilmemiş';
  }

  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getActionLabel(action: string) {
  const labels: Record<string, string> = {
    created: 'Servis kaydı oluşturuldu',
    status_changed: 'Servis durumu değiştirildi',
    assigned: 'Servis ataması yapıldı',
    updated: 'Servis bilgileri güncellendi',
    resolved: 'Servis çözüldü',
    closed: 'Servis kapatıldı',
    cancelled: 'Servis iptal edildi',
  };

  return labels[action] ?? action.replaceAll('_', ' ');
}

function formatHistoryValue(
  field: string,
  value: unknown,
): string {
  if (value === null || value === undefined) {
    return 'Belirtilmemiş';
  }

  if (field === 'status') {
    return statusLabels[String(value)] ?? String(value);
  }

  if (field === 'priority') {
    return priorityLabels[String(value)] ?? String(value);
  }

  if (field === 'due_at') {
    return formatDate(String(value));
  }

  if (
    field === 'assigned_to' ||
    field === 'category_id' ||
    field === 'request_id'
  ) {
    return 'Güncellendi';
  }

  return String(value);
}

function getHistoryChanges(item: TicketHistoryItem) {
  const oldValues =
    item.old_value &&
    typeof item.old_value === 'object' &&
    !Array.isArray(item.old_value)
      ? (item.old_value as Record<string, unknown>)
      : {};

  const newValues =
    item.new_value &&
    typeof item.new_value === 'object' &&
    !Array.isArray(item.new_value)
      ? (item.new_value as Record<string, unknown>)
      : {};

  return Object.keys(newValues)
    .filter((field) => fieldLabels[field])
    .map((field) => ({
      field,
      label: fieldLabels[field],
      oldValue: formatHistoryValue(field, oldValues[field]),
      newValue: formatHistoryValue(field, newValues[field]),
    }));
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function TicketDetailScreen({ route, navigation }: Props) {
  const { ticketId } = route.params;
  const insets = useSafeAreaInsets();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [history, setHistory] = useState<TicketHistoryItem[]>([]);
  const [people, setPeople] = useState<TicketPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTicket = useCallback(async () => {
    const [ticketData, historyData, peopleData] = await Promise.all([
      getTicketDetail(ticketId),
      getTicketHistory(ticketId),
      getTicketPeople(ticketId),
    ]);

    return {
      ticketData,
      historyData,
      peopleData,
    };
  }, [ticketId]);

  const loadTicket = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { ticketData, historyData, peopleData } =
        await fetchTicket();

      setTicket(ticketData);
      setHistory(historyData);
      setPeople(peopleData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Servis bilgileri yüklenirken bir hata oluştu.',
      );
    } finally {
      setLoading(false);
    }
  }, [fetchTicket]);

  useEffect(() => {
    let isActive = true;

    fetchTicket()
      .then(({ ticketData, historyData, peopleData }) => {
        if (!isActive) return;

        setTicket(ticketData);
        setHistory(historyData);
        setPeople(peopleData);
      })
      .catch((err: unknown) => {
        if (!isActive) return;

        setError(
          err instanceof Error
            ? err.message
            : 'Servis bilgileri yüklenirken bir hata oluştu.',
        );
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [fetchTicket]);

  const getPersonName = (userId: string | null) => {
    if (!userId) return 'Henüz atanmadı';

    const person = people.find((item) => item.user_id === userId);

    return person?.full_name?.trim() || 'Kullanıcı bilgisi bulunamadı';
  };

  const getPersonRole = (userId: string | null) => {
    if (!userId) return '';

    const person = people.find((item) => item.user_id === userId);

    return person ? roleLabels[person.role] ?? person.role : '';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Geri dön"
        >
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>

        <Text style={styles.headerTitle}>Servis Detayı</Text>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.helperText}>
            Servis bilgileri yükleniyor...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>

          <Pressable style={styles.retryButton} onPress={loadTicket}>
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </Pressable>
        </View>
      ) : ticket ? (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Servis özeti */}
          <View style={styles.summaryCard}>
            <Text style={styles.ticketNumber}>{ticket.ticket_no}</Text>

            <Text style={styles.ticketTitle}>{ticket.title}</Text>

            <View style={styles.badgeRow}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>
                  {statusLabels[ticket.status] ?? ticket.status}
                </Text>
              </View>

              <View style={styles.priorityBadge}>
                <Text style={styles.priorityText}>
                  {priorityLabels[ticket.priority] ?? ticket.priority}
                </Text>
              </View>
            </View>
          </View>

          {/* Servis bilgileri */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Servis Bilgileri</Text>

            <View style={styles.infoCard}>
              <InfoRow
                label="Kategori"
                value={ticket.category_name ?? 'Belirtilmemiş'}
              />

              <InfoRow
                label="Konum"
                value={ticket.location ?? 'Belirtilmemiş'}
              />

              <InfoRow
                label="Oluşturan"
                value={getPersonName(ticket.created_by)}
              />

              <InfoRow
                label="Atanan personel"
                value={getPersonName(ticket.assigned_to)}
              />

              {ticket.assigned_to && getPersonRole(ticket.assigned_to) ? (
                <InfoRow
                  label="Personel rolü"
                  value={getPersonRole(ticket.assigned_to)}
                />
              ) : null}

              <InfoRow
                label="Oluşturulma"
                value={formatDate(ticket.created_at)}
              />

              <InfoRow
                label="Son güncelleme"
                value={formatDate(ticket.updated_at)}
              />

              <InfoRow
                label="Termin tarihi"
                value={formatDate(ticket.due_at)}
              />
            </View>
          </View>

          {/* Açıklama */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Açıklama</Text>

            <View style={styles.infoCard}>
              <Text style={styles.description}>
                {ticket.description?.trim() || 'Açıklama girilmemiş.'}
              </Text>
            </View>
          </View>

          {/* İşlem geçmişi */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>İşlem Geçmişi</Text>

            <View style={styles.infoCard}>
              {history.length === 0 ? (
                <Text style={styles.emptyText}>
                  Bu servis kaydı için henüz işlem geçmişi bulunmuyor.
                </Text>
              ) : (
                history.map((item, index) => {
                  const changes = getHistoryChanges(item);

                  return (
                    <View key={item.id} style={styles.historyItem}>
                      <View style={styles.historyMarker}>
                        <View style={styles.historyDot} />

                        {index !== history.length - 1 && (
                          <View style={styles.historyLine} />
                        )}
                      </View>

                      <View style={styles.historyContent}>
                        <Text style={styles.historyTitle}>
                          {getActionLabel(item.action)}
                        </Text>

                        <Text style={styles.historyDate}>
                          {formatDate(item.created_at)}
                        </Text>

                        <Text style={styles.actorName}>
                          İşlemi yapan: {getPersonName(item.actor_id)}
                        </Text>

                        {changes.map((change) => (
                          <View
                            key={change.field}
                            style={styles.changeRow}
                          >
                            <Text style={styles.changeLabel}>
                              {change.label}
                            </Text>

                            <Text style={styles.changeValue}>
                              {change.oldValue} → {change.newValue}
                            </Text>
                          </View>
                        ))}

                        {item.note ? (
                          <Text style={styles.historyNote}>
                            {item.note}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </ScrollView>
      ) : null}
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  backButtonText: {
    fontSize: 36,
    color: colors.text,
    lineHeight: 40,
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
    fontWeight: '700',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  ticketNumber: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: '600',
  },
  ticketTitle: {
    ...typography.title,
    color: colors.text,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusBadge: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  priorityBadge: {
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  priorityText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  infoRow: {
    gap: spacing.xs,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
  },
  description: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },
  historyItem: {
    flexDirection: 'row',
    minHeight: 64,
  },
  historyMarker: {
    width: 24,
    alignItems: 'center',
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  historyLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.textMuted,
    opacity: 0.25,
    marginTop: spacing.xs,
  },
  historyContent: {
    flex: 1,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  historyTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  historyDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  actorName: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  historyNote: {
    ...typography.body,
    color: colors.textMuted,
  },
  changeRow: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  changeLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  changeValue: {
    ...typography.body,
    color: colors.text,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  helperText: {
    ...typography.body,
    color: colors.textMuted,
  },
  errorText: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  retryButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
