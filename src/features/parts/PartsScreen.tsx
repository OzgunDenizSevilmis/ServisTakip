import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addPart,
  createStockEntry,
  getParts,
  getCurrentUserContext,
  getMyTickets,
  getStockMovementHistory,
  recordPartUsage,
  setPartActive,
  updatePart,
  type CurrentUserContext,
  type Part,
  type PartInput,
  type StockMovementHistoryItem,
  type TicketListItem,
} from '../../services/tickets/ticketService';

const COLORS = {
  background: '#F4F7FB',
  surface: '#FFFFFF',
  primary: '#2563EB',
  primaryLight: '#EAF1FF',
  text: '#172033',
  secondary: '#64748B',
  border: '#E2E8F0',
  success: '#16A36A',
  successLight: '#E8F7EF',
  warning: '#D97706',
  warningLight: '#FFF5E5',
  danger: '#DC2626',
  dangerLight: '#FEECEC',
  white: '#FFFFFF',
};

type OperationType = 'entry' | 'usage';

type OperationModalProps = {
  visible: boolean;
  operationType: OperationType;
  part: Part | null;
  tickets: TicketListItem[];
  onClose: () => void;
  onSubmit: (
    quantity: number,
    reason: string,
    ticketId: string | null,
  ) => Promise<void>;
};

function createRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === 'x' ? random : (random & 0x3) | 0x8;

      return value.toString(16);
    },
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Tarih bilgisi yok';
  }

  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
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
      return 'Stok girişi';
    case 'usage':
      return 'Parça kullanımı';
    case 'usage_reversal':
      return 'Kullanım iadesi';
  }
}

function getMovementColor(
  type: StockMovementHistoryItem['movement_type'],
): string {
  switch (type) {
    case 'entry':
    case 'usage_reversal':
      return COLORS.success;
    case 'usage':
      return COLORS.danger;
  }
}

function OperationModal({
  visible,
  operationType,
  part,
  tickets,
  onClose,
  onSubmit,
}: OperationModalProps) {
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isUsage = operationType === 'usage';

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    setQuantity('1');
    setReason('');
    setSelectedTicketId('');
    setErrorMessage('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!part || isSubmitting) {
      return;
    }

    const parsedQuantity = Number(quantity);

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setErrorMessage('Miktar pozitif bir tam sayı olmalıdır.');
      return;
    }

    if (isUsage && parsedQuantity > part.stock_quantity) {
      setErrorMessage('Girilen miktar mevcut stoktan fazla olamaz.');
      return;
    }

    if (!reason.trim()) {
      setErrorMessage('İşlem açıklaması zorunludur.');
      return;
    }

    if (reason.trim().length > 500) {
      setErrorMessage('Açıklama en fazla 500 karakter olabilir.');
      return;
    }

    if (isUsage && !selectedTicketId) {
      setErrorMessage('Bir servis kaydı seçmelisiniz.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await onSubmit(
        parsedQuantity,
        reason.trim(),
        isUsage ? selectedTicketId : null,
      );

      setQuantity('1');
      setReason('');
      setSelectedTicketId('');
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'İşlem gerçekleştirilemedi.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderText}>
              <Text style={styles.modalTitle}>
                {isUsage ? 'Parça Kullanımı' : 'Stok Girişi'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {part?.name ?? ''}
              </Text>
            </View>

            <Pressable
              onPress={handleClose}
              disabled={isSubmitting}
              style={styles.closeButton}
            >
              <Ionicons
                name="close"
                size={22}
                color={COLORS.text}
              />
            </Pressable>
          </View>

          {part && (
            <View style={styles.selectedPartBox}>
              <Text style={styles.selectedPartCode}>
                {part.code}
              </Text>
              <Text style={styles.selectedPartStock}>
                Mevcut stok: {part.stock_quantity} {part.unit}
              </Text>
            </View>
          )}

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {isUsage && (
              <>
                <Text style={styles.inputLabel}>Servis kaydı</Text>

                {tickets.length === 0 ? (
                  <Text style={styles.emptyTicketText}>
                    Parça kullanabileceğiniz devam eden servis kaydı
                    bulunamadı.
                  </Text>
                ) : (
                  <View style={styles.ticketList}>
                    {tickets.map((ticket) => {
                      const selected = selectedTicketId === ticket.id;

                      return (
                        <Pressable
                          key={ticket.id}
                          style={[
                            styles.ticketOption,
                            selected && styles.ticketOptionSelected,
                          ]}
                          onPress={() => {
                            setSelectedTicketId(ticket.id);
                            setErrorMessage('');
                          }}
                        >
                          <View style={styles.ticketOptionContent}>
                            <Text style={styles.ticketNumber}>
                              {ticket.ticket_no}
                            </Text>
                            <Text
                              style={styles.ticketTitle}
                              numberOfLines={2}
                            >
                              {ticket.title}
                            </Text>
                          </View>

                          {selected && (
                            <Ionicons
                              name="checkmark-circle"
                              size={21}
                              color={COLORS.primary}
                            />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            <Text style={styles.inputLabel}>Miktar</Text>
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              placeholder="Miktar girin"
              placeholderTextColor={COLORS.secondary}
              style={styles.input}
              editable={!isSubmitting}
            />

            <Text style={styles.inputLabel}>Açıklama</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="İşlem açıklamasını girin..."
              placeholderTextColor={COLORS.secondary}
              multiline
              maxLength={500}
              textAlignVertical="top"
              style={styles.reasonInput}
              editable={!isSubmitting}
            />

            {errorMessage ? (
              <View style={styles.formError}>
                <Ionicons
                  name="alert-circle-outline"
                  size={17}
                  color={COLORS.danger}
                />
                <Text style={styles.formErrorText}>
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={handleClose}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Vazgeç</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.submitButton,
                  isSubmitting && styles.disabledButton,
                ]}
                onPress={() => void handleSubmit()}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.submitButtonText}>
                    Kaydet
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type PartFormModalProps = {
  visible: boolean;
  part: Part | null;
  onClose: () => void;
  onSave: (input: PartInput) => Promise<void>;
};

function PartFormModal({
  visible,
  part,
  onClose,
  onSave,
}: PartFormModalProps) {
  const [code, setCode] = useState(part?.code ?? '');
  const [name, setName] = useState(part?.name ?? '');
  const [unit, setUnit] = useState(part?.unit ?? '');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const input = {
      code: code.trim(),
      name: name.trim(),
      unit: unit.trim(),
    };

    if (!input.code || !input.name || !input.unit) {
      setErrorMessage('Parça kodu, adı ve birimi zorunludur.');
      return;
    }

    if (
      input.code.length > 100 ||
      input.name.length > 200 ||
      input.unit.length > 50
    ) {
      setErrorMessage(
        'Kod en fazla 100, ad 200, birim 50 karakter olabilir.',
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

 try {
  console.log('[PartFormModal] Gönderilen veri:', input);

  await onSave(input);

  console.log('[PartFormModal] Kayıt başarılı.');
  onClose();
} catch (error) {
  console.error('[PartFormModal] Kayıt hatası:', error);

  if (error instanceof Error) {
    console.error('[PartFormModal] Stack:', error.stack);
  }

  setErrorMessage(
    error instanceof Error
      ? error.message
      : String(error),
  );
} finally {
  setIsSubmitting(false);
}
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={isSubmitting ? undefined : onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderText}>
              <Text style={styles.modalTitle}>
                {part ? 'Parçayı Düzenle' : 'Yeni Parça Ekle'}
              </Text>
              <Text style={styles.modalSubtitle}>
                Parça envanter bilgilerini girin.
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              disabled={isSubmitting}
              style={styles.closeButton}
            >
              <Ionicons
                name="close"
                size={22}
                color={COLORS.text}
              />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>Parça kodu</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Örn. PRC-001"
              placeholderTextColor={COLORS.secondary}
              style={styles.input}
              autoCapitalize="characters"
              editable={!isSubmitting}
              maxLength={100}
            />

            <Text style={styles.inputLabel}>Parça adı</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Parça adını girin"
              placeholderTextColor={COLORS.secondary}
              style={styles.input}
              editable={!isSubmitting}
              maxLength={200}
            />

            <Text style={styles.inputLabel}>Birim</Text>
            <TextInput
              value={unit}
              onChangeText={setUnit}
              placeholder="Örn. adet, metre"
              placeholderTextColor={COLORS.secondary}
              style={styles.input}
              editable={!isSubmitting}
              maxLength={50}
            />

            {errorMessage ? (
              <View style={styles.formError}>
                <Ionicons
                  name="alert-circle-outline"
                  size={17}
                  color={COLORS.danger}
                />
                <Text style={styles.formErrorText}>
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={onClose}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Vazgeç</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.submitButton,
                  isSubmitting && styles.disabledButton,
                ]}
                onPress={() => void handleSubmit()}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.submitButtonText}>Kaydet</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function PartsScreen() {
  const insets = useSafeAreaInsets();

  const [partFormVisible, setPartFormVisible] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [isPartActionLoading, setIsPartActionLoading] = useState(false);

  const [parts, setParts] = useState<Part[]>([]);
  const [history, setHistory] = useState<StockMovementHistoryItem[]>([]);
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [userContext, setUserContext] =
    useState<CurrentUserContext | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>(
    'inventory',
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [operationType, setOperationType] =
    useState<OperationType>('entry');
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [detailPart, setDetailPart] = useState<Part | null>(null);

  const isManager = userContext?.role === 'manager';
  const isTechnician = userContext?.role === 'technician';

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setErrorMessage('');

    try {
      const context = await getCurrentUserContext();
      const partData = await getParts(context.role === 'manager');

      setUserContext(context);
      setParts(partData);

      if (context.role === 'manager') {
        const historyData = await getStockMovementHistory();
        setHistory(historyData);
      } else {
        setHistory([]);
      }

      if (context.role === 'technician') {
        const ticketData = await getMyTickets();

        setTickets(
          ticketData.filter(
            (ticket) => ticket.status === 'in_progress',
          ),
        );
      } else {
        setTickets([]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Parça bilgileri yüklenemedi.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const filteredParts = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('tr-TR');

    if (!query) {
      return parts;
    }

    return parts.filter((part) => {
      return (
        part.name.toLocaleLowerCase('tr-TR').includes(query) ||
        part.code.toLocaleLowerCase('tr-TR').includes(query)
      );
    });
  }, [parts, searchQuery]);

  const totalStock = useMemo(() => {
    return parts.reduce(
      (total, part) => total + part.stock_quantity,
      0,
    );
  }, [parts]);

  const lowStockCount = useMemo(() => {
    return parts.filter((part) => part.stock_quantity <= 5).length;
  }, [parts]);

  const openOperation = (
    type: OperationType,
    part: Part,
  ) => {
    setOperationType(type);
    setSelectedPart(part);
    setModalVisible(true);
  };

  const handleOperation = async (
    quantity: number,
    reason: string,
    ticketId: string | null,
  ) => {
    if (!selectedPart) {
      throw new Error('Parça seçimi bulunamadı.');
    }

    const requestId = createRequestId();

    if (operationType === 'entry') {
      await createStockEntry(
        requestId,
        selectedPart.id,
        quantity,
        reason,
      );
    } else {
      if (!ticketId) {
        throw new Error('Servis kaydı seçilmelidir.');
      }

      await recordPartUsage(
        requestId,
        ticketId,
        selectedPart.id,
        quantity,
        reason,
      );
    }

    await loadData(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedPart(null);
  };

  const openAddPart = () => {
    setEditingPart(null);
    setPartFormVisible(true);
  };

  const openEditPart = (part: Part) => {
    setDetailPart(null);
    setEditingPart(part);
    setPartFormVisible(true);
  };

  const handleSavePart = async (input: PartInput) => {
    setIsPartActionLoading(true);

    try {
      if (editingPart) {
        await updatePart(editingPart.id, input);
      } else {
        await addPart(input);
      }

      setPartFormVisible(false);
      setEditingPart(null);

      await loadData(true);
    } finally {
      setIsPartActionLoading(false);
    }
  };

  const handleTogglePartActive = (part: Part) => {
    if (!isManager || isPartActionLoading) {
      return;
    }

    const nextActive = !part.is_active;

    if (!nextActive && part.stock_quantity !== 0) {
      Alert.alert(
        'Stok mevcut',
        'Stok miktarı sıfır olmayan bir parça pasife alınamaz.',
      );
      return;
    }

    Alert.alert(
      nextActive ? 'Parçayı aktifleştir' : 'Parçayı pasife al',
      nextActive
        ? `"${part.name}" parçası yeniden envantere eklenecek.`
        : `"${part.name}" parçası envanterden kaldırılacak.`,
      [
        {
          text: 'Vazgeç',
          style: 'cancel',
        },
        {
          text: nextActive ? 'Aktifleştir' : 'Pasife al',
          style: nextActive ? 'default' : 'destructive',
          onPress: () => {
            void (async () => {
              setIsPartActionLoading(true);

              try {
                await setPartActive(part.id, nextActive);
                setDetailPart(null);
                await loadData(true);
              } catch (error) {
                Alert.alert(
                  'İşlem başarısız',
                  error instanceof Error
                    ? error.message
                    : 'Parça durumu güncellenemedi.',
                );
              } finally {
                setIsPartActionLoading(false);
              }
            })();
          },
        },
      ],
    );
  };

  const renderPart = ({ item }: { item: Part }) => {
    const isLowStock = item.stock_quantity <= 5;

    return (
      <Pressable
        style={styles.partCard}
        onPress={() => setDetailPart(item)}
        android_ripple={{ color: COLORS.primaryLight }}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, parça detaylarını görüntüle`}
      >
        <View style={styles.partHeader}>
          <View style={styles.partIcon}>
            <Ionicons
              name="cube-outline"
              size={22}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.partInfo}>
            <Text style={styles.partName}>{item.name}</Text>
            <Text style={styles.partCode}>{item.code}</Text>

            {!item.is_active && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>Pasif</Text>
              </View>
            )}
          </View>

          <View
            style={[
              styles.stockBadge,
              isLowStock && styles.lowStockBadge,
            ]}
          >
            <Text
              style={[
                styles.stockValue,
                isLowStock && styles.lowStockText,
              ]}
            >
              {item.stock_quantity}
            </Text>
            <Text
              style={[
                styles.stockUnit,
                isLowStock && styles.lowStockText,
              ]}
            >
              {item.unit}
            </Text>
          </View>
        </View>

        {isLowStock && (
          <View style={styles.lowStockNotice}>
            <Ionicons
              name="alert-circle-outline"
              size={15}
              color={COLORS.warning}
            />
            <Text style={styles.lowStockNoticeText}>
              Stok seviyesi düşük
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  const renderHistory = ({
    item,
  }: {
    item: StockMovementHistoryItem;
  }) => {
    const color = getMovementColor(item.movement_type);
    const isEntry = item.movement_type !== 'usage';

    return (
      <View style={styles.historyCard}>
        <View
          style={[
            styles.historyIcon,
            { backgroundColor: `${color}18` },
          ]}
        >
          <Ionicons
            name={
              item.movement_type === 'usage'
                ? 'arrow-up-outline'
                : 'arrow-down-outline'
            }
            size={20}
            color={color}
          />
        </View>

        <View style={styles.historyContent}>
          <Text style={styles.historyTitle}>
            {item.part_name}
          </Text>

          <Text style={styles.historySubtitle}>
            {item.part_code} · {getMovementLabel(item.movement_type)}
          </Text>

          <Text style={styles.historyMeta}>
            {item.actor_name} · {formatDate(item.created_at)}
          </Text>

          {item.ticket_no ? (
            <Text style={styles.historyMeta}>
              Servis: {item.ticket_no}
            </Text>
          ) : null}

          {item.reason ? (
            <Text style={styles.historyReason}>
              {item.reason}
            </Text>
          ) : null}
        </View>

        <Text
          style={[
            styles.historyQuantity,
            { color },
          ]}
        >
          {isEntry ? '+' : '-'}
          {item.quantity}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
        <Text style={styles.loadingText}>
          Parçalar yükleniyor...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList<Part | StockMovementHistoryItem>
        data={activeTab === 'inventory' ? filteredParts : history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          if ('stock_quantity' in item) {
            return renderPart({ item });
          }

          return renderHistory({ item });
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadData(true)}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: 14 + insets.top },
        ]}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Parça Envanteri</Text>
                <Text style={styles.subtitle}>
                  Parça ve stok durumunu takip edin.
                </Text>
              </View>

              <View style={styles.headerIcon}>
                <Ionicons
                  name="cube-outline"
                  size={25}
                  color={COLORS.primary}
                />
              </View>
            </View>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={19}
                  color={COLORS.danger}
                />
                <Text style={styles.errorText}>
                  {errorMessage}
                </Text>
                <Pressable onPress={() => void loadData()}>
                  <Text style={styles.retryText}>Tekrar dene</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Parça çeşidi</Text>
                <Text style={styles.statValue}>
                  {parts.length}
                </Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Toplam stok</Text>
                <Text style={styles.statValue}>
                  {totalStock}
                </Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Düşük stok</Text>
                <Text
                  style={[
                    styles.statValue,
                    lowStockCount > 0 && styles.warningValue,
                  ]}
                >
                  {lowStockCount}
                </Text>
              </View>
            </View>

            <View style={styles.tabs}>
              <Pressable
                style={[
                  styles.tab,
                  activeTab === 'inventory' && styles.activeTab,
                ]}
                onPress={() => setActiveTab('inventory')}
              >
                <Ionicons
                  name="cube-outline"
                  size={17}
                  color={
                    activeTab === 'inventory'
                      ? COLORS.primary
                      : COLORS.secondary
                  }
                />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'inventory' && styles.activeTabText,
                  ]}
                >
                  Envanter
                </Text>
              </Pressable>

              {isManager && (
                <Pressable
                  style={[
                    styles.tab,
                    activeTab === 'history' && styles.activeTab,
                  ]}
                  onPress={() => setActiveTab('history')}
                >
                  <Ionicons
                    name="time-outline"
                    size={17}
                    color={
                      activeTab === 'history'
                        ? COLORS.primary
                        : COLORS.secondary
                    }
                  />
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === 'history' && styles.activeTabText,
                    ]}
                  >
                    Hareket geçmişi
                  </Text>
                </Pressable>
              )}
            </View>

            {activeTab === 'inventory' && (
              <>
                <View style={styles.searchContainer}>
                  <Ionicons
                    name="search-outline"
                    size={19}
                    color={COLORS.secondary}
                  />

                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Parça adı veya kodu ara..."
                    placeholderTextColor={COLORS.secondary}
                    style={styles.searchInput}
                    returnKeyType="search"
                  />

                  {searchQuery.length > 0 && (
                    <Pressable
                      onPress={() => setSearchQuery('')}
                    >
                      <Ionicons
                        name="close-circle"
                        size={19}
                        color={COLORS.secondary}
                      />
                    </Pressable>
                  )}
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    Parçalar ({filteredParts.length})
                  </Text>

                  {isManager && (
                    <Pressable
                      style={styles.addPartButton}
                      onPress={openAddPart}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name="add"
                        size={18}
                        color={COLORS.white}
                      />
                      <Text style={styles.addPartButtonText}>
                        Parça ekle
                      </Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}

            {activeTab === 'history' && (
              <Text style={styles.sectionTitle}>
                Son stok hareketleri
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="file-tray-outline"
              size={42}
              color={COLORS.secondary}
            />
            <Text style={styles.emptyTitle}>
              {activeTab === 'inventory'
                ? searchQuery
                  ? 'Aramanızla eşleşen parça bulunamadı.'
                  : 'Henüz parça kaydı bulunmuyor.'
                : 'Henüz stok hareketi bulunmuyor.'}
            </Text>
          </View>
        }
      />

      <OperationModal
        visible={modalVisible}
        operationType={operationType}
        part={selectedPart}
        tickets={tickets}
        onClose={closeModal}
        onSubmit={handleOperation}
      />

      {partFormVisible && (
        <PartFormModal
          key={editingPart?.id ?? 'new-part'}
          visible={partFormVisible}
          part={editingPart}
          onClose={() => {
            setPartFormVisible(false);
            setEditingPart(null);
          }}
          onSave={handleSavePart}
        />
      )}

      <Modal
        visible={detailPart !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailPart(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>Parça Detayları</Text>
                <Text style={styles.modalSubtitle}>
                  Envanter bilgileri
                </Text>
              </View>

              <Pressable
                onPress={() => setDetailPart(null)}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Detayları kapat"
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={COLORS.text}
                />
              </Pressable>
            </View>

            {detailPart && (
              <>
                <View style={styles.detailIcon}>
                  <Ionicons
                    name="cube-outline"
                    size={30}
                    color={COLORS.primary}
                  />
                </View>

                <Text style={styles.detailName}>
                  {detailPart.name}
                </Text>
                <Text style={styles.detailCode}>
                  {detailPart.code}
                </Text>

                {!detailPart.is_active && (
                  <View style={styles.inactiveDetailBadge}>
                    <Text style={styles.inactiveBadgeText}>
                      Pasif parça
                    </Text>
                  </View>
                )}

                <View style={styles.detailStockBox}>
                  <Text style={styles.detailStockLabel}>
                    Mevcut stok
                  </Text>
                  <Text
                    style={[
                      styles.detailStockValue,
                      detailPart.stock_quantity <= 5 &&
                        styles.warningValue,
                    ]}
                  >
                    {detailPart.stock_quantity} {detailPart.unit}
                  </Text>
                  <Text style={styles.detailStockStatus}>
                    {detailPart.stock_quantity <= 5
                      ? 'Stok seviyesi düşük'
                      : 'Stok seviyesi normal'}
                  </Text>
                </View>

                {isManager && (
                  <>
                    <Pressable
                      style={styles.secondaryActionButton}
                      onPress={() => openEditPart(detailPart)}
                    >
                      <Ionicons
                        name="create-outline"
                        size={19}
                        color={COLORS.primary}
                      />
                      <Text style={styles.secondaryActionText}>
                        Parçayı düzenle
                      </Text>
                    </Pressable>

                    {detailPart.is_active && (
                      <Pressable
                        style={styles.detailActionButton}
                        onPress={() => {
                          const part = detailPart;
                          setDetailPart(null);
                          openOperation('entry', part);
                        }}
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={19}
                          color={COLORS.white}
                        />
                        <Text style={styles.actionButtonText}>
                          Stok girişi yap
                        </Text>
                      </Pressable>
                    )}

                    <Pressable
                      style={[
                        styles.detailActionButton,
                        detailPart.is_active
                          ? styles.deactivateButton
                          : styles.activateButton,
                        isPartActionLoading && styles.disabledButton,
                      ]}
                      disabled={isPartActionLoading}
                      onPress={() => handleTogglePartActive(detailPart)}
                    >
                      <Ionicons
                        name={
                          detailPart.is_active
                            ? 'archive-outline'
                            : 'checkmark-circle-outline'
                        }
                        size={19}
                        color={COLORS.white}
                      />
                      <Text style={styles.actionButtonText}>
                        {detailPart.is_active
                          ? 'Parçayı pasife al'
                          : 'Parçayı aktifleştir'}
                      </Text>
                    </Pressable>
                  </>
                )}

                {isTechnician && detailPart.is_active && (
  <Pressable
    style={[
      styles.usageButton,
      styles.detailActionButton,
      detailPart.stock_quantity <= 0 && styles.disabledButton,
    ]}
    disabled={detailPart.stock_quantity <= 0}
    onPress={() => {
      const part = detailPart;
      setDetailPart(null);
      openOperation('usage', part);
    }}
  >
    <Ionicons
      name="construct-outline"
      size={20}
      color={COLORS.white}
    />
    <Text style={styles.actionButtonText}>
      Parça Kullan
    </Text>
  </Pressable>
)}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.secondary,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 36,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.secondary,
    fontSize: 13,
    marginTop: 5,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
  },
  retryText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 13,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    color: COLORS.secondary,
    fontSize: 11,
    marginBottom: 8,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: '700',
  },
  warningValue: {
    color: COLORS.warning,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 9,
  },
  activeTab: {
    backgroundColor: COLORS.primaryLight,
  },
  tabText: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  activeTabText: {
    color: COLORS.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    height: 46,
    color: COLORS.text,
    fontSize: 14,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  addPartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginBottom: 13,
  },
  addPartButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  inactiveBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.dangerLight,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 6,
  },
  inactiveDetailBadge: {
    alignSelf: 'center',
    backgroundColor: COLORS.dangerLight,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 9,
  },
  inactiveBadgeText: {
    color: COLORS.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 8,
  },
  secondaryActionText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  deactivateButton: {
    backgroundColor: COLORS.danger,
  },
  activateButton: {
    backgroundColor: COLORS.success,
  },
  partCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 17,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
  },
  partHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partIcon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  partInfo: {
    flex: 1,
  },
  partName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  partCode: {
    color: COLORS.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  stockBadge: {
    minWidth: 62,
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 9,
  },
  lowStockBadge: {
    backgroundColor: COLORS.warningLight,
  },
  stockValue: {
    color: COLORS.success,
    fontSize: 18,
    fontWeight: '700',
  },
  stockUnit: {
    color: COLORS.success,
    fontSize: 10,
  },
  lowStockText: {
    color: COLORS.warning,
  },
  lowStockNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  lowStockNoticeText: {
    color: COLORS.warning,
    fontSize: 11,
  },
  usageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.success,
    paddingVertical: 11,
    borderRadius: 10,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.45,
  },
  detailContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 32,
  },
  detailIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 14,
  },
  detailName: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  detailCode: {
    color: COLORS.secondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 5,
  },
  detailStockBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 18,
  },
  detailStockLabel: {
    color: COLORS.secondary,
    fontSize: 13,
  },
  detailStockValue: {
    color: COLORS.success,
    fontSize: 30,
    fontWeight: '800',
    marginTop: 7,
  },
  detailStockStatus: {
    color: COLORS.secondary,
    fontSize: 12,
    marginTop: 5,
  },
detailActionButton: {
  width: '100%',
  minHeight: 48,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
  backgroundColor: COLORS.primary,
  paddingVertical: 13,
  borderRadius: 12,
  marginTop: 10,
},

  historyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  historyContent: {
    flex: 1,
  },
  historyTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  historySubtitle: {
    color: COLORS.secondary,
    fontSize: 12,
    marginTop: 3,
  },
  historyMeta: {
    color: COLORS.secondary,
    fontSize: 11,
    marginTop: 5,
  },
  historyReason: {
    color: COLORS.text,
    fontSize: 12,
    marginTop: 8,
  },
  historyQuantity: {
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 45,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: COLORS.secondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 13,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  modalContainer: {
    maxHeight: '90%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    paddingBottom: 28,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 17,
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: COLORS.secondary,
    fontSize: 13,
    marginTop: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPartBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 13,
    marginBottom: 14,
  },
  selectedPartCode: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  selectedPartStock: {
    color: COLORS.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  inputLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 15,
    marginBottom: 8,
  },
  input: {
    height: 47,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: 13,
    fontSize: 14,
  },
  reasonInput: {
    minHeight: 90,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    padding: 13,
    fontSize: 14,
  },
  emptyTicketText: {
    color: COLORS.warning,
    backgroundColor: COLORS.warningLight,
    padding: 12,
    borderRadius: 10,
    fontSize: 12,
  },
  ticketList: {
    gap: 8,
  },
  ticketOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
  },
  ticketOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  ticketOptionContent: {
    flex: 1,
  },
  ticketNumber: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  ticketTitle: {
    color: COLORS.text,
    fontSize: 12,
    marginTop: 4,
  },
  formError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.dangerLight,
    padding: 11,
    borderRadius: 10,
    marginTop: 13,
  },
  formErrorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  submitButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
});