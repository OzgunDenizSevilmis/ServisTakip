
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { AppStackParamList } from '../../navigation/types';
import {
  assignTicket,
  createStockEntry,
  getActiveParts,
  getAssignableTechnicians,
  getCurrentUserContext,
  getTicketDetail,
  getTicketAttachments,
  getTicketHistory,
  getTicketPeople,
  getTicketStockMovements,
  recordPartUsage,
  reversePartUsage,
  updateTicketStatus,
  setTicketPriority,
type TicketPriority,
  type AssignableTechnician,
  type CurrentUserContext,
  type Part,
  type TicketDetail,
  type TicketAttachmentWithUrl,
  type TicketHistoryItem,
  type TicketPerson,
  type TicketStatus,
  type TicketStockMovement,
  getTicketMessages,
sendTicketMessage,
type TicketMessage,
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

function createRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;

    return value.toString(16);
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
    stock_usage: 'Parça kullanıldı',
    stock_usage_reversed: 'Parça kullanımı geri alındı',
  };

  return labels[action] ?? action.replaceAll('_', ' ');
}

function formatHistoryValue(field: string, value: unknown): string {
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

function getAvailableStatusTransitions(
  status: TicketStatus,
  role: CurrentUserContext['role'],
  assignedTo: string | null,
  userId: string,
  createdBy: string,
): TicketStatus[] {
  // Yönetici tüm durumlar arasında geçiş yapabilir.
  if (role === 'manager') {
    const allStatuses: TicketStatus[] = [
      'open',
      'assigned',
      'in_progress',
      'waiting_parts',
      'resolved',
      'closed',
      'cancelled',
    ];

    return allStatuses.filter((nextStatus) => nextStatus !== status);
  }

  // Çalışan yalnızca kendi kaydının çözümünü kabul veya reddedebilir.
  if (role === 'employee') {
    if (createdBy === userId && status === 'resolved') {
      return ['closed', 'in_progress'];
    }

    return [];
  }

  // Teknisyen yalnızca kendisine atanmış kaydı yönetebilir.
  if (assignedTo !== userId) return [];

  switch (status) {
    case 'assigned':
      return ['in_progress'];
    case 'in_progress':
      return ['waiting_parts', 'resolved'];
    case 'waiting_parts':
      return ['in_progress', 'resolved'];
    default:
      return [];
  }
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
  const [attachments, setAttachments] = useState<TicketAttachmentWithUrl[]>([]);
  const [people, setPeople] = useState<TicketPerson[]>([]);
  const [technicians, setTechnicians] = useState<AssignableTechnician[]>([]);
  const [currentUser, setCurrentUser] =
    useState<CurrentUserContext | null>(null);

  const [parts, setParts] = useState<Part[]>([]);
  const [stockMovements, setStockMovements] = useState<
    TicketStockMovement[]
  >([]);

  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [partQuantity, setPartQuantity] = useState('1');
  const [partReason, setPartReason] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [messages, setMessages] = useState<TicketMessage[]>([]);
const [messageText, setMessageText] = useState('');
const [sendingMessage, setSendingMessage] = useState(false);
const [messageError, setMessageError] = useState<string | null>(null);



  const [reversingMovementId, setReversingMovementId] = useState<
    string | null
  >(null);
  const [reversalReason, setReversalReason] = useState('');

  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingAssignment, setUpdatingAssignment] = useState(false);
  const [savingPart, setSavingPart] = useState(false);
  const [savingStockEntry, setSavingStockEntry] = useState(false);

const [stockEntryPartId, setStockEntryPartId] = useState<string | null>(null);
const [stockEntryQuantity, setStockEntryQuantity] = useState('1');
const [stockEntryReason, setStockEntryReason] = useState('');

const [stockEntryError, setStockEntryError] = useState<string | null>(null);
const [stockEntryMessage, setStockEntryMessage] = useState<string | null>(null);
  const [reversingPart, setReversingPart] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(
    null,
  );
  const [partError, setPartError] = useState<string | null>(null);
  const [partMessage, setPartMessage] = useState<string | null>(null);
  const [reversalError, setReversalError] = useState<string | null>(null);
  const [reversalMessage, setReversalMessage] = useState<string | null>(null);

  const fetchTicket = useCallback(async () => {
    const userContext = await getCurrentUserContext();

 const [
  ticketData,
  historyData,
  peopleData,
  technicianData,
  partData,
  movementData,
  attachmentData,
  messageData,
] = await Promise.all([
      getTicketDetail(ticketId),
      getTicketHistory(ticketId),
      getTicketPeople(ticketId),
      userContext.role === 'manager'
        ? getAssignableTechnicians()
        : Promise.resolve([]),
      getActiveParts(),
      getTicketStockMovements(ticketId),
      getTicketAttachments(ticketId),
      getTicketMessages(ticketId),
    ]);

    return {
      ticketData,
      historyData,
      peopleData,
      technicianData,
      partData,
      movementData,
      attachmentData,
      userContext,
      messageData,
    };
  }, [ticketId]);
const applyTicketData = useCallback(
  (data: Awaited<ReturnType<typeof fetchTicket>>) => {
    setTicket(data.ticketData);
    setHistory(data.historyData);
    setPeople(data.peopleData);
    setTechnicians(data.technicianData);
    setParts(data.partData);
    setStockMovements(data.movementData);
    setAttachments(data.attachmentData);
    setCurrentUser(data.userContext);
    setMessages(data.messageData);
  },
  [],
);


  const loadTicket = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchTicket();
      applyTicketData(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Servis bilgileri yüklenirken bir hata oluştu.',
      );
    } finally {
      setLoading(false);
    }
}, [fetchTicket, applyTicketData]);

  useEffect(() => {
    let isActive = true;

    fetchTicket()
      .then((data) => {
        if (isActive) {
          applyTicketData(data);
        }
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
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
}, [fetchTicket, applyTicketData]);

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

  const refreshTicketData = async () => {
    const data = await fetchTicket();
    applyTicketData(data);
  };

const handleStatusChange = async (newStatus: TicketStatus) => {
  if (!ticket || updatingStatus || updatingAssignment) return;

  const requiresNote =
    newStatus === 'cancelled' ||
    (ticket.status === 'resolved' && newStatus === 'in_progress');

  if (requiresNote && !statusNote.trim()) {
    setStatusError('Bu işlem için açıklama girmeniz gerekiyor.');
    return;
  }

  setUpdatingStatus(true);
  setStatusError(null);
  setStatusMessage(null);

  try {
    await updateTicketStatus(
      ticket,
      newStatus,
      requiresNote ? statusNote : undefined,
    );

    setStatusNote('');
    await refreshTicketData();

    setStatusMessage('Servis durumu başarıyla güncellendi.');
  } catch (err) {
    setStatusError(
      err instanceof Error
        ? err.message
        : 'Servis durumu güncellenirken bir hata oluştu.',
    );
  } finally {
    setUpdatingStatus(false);
  }
};

const handlePriorityChange = async (priority: TicketPriority) => {
  if (
    !ticket ||
    currentUser?.role !== 'manager' ||
    updatingPriority ||
    ticket.priority === priority ||
    ['closed', 'cancelled'].includes(ticket.status)
  ) {
    return;
  }

  setUpdatingPriority(true);
  setPriorityError(null);
  setPriorityMessage(null);

  try {
    await setTicketPriority(ticket, priority);

    await refreshTicketData();

    setPriorityMessage('Servis önceliği başarıyla güncellendi.');
  } catch (err) {
    setPriorityError(
      err instanceof Error
        ? err.message
        : 'Servis önceliği güncellenemedi.',
    );
  } finally {
    setUpdatingPriority(false);
  }
};


const handleSendMessage = async () => {
  if (
    !ticket ||
    !currentUser ||
    !messageText.trim() ||
    sendingMessage ||
    ticket.status === 'closed' ||
    ticket.status === 'cancelled'
  ) {
    return;
  }

  setSendingMessage(true);
  setMessageError(null);

  try {
    await sendTicketMessage(ticket.id, messageText);

    setMessageText('');

    const updatedMessages = await getTicketMessages(ticket.id);
    setMessages(updatedMessages);
  } catch (err) {
    setMessageError(
      err instanceof Error
        ? err.message
        : 'Mesaj gönderilemedi.',
    );
  } finally {
    setSendingMessage(false);
  }
};

const [updatingPriority, setUpdatingPriority] = useState(false);
const [priorityError, setPriorityError] = useState<string | null>(null);
const [priorityMessage, setPriorityMessage] = useState<string | null>(null);



  const handleAssignmentChange = async (technicianId: string | null) => {
    if (!ticket || updatingAssignment || updatingStatus) return;

    setUpdatingAssignment(true);
    setAssignmentError(null);
    setAssignmentMessage(null);

    try {
      await assignTicket(ticket.id, technicianId);
      await refreshTicketData();

      setAssignmentMessage(
        technicianId
          ? 'Teknisyen ataması başarıyla güncellendi.'
          : 'Teknisyen ataması kaldırıldı.',
      );
    } catch (err) {
      setAssignmentError(
        err instanceof Error
          ? err.message
          : 'Teknisyen ataması sırasında bir hata oluştu.',
      );
    } finally {
      setUpdatingAssignment(false);
    }
  };
  const handleStockEntry = async () => {
  if (
    !currentUser ||
    currentUser.role !== 'manager' ||
    !stockEntryPartId ||
    savingStockEntry
  ) {
    return;
  }

  const quantity = Number(stockEntryQuantity);
  const reason = stockEntryReason.trim();

  if (!Number.isInteger(quantity) || quantity <= 0) {
    setStockEntryError('Geçerli ve sıfırdan büyük bir miktar girin.');
    return;
  }

  if (!reason) {
    setStockEntryError('Stok giriş açıklaması girin.');
    return;
  }

  const selectedPart = parts.find(
    (part) => part.id === stockEntryPartId,
  );

  if (!selectedPart) {
    setStockEntryError('Seçilen parça bulunamadı.');
    return;
  }

  setSavingStockEntry(true);
  setStockEntryError(null);
  setStockEntryMessage(null);

  try {
    await createStockEntry(
      createRequestId(),
      stockEntryPartId,
      quantity,
      reason,
    );

    await refreshTicketData();

    setStockEntryPartId(null);
    setStockEntryQuantity('1');
    setStockEntryReason('');

    setStockEntryMessage(
      `${selectedPart.name} için ${quantity} ${selectedPart.unit} stok girişi başarılı.`,
    );
  } catch (err) {
    setStockEntryError(
      err instanceof Error
        ? err.message
        : 'Stok girişi gerçekleştirilemedi.',
    );
  } finally {
    setSavingStockEntry(false);
  }
};


  const handleUsePart = async () => {
    if (!ticket || !selectedPartId || savingPart) return;

    const quantity = Number(partQuantity);
    const reason = partReason.trim();

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setPartError('Geçerli ve sıfırdan büyük bir miktar girin.');
      return;
    }

    if (!reason) {
      setPartError('Parça kullanım açıklaması girin.');
      return;
    }

    const selectedPart = parts.find((part) => part.id === selectedPartId);

    if (!selectedPart) {
      setPartError('Seçilen parça bulunamadı.');
      return;
    }

    if (quantity > selectedPart.stock_quantity) {
      setPartError('Girilen miktar mevcut stoktan fazla olamaz.');
      return;
    }

    setSavingPart(true);
    setPartError(null);
    setPartMessage(null);

    try {
      await recordPartUsage(
        createRequestId(),
        ticket.id,
        selectedPartId,
        quantity,
        reason,
      );

      await refreshTicketData();

      setSelectedPartId(null);
      setPartQuantity('1');
      setPartReason('');
      setPartMessage('Parça kullanımı başarıyla kaydedildi.');
    } catch (err) {
      setPartError(
        err instanceof Error
          ? err.message
          : 'Parça kullanımı kaydedilemedi.',
      );
    } finally {
      setSavingPart(false);
    }
  };

  const handleReversePart = async () => {
    if (!reversingMovementId || reversingPart) return;

    const reason = reversalReason.trim();

    if (!reason) {
      setReversalError('Geri alma gerekçesi girin.');
      return;
    }

    setReversingPart(true);
    setReversalError(null);
    setReversalMessage(null);

    try {
      await reversePartUsage(
        createRequestId(),
        reversingMovementId,
        reason,
      );

      await refreshTicketData();

      setReversingMovementId(null);
      setReversalReason('');
      setReversalMessage('Parça kullanımı başarıyla geri alındı.');
    } catch (err) {
      setReversalError(
        err instanceof Error
          ? err.message
          : 'Parça kullanımı geri alınamadı.',
      );
    } finally {
      setReversingPart(false);
    }
  };

const availableStatuses =
  ticket && currentUser
    ? getAvailableStatusTransitions(
        ticket.status,
        currentUser.role,
        ticket.assigned_to,
        currentUser.userId,
        ticket.created_by,
      )
    : [];


  const canUseParts =
    ticket?.status === 'in_progress' &&
    currentUser?.role === 'technician' &&
    ticket.assigned_to === currentUser.userId;

  const canReverseParts =
    ticket !== null &&
    currentUser !== null &&
    ['in_progress', 'waiting_parts'].includes(ticket.status) &&
    (currentUser.role === 'manager' ||
      (currentUser.role === 'technician' &&
        ticket.assigned_to === currentUser.userId));

  const reversedMovementIds = new Set(
    stockMovements
      .filter(
        (movement) =>
          movement.type === 'usage_reversal' &&
          movement.reverses_movement_id,
      )
      .map((movement) => movement.reverses_movement_id),
  );

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
          keyboardShouldPersistTaps="handled"
        >
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
          {/* Öncelik yönetimi - Yalnızca yönetici */}
{currentUser?.role === 'manager' && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Öncelik Yönetimi</Text>

    <View style={styles.infoCard}>
      <Text style={styles.infoLabel}>
        Mevcut öncelik: {priorityLabels[ticket.priority]}
      </Text>

      <View style={styles.priorityOptions}>
        {(['low', 'normal', 'high'] as const).map((priority) => (
          <Pressable
            key={priority}
            style={[
              styles.priorityOption,
              ticket.priority === priority &&
                styles.selectedPriorityOption,
              updatingPriority && styles.disabledButton,
            ]}
            onPress={() => handlePriorityChange(priority)}
            disabled={
              updatingPriority ||
              ticket.priority === priority ||
              ['closed', 'cancelled'].includes(ticket.status)
            }
          >
            <Text
              style={[
                styles.priorityOptionText,
                ticket.priority === priority &&
                  styles.selectedPriorityOptionText,
              ]}
            >
              {priorityLabels[priority]}
            </Text>
          </Pressable>
        ))}
      </View>

      {updatingPriority && (
        <ActivityIndicator color={colors.primary} />
      )}

      {priorityError && (
        <Text style={styles.errorText}>{priorityError}</Text>
      )}

      {priorityMessage && (
        <Text style={styles.successText}>{priorityMessage}</Text>
      )}
    </View>
  </View>
)}
  

          {/* Teknisyen atama */}
          {currentUser?.role === 'manager' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Teknisyen Atama</Text>

              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Mevcut atama</Text>
                <Text style={styles.assignedPerson}>
                  {getPersonName(ticket.assigned_to)}
                </Text>

                {ticket.assigned_to ? (
                  <Pressable
                    style={[
                      styles.removeAssignmentButton,
                      updatingAssignment && styles.disabledButton,
                    ]}
                    onPress={() => handleAssignmentChange(null)}
                    disabled={updatingAssignment || updatingStatus}
                  >
                    <Text style={styles.removeAssignmentText}>
                      Atamayı Kaldır
                    </Text>
                  </Pressable>
                ) : null}

                <View style={styles.assignmentDivider} />

                <Text style={styles.infoValue}>
                  Atanabilecek teknisyenler
                </Text>

                {technicians.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Sistemde aktif teknisyen bulunamadı.
                  </Text>
                ) : (
                  technicians.map((technician) => {
                    const isAssigned =
                      ticket.assigned_to === technician.user_id;

                    return (
                      <View
                        key={technician.user_id}
                        style={styles.technicianRow}
                      >
                        <View style={styles.technicianInfo}>
                          <Text style={styles.technicianName}>
                            {technician.full_name?.trim() ||
                              'İsimsiz teknisyen'}
                          </Text>
                          <Text style={styles.technicianRole}>
                            Teknisyen
                          </Text>
                        </View>

                        <Pressable
                          style={[
                            styles.assignButton,
                            isAssigned && styles.assignedButton,
                            updatingAssignment && styles.disabledButton,
                          ]}
                          onPress={() =>
                            handleAssignmentChange(technician.user_id)
                          }
                          disabled={
                            isAssigned ||
                            updatingAssignment ||
                            updatingStatus
                          }
                        >
                          <Text
                            style={[
                              styles.assignButtonText,
                              isAssigned && styles.assignedButtonText,
                            ]}
                          >
                            {isAssigned ? 'Atandı' : 'Ata'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })
                )}

                {updatingAssignment && (
                  <View style={styles.statusFeedback}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.helperText}>
                      Atama güncelleniyor...
                    </Text>
                  </View>
                )}

                {assignmentError && (
                  <Text style={styles.errorText}>{assignmentError}</Text>
                )}

                {assignmentMessage && (
                  <Text style={styles.successText}>
                    {assignmentMessage}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Stok girişi - Yalnızca yönetici */}
{currentUser?.role === 'manager' && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Stok Girişi</Text>

    <View style={styles.infoCard}>
      <Text style={styles.infoValue}>
        Sisteme yeni parça stoğu ekleyebilirsiniz.
      </Text>

      <Text style={styles.inputLabel}>Parça seçin</Text>

      {parts.length === 0 ? (
        <Text style={styles.emptyText}>
          Sistemde aktif parça bulunamadı.
        </Text>
      ) : (
        parts.map((part) => {
          const selected = stockEntryPartId === part.id;

          return (
            <Pressable
              key={part.id}
              style={[
                styles.partOption,
                selected && styles.selectedPartOption,
                savingStockEntry && styles.disabledButton,
              ]}
              onPress={() => setStockEntryPartId(part.id)}
              disabled={savingStockEntry}
            >
              <View style={styles.partInfo}>
                <Text style={styles.partName}>{part.name}</Text>
                <Text style={styles.partCode}>{part.code}</Text>
              </View>

              <View style={styles.partStock}>
                <Text style={styles.stockQuantity}>
                  {part.stock_quantity} {part.unit}
                </Text>
                <Text style={styles.partCode}>
                  {selected ? 'Seçildi' : 'Mevcut stok'}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}

      <Text style={styles.inputLabel}>Eklenecek miktar</Text>

      <TextInput
        style={styles.textInput}
        value={stockEntryQuantity}
        onChangeText={setStockEntryQuantity}
        keyboardType="number-pad"
        placeholder="Örn. 10"
        placeholderTextColor={colors.textMuted}
        editable={!savingStockEntry}
      />

      <Text style={styles.inputLabel}>Stok giriş açıklaması</Text>

      <TextInput
        style={[styles.textInput, styles.multilineInput]}
        value={stockEntryReason}
        onChangeText={setStockEntryReason}
        placeholder="Örn. Yeni ürün satın alımı"
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
        editable={!savingStockEntry}
      />

      <Pressable
        style={[
          styles.primaryButton,
          (!stockEntryPartId || savingStockEntry) &&
            styles.disabledButton,
        ]}
        onPress={handleStockEntry}
        disabled={!stockEntryPartId || savingStockEntry}
      >
        {savingStockEntry ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>
            Stok Girişi Yap
          </Text>
        )}
      </Pressable>

      {stockEntryError && (
        <Text style={styles.errorText}>{stockEntryError}</Text>
      )}

      {stockEntryMessage && (
        <Text style={styles.successText}>{stockEntryMessage}</Text>
      )}
    </View>
  </View>
)}


          {/* Durum yönetimi */}
          {availableStatuses.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Durum Yönetimi</Text>

              <View style={styles.infoCard}>
                <Text style={styles.infoValue}>
                  {currentUser?.role === 'employee'
                    ? 'Servis çözümünü kabul edebilir veya gerekçenizle reddedebilirsiniz.'
                    : 'Bu servis kaydının durumunu güncelleyebilirsiniz.'}
                </Text>

                {((currentUser?.role === 'employee' && ticket.status === 'resolved') ||
                  (currentUser?.role === 'manager' && availableStatuses.includes('cancelled'))) && (
                  <>
                    <Text style={styles.inputLabel}>
                      {currentUser?.role === 'employee'
                        ? 'Çözümü reddetme açıklaması'
                        : 'İşlem açıklaması (iptal için zorunlu)'}
                    </Text>
                    <TextInput
                      style={[styles.textInput, styles.multilineInput]}
                      value={statusNote}
                      onChangeText={(value) => {
                        setStatusNote(value);
                        if (statusError) setStatusError(null);
                      }}
                      placeholder={
                        currentUser?.role === 'employee'
                          ? 'Sorunun neden devam ettiğini açıklayın...'
                          : 'İşlem veya iptal gerekçesini yazın...'
                      }
                      placeholderTextColor={colors.textMuted}
                      multiline
                      textAlignVertical="top"
                      editable={!updatingStatus}
                    />
                  </>
                )}

                {availableStatuses.map((status) => {
                  const actionLabel =
                    currentUser?.role === 'employee'
                      ? status === 'closed'
                        ? 'Çözümü Kabul Et'
                        : 'Çözümü Reddet ve Teknisyene Gönder'
                      : status === 'cancelled'
                        ? 'Servis Kaydını İptal Et'
                        : statusLabels[status];

                  return (
                    <Pressable
                      key={status}
                      style={[
                        styles.statusActionButton,
                        updatingStatus && styles.disabledButton,
                      ]}
                      onPress={() => handleStatusChange(status)}
                      disabled={updatingStatus || updatingAssignment}
                    >
                      <Text style={styles.statusActionText}>{actionLabel}</Text>
                    </Pressable>
                  );
                })}

                {updatingStatus && (
                  <View style={styles.statusFeedback}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.helperText}>
                      Durum güncelleniyor...
                    </Text>
                  </View>
                )}

                {statusError && (
                  <Text style={styles.errorText}>{statusError}</Text>
                )}

                {statusMessage && (
                  <Text style={styles.successText}>{statusMessage}</Text>
                )}
              </View>
            </View>
          )}

          {/* Parça kullanımı */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Parça Kullanımı</Text>

            <View style={styles.infoCard}>
              {canUseParts ? (
                <>
                  <Text style={styles.infoValue}>
                    Bu servis için kullandığınız parçaları kaydedebilirsiniz.
                  </Text>

                  <Text style={styles.inputLabel}>Parça seçin</Text>

                  {parts.length === 0 ? (
                    <Text style={styles.emptyText}>
                      Kullanılabilir aktif parça bulunamadı.
                    </Text>
                  ) : (
                    parts.map((part) => {
                      const selected = selectedPartId === part.id;
                      const outOfStock = part.stock_quantity <= 0;

                      return (
                        <Pressable
                          key={part.id}
                          style={[
                            styles.partOption,
                            selected && styles.selectedPartOption,
                            outOfStock && styles.disabledButton,
                          ]}
                          onPress={() => setSelectedPartId(part.id)}
                          disabled={outOfStock || savingPart}
                        >
                          <View style={styles.partInfo}>
                            <Text style={styles.partName}>{part.name}</Text>
                            <Text style={styles.partCode}>
                              {part.code}
                            </Text>
                          </View>

                          <View style={styles.partStock}>
                            <Text style={styles.stockQuantity}>
                              {part.stock_quantity} {part.unit}
                            </Text>
                            <Text style={styles.partCode}>
                              {selected ? 'Seçildi' : 'Mevcut stok'}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })
                  )}

                  <Text style={styles.inputLabel}>Kullanılan miktar</Text>
                  <TextInput
                    style={styles.textInput}
                    value={partQuantity}
                    onChangeText={setPartQuantity}
                    keyboardType="number-pad"
                    placeholder="Örn. 2"
                    placeholderTextColor={colors.textMuted}
                    editable={!savingPart}
                  />

                  <Text style={styles.inputLabel}>İşlem açıklaması</Text>
                  <TextInput
                    style={[styles.textInput, styles.multilineInput]}
                    value={partReason}
                    onChangeText={setPartReason}
                    placeholder="Parçanın neden kullanıldığını açıklayın"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    textAlignVertical="top"
                    editable={!savingPart}
                  />

                  <Pressable
                    style={[
                      styles.primaryButton,
                      (!selectedPartId || savingPart) &&
                        styles.disabledButton,
                    ]}
                    onPress={handleUsePart}
                    disabled={!selectedPartId || savingPart}
                  >
                    {savingPart ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        Parça Kullanımını Kaydet
                      </Text>
                    )}
                  </Pressable>

                  {partError && (
                    <Text style={styles.errorText}>{partError}</Text>
                  )}

                  {partMessage && (
                    <Text style={styles.successText}>{partMessage}</Text>
                  )}
                </>
              ) : (
                <Text style={styles.emptyText}>
                  Parça kullanımı yalnızca atanmış teknisyen tarafından,
                  servis işlemde durumundayken yapılabilir.
                </Text>
              )}
            </View>
          </View>

          {/* Kullanılan parçalar ve stok hareketleri */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Stok Hareketleri</Text>

            <View style={styles.infoCard}>
              {stockMovements.length === 0 ? (
                <Text style={styles.emptyText}>
                  Bu servis için henüz stok hareketi bulunmuyor.
                </Text>
              ) : (
                stockMovements.map((movement) => {
                  const isUsage = movement.type === 'usage';
                  const isReversal =
                    movement.type === 'usage_reversal';
                  const alreadyReversed = reversedMovementIds.has(
                    movement.id,
                  );

                  return (
                    <View key={movement.id} style={styles.movementCard}>
                      <View style={styles.movementHeader}>
                        <Text style={styles.movementTitle}>
                          {movement.part?.name ?? 'Bilinmeyen parça'}
                        </Text>

                        <Text
                          style={[
                            styles.movementType,
                            isReversal && styles.reversalType,
                          ]}
                        >
                          {isUsage
                            ? 'Kullanım'
                            : isReversal
                              ? 'Geri alındı'
                              : 'Stok girişi'}
                        </Text>
                      </View>

                      <Text style={styles.partCode}>
                        {movement.part?.code ?? movement.part_id}
                      </Text>

                      <Text style={styles.movementQuantity}>
                        {movement.quantity}{' '}
                        {movement.part?.unit ?? 'adet'}
                      </Text>

                      <Text style={styles.movementDate}>
                        {formatDate(movement.created_at)}
                      </Text>

                      <Text style={styles.movementReason}>
                        {movement.reason || 'Açıklama girilmemiş.'}
                      </Text>

                      <Text style={styles.movementActor}>
                        İşlemi yapan: {getPersonName(movement.actor_id)}
                      </Text>

                      {isUsage &&
                        !alreadyReversed &&
                        canReverseParts && (
                          <Pressable
                            style={styles.reverseButton}
                            onPress={() => {
                              setReversingMovementId(movement.id);
                              setReversalReason('');
                              setReversalError(null);
                              setReversalMessage(null);
                            }}
                          >
                            <Text style={styles.reverseButtonText}>
                              Kullanımı Geri Al
                            </Text>
                          </Pressable>
                        )}

                      {isUsage && alreadyReversed && (
                        <Text style={styles.reversedLabel}>
                          Bu kullanım geri alınmış.
                        </Text>
                      )}

                      {reversingMovementId === movement.id && (
                        <View style={styles.reversalForm}>
                          <Text style={styles.inputLabel}>
                            Geri alma gerekçesi
                          </Text>

                          <TextInput
                            style={[
                              styles.textInput,
                              styles.multilineInput,
                            ]}
                            value={reversalReason}
                            onChangeText={setReversalReason}
                            placeholder="Geri alma nedenini açıklayın"
                            placeholderTextColor={colors.textMuted}
                            multiline
                            textAlignVertical="top"
                            editable={!reversingPart}
                          />

                          <View style={styles.reversalActions}>
                            <Pressable
                              style={[
                                styles.primaryButton,
                                styles.reversalAction,
                                reversingPart && styles.disabledButton,
                              ]}
                              onPress={handleReversePart}
                              disabled={reversingPart}
                            >
                              {reversingPart ? (
                                <ActivityIndicator color="#FFFFFF" />
                              ) : (
                                <Text style={styles.primaryButtonText}>
                                  Geri Almayı Onayla
                                </Text>
                              )}
                            </Pressable>

                            <Pressable
                              style={styles.cancelButton}
                              onPress={() => {
                                setReversingMovementId(null);
                                setReversalReason('');
                              }}
                              disabled={reversingPart}
                            >
                              <Text style={styles.cancelButtonText}>
                                Vazgeç
                              </Text>
                            </Pressable>
                          </View>

                          {reversalError && (
                            <Text style={styles.errorText}>
                              {reversalError}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}

              {reversalMessage && (
                <Text style={styles.successText}>
                  {reversalMessage}
                </Text>
              )}
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

          {/* Servis fotoğrafları */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Servis Fotoğrafları ({attachments.length}/3)
            </Text>

            <View style={styles.infoCard}>
              {attachments.length === 0 ? (
                <Text style={styles.emptyText}>
                  Bu servis kaydına henüz fotoğraf eklenmemiş.
                </Text>
              ) : (
                attachments.map((attachment, index) => (
                  <View key={attachment.id} style={styles.attachmentCard}>
                    <Image
                      source={{ uri: attachment.signedUrl }}
                      style={styles.attachmentImage}
                      resizeMode="cover"
                      accessibilityLabel={`Servis fotoğrafı ${index + 1}`}
                    />

                    <Text style={styles.attachmentDate}>
                      {formatDate(attachment.created_at)}
                    </Text>
                  </View>
                ))
              )}
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
{/* Mesajlaşma */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Mesajlaşma</Text>

  <View style={styles.infoCard}>
    {messages.length === 0 ? (
      <Text style={styles.emptyText}>
        Bu servis kaydı için henüz mesaj bulunmuyor.
      </Text>
    ) : (
      messages.map((message) => {
        const isCurrentUser =
          message.author_id === currentUser?.userId;

        return (
          <View
            key={message.id}
            style={[
              styles.messageCard,
              isCurrentUser && styles.currentUserMessage,
            ]}
          >
            <View style={styles.messageHeader}>
              <Text style={styles.messageAuthor}>
                {isCurrentUser
                  ? 'Siz'
                  : getPersonName(message.author_id)}
              </Text>

              <Text style={styles.messageDate}>
                {formatDate(message.created_at)}
              </Text>
            </View>

            <Text style={styles.messageBody}>
              {message.body}
            </Text>
          </View>
        );
      })
    )}

    {ticket.status === 'closed' ||
    ticket.status === 'cancelled' ? (
      <Text style={styles.emptyText}>
        Servis kaydı kapatıldığı veya iptal edildiği için
        yeni mesaj gönderilemez.
      </Text>
    ) : (
      <>
        <TextInput
          style={[styles.textInput, styles.multilineInput]}
          value={messageText}
          onChangeText={(value) => {
            setMessageText(value);
            if (messageError) setMessageError(null);
          }}
          placeholder="Mesajınızı yazın..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={5000}
          textAlignVertical="top"
          editable={!sendingMessage}
        />

        <Pressable
          style={[
            styles.primaryButton,
            (!messageText.trim() || sendingMessage) &&
              styles.disabledButton,
          ]}
          onPress={handleSendMessage}
          disabled={!messageText.trim() || sendingMessage}
        >
          {sendingMessage ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              Mesaj Gönder
            </Text>
          )}
        </Pressable>
      </>
    )}

    {messageError && (
      <Text style={styles.errorText}>{messageError}</Text>
    )}
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
  attachmentCard: {
    gap: spacing.sm,
  },
  attachmentImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  attachmentDate: {
    ...typography.caption,
    color: colors.textMuted,
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
  messageCard: {
  backgroundColor: colors.background,
  borderRadius: 10,
  padding: spacing.md,
  gap: spacing.sm,
  borderWidth: 1,
  borderColor: colors.border,
},

currentUserMessage: {
  borderColor: colors.primary,
  backgroundColor: colors.primaryBackground,
},

messageHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: spacing.xs,
},

messageAuthor: {
  ...typography.body,
  color: colors.text,
  fontWeight: '700',
},

messageDate: {
  ...typography.caption,
  color: colors.textMuted,
},

messageBody: {
  ...typography.body,
  color: colors.text,
  lineHeight: 22,
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
  statusActionButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statusActionText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  assignedPerson: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  technicianRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  technicianInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  technicianName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  technicianRole: {
    ...typography.caption,
    color: colors.textMuted,
  },
  assignButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  assignButtonText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  assignedButton: {
    backgroundColor: colors.background,
  },
  assignedButtonText: {
    color: colors.textMuted,
  },
  removeAssignmentButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  removeAssignmentText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
  },
  assignmentDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  disabledButton: {
    opacity: 0.5,
  },
  statusFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  successText: {
    ...typography.body,
    color: '#16A34A',
    fontWeight: '600',
  },
  inputLabel: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  textInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  partOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  selectedPartOption: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBackground,
  },
  partInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  partName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  partCode: {
    ...typography.caption,
    color: colors.textMuted,
  },
  partStock: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  stockQuantity: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  primaryButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  movementCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.sm,
  },
  movementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  movementTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
    flex: 1,
  },
  movementType: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  reversalType: {
    color: '#16A34A',
  },
  movementQuantity: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  movementDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  movementReason: {
    ...typography.body,
    color: colors.text,
  },
  movementActor: {
    ...typography.caption,
    color: colors.textMuted,
  },
  reverseButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  reverseButtonText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
  },
  reversedLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  reversalForm: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  reversalActions: {
    gap: spacing.sm,
  },
  reversalAction: {
    width: '100%',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
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
    color: colors.danger,
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
 priorityOptions: {
  flexDirection: 'row',
  gap: spacing.sm,
},

priorityOption: {
  flex: 1,
  alignItems: 'center',
  paddingVertical: spacing.md,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 10,
},

selectedPriorityOption: {
  borderColor: colors.primary,
  backgroundColor: colors.primaryBackground,
},

priorityOptionText: {
  ...typography.body,
  color: colors.text,
  fontWeight: '600',
},

selectedPriorityOptionText: {
  color: colors.primary,
  fontWeight: '700',
},
});
