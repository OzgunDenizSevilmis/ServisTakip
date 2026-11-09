
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { CreateTicketScreen } from './CreateTicketScreen';
import { getMyTickets, type TicketListItem } from '../../services/tickets';
import type { AppStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';

type TicketFilter = 'all' | 'pending' | 'in_progress' | 'completed';

type TicketsNavigationProp = NativeStackNavigationProp<
  AppStackParamList,
  'MainTabs'
>;

const FILTERS: { label: string; value: TicketFilter }[] = [
  { label: 'Tümü', value: 'all' },
  { label: 'Beklemede', value: 'pending' },
  { label: 'Devam Ediyor', value: 'in_progress' },
  { label: 'Tamamlandı', value: 'completed' },
];

const STATUS_LABELS: Record<TicketListItem['status'], string> = {
  open: 'Beklemede',
  assigned: 'Atandı',
  in_progress: 'Devam Ediyor',
  waiting_parts: 'Parça Bekliyor',
  resolved: 'Tamamlandı',
  closed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

function getStatusStyle(status: TicketListItem['status']) {
  switch (status) {
    case 'open':
      return styles.pendingBadge;
    case 'assigned':
    case 'in_progress':
    case 'waiting_parts':
      return styles.progressBadge;
    case 'resolved':
    case 'closed':
      return styles.completedBadge;
    case 'cancelled':
      return styles.cancelledBadge;
    default:
      return styles.pendingBadge;
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
  });
}

function matchesFilter(
  ticket: TicketListItem,
  filter: TicketFilter,
): boolean {
  if (filter === 'all') return true;

  if (filter === 'pending') {
    return ticket.status === 'open';
  }

  if (filter === 'in_progress') {
    return ['assigned', 'in_progress', 'waiting_parts'].includes(
      ticket.status,
    );
  }

  return ['resolved', 'closed'].includes(ticket.status);
}

export function TicketsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<TicketsNavigationProp>();

  const [isCreating, setIsCreating] = useState(false);
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<TicketFilter>('all');

  const fetchTickets = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    }

    setErrorMessage(null);

    try {
      const data = await getMyTickets();
      setTickets(data);
    } catch {
      setErrorMessage('Talepler yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadInitialTickets = async () => {
      try {
        const data = await getMyTickets();

        if (isActive) {
          setTickets(data);
        }
      } catch {
        if (isActive) {
          setErrorMessage('Talepler yüklenirken bir hata oluştu.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadInitialTickets();

    return () => {
      isActive = false;
    };
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setIsCreating(false);
    void fetchTickets(true);
  }, [fetchTickets]);

  const handleTicketPress = useCallback(
    (ticketId: string) => {
      navigation.navigate('TicketDetail', { ticketId });
    },
    [navigation],
  );

  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('tr-TR');

    return tickets.filter((ticket) => {
      const matchesSearch =
        !query ||
        ticket.title.toLocaleLowerCase('tr-TR').includes(query) ||
        ticket.ticket_no.toLocaleLowerCase('tr-TR').includes(query) ||
        (ticket.category_name ?? '')
          .toLocaleLowerCase('tr-TR')
          .includes(query);

      return matchesSearch && matchesFilter(ticket, selectedFilter);
    });
  }, [tickets, searchQuery, selectedFilter]);

  if (isCreating) {
    return <CreateTicketScreen onSuccess={handleCreateSuccess} />;
  }

  const renderTicket = ({ item }: { item: TicketListItem }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.ticket_no} numaralı ${item.title} servis kaydının detayını görüntüle`}
      onPress={() => handleTicketPress(item.id)}
      style={({ pressed }) => [
        styles.ticketCard,
        pressed && styles.ticketCardPressed,
      ]}
    >
      <View style={styles.ticketIcon}>
        <Text style={styles.ticketIconText}>⚙</Text>
      </View>

      <View style={styles.ticketContent}>
        <View style={styles.ticketTopRow}>
          <Text style={styles.ticketTitle} numberOfLines={2}>
            {item.title}
          </Text>

          <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
            <Text style={styles.statusText}>
              {STATUS_LABELS[item.status] ?? item.status}
            </Text>
          </View>
        </View>

        <Text style={styles.ticketNumber} numberOfLines={1}>
          #{item.ticket_no}
        </Text>

        <View style={styles.ticketBottomRow}>
          <Text style={styles.categoryText} numberOfLines={1}>
            {item.category_name ?? 'Kategorisiz'}
          </Text>
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        </View>
      </View>
    </Pressable>
  );

  const listHeader = (
    <View style={styles.listHeader}>
      <View style={styles.header}>
        <Text style={styles.heading}>Taleplerim</Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => setIsCreating(true)}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.addButtonText}>+ Yeni</Text>
        </Pressable>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Talep ara..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
      >
        {FILTERS.map((filter) => {
          const isSelected = selectedFilter === filter.value;

          return (
            <Pressable
              key={filter.value}
              onPress={() => setSelectedFilter(filter.value)}
              style={[
                styles.filterButton,
                isSelected && styles.selectedFilterButton,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  isSelected && styles.selectedFilterText,
                ]}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View
      style={[
        styles.safeArea,
        {
          paddingTop: insets.top,
        },
      ]}
    >
      {isLoading ? (
        <>
          {listHeader}
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.helperText}>Talepler yükleniyor...</Text>
          </View>
        </>
      ) : errorMessage ? (
        <>
          {listHeader}
          <View style={styles.centerContent}>
            <Text style={styles.helperText}>{errorMessage}</Text>
            <Pressable
              onPress={() => void fetchTickets()}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Tekrar Dene</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicket}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Talep bulunamadı</Text>
              <Text style={styles.helperText}>
                Aramanı veya seçtiğin filtreyi değiştirebilirsin.
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void fetchTickets(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listHeader: {
    width: '100%',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heading: {
    ...typography.title,
    color: colors.text,
    fontWeight: '700',
    flex: 1,
    flexShrink: 1,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    flexShrink: 0,
  },
  addButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
  searchContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    height: 46,
  },
  searchIcon: {
    color: colors.primary,
    fontSize: 24,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    ...typography.body,
    color: colors.text,
    paddingVertical: 0,
  },
  filterList: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedFilterButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
  },
  selectedFilterText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  separator: {
    height: spacing.md,
  },
  ticketCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  ticketCardPressed: {
    opacity: 0.75,
    borderColor: colors.primary,
  },
  ticketIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ticketIconText: {
    color: colors.primary,
    fontSize: 20,
  },
  ticketContent: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  ticketTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  ticketTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
    maxWidth: '45%',
  },
  pendingBadge: {
    backgroundColor: '#FEF0D5',
  },
  progressBadge: {
    backgroundColor: '#E9DFFF',
  },
  completedBadge: {
    backgroundColor: '#D7F5E5',
  },
  cancelledBadge: {
    backgroundColor: '#FDE2E2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333333',
  },
  ticketNumber: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 11,
  },
  ticketBottomRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  categoryText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 11,
    flex: 1,
    minWidth: 0,
  },
  dateText: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 11,
    flexShrink: 0,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  helperText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  retryButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
