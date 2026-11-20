
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createCategory,
  getAllCategories,
  setCategoryActive,
  updateCategory,
  type TicketCategory,
} from '../../services/tickets/ticketService';

const palette = {
  primary: '#6D28D9',
  primaryDark: '#5B21B6',
  primaryLight: '#F3EFFF',
  background: '#F8F8FC',
  white: '#FFFFFF',
  text: '#17172F',
  muted: '#85849B',
  border: '#EAE8F2',
  success: '#15803D',
  successBackground: '#DCFCE7',
  danger: '#DC2626',
  dangerBackground: '#FEF2F2',
  inputBackground: '#FAFAFC',
};

export function CategoryManagementScreen() {
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const activeCount = categories.filter(
    (category) => category.is_active,
  ).length;

  const inactiveCount = categories.length - activeCount;

  const loadCategories = useCallback(async () => {
    try {
      setErrorMessage('');

      const data = await getAllCategories();

      setCategories(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Kategoriler yüklenemedi.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    const fetchCategories = async () => {
      try {
        const data = await getAllCategories();

        if (isActive) {
          setCategories(data);
          setErrorMessage('');
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Kategoriler yüklenemedi.',
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void fetchCategories();

    return () => {
      isActive = false;
    };
  }, []);

  const handleCreate = async () => {
    const name = newName.trim();

    if (!name) {
      setErrorMessage('Kategori adı boş olamaz.');
      setSuccessMessage('');
      return;
    }

    if (isSaving) return;

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await createCategory(name);

      setNewName('');
      setSuccessMessage('Kategori başarıyla oluşturuldu.');

      await loadCategories();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Kategori oluşturulamadı.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (categoryId: string) => {
    const name = editingName.trim();

    if (!name) {
      setErrorMessage('Kategori adı boş olamaz.');
      setSuccessMessage('');
      return;
    }

    if (isSaving) return;

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await updateCategory(categoryId, name);

      setEditingId(null);
      setEditingName('');
      setSuccessMessage('Kategori başarıyla güncellendi.');

      await loadCategories();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Kategori güncellenemedi.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = (category: TicketCategory) => {
    if (isSaving) return;

    const nextStatus = !category.is_active;

    Alert.alert(
      nextStatus ? 'Kategoriyi aktifleştir' : 'Kategoriyi pasife al',
      nextStatus
        ? `"${category.name}" kategorisi tekrar kullanılabilir olacak.`
        : `"${category.name}" yeni servis kayıtlarında seçilemeyecek.`,
      [
        {
          text: 'Vazgeç',
          style: 'cancel',
        },
        {
          text: nextStatus ? 'Aktifleştir' : 'Pasife Al',
          style: nextStatus ? 'default' : 'destructive',
          onPress: () => {
            void (async () => {
              setIsSaving(true);
              setErrorMessage('');
              setSuccessMessage('');

              try {
                await setCategoryActive(category.id, nextStatus);

                setSuccessMessage(
                  nextStatus
                    ? 'Kategori yeniden aktifleştirildi.'
                    : 'Kategori pasife alındı.',
                );

                await loadCategories();
              } catch (error) {
                setErrorMessage(
                  error instanceof Error
                    ? error.message
                    : 'Kategori durumu değiştirilemedi.',
                );
              } finally {
                setIsSaving(false);
              }
            })();
          },
        },
      ],
    );
  };

  const startEditing = (category: TicketCategory) => {
    setEditingId(category.id);
    setEditingName(category.name);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.centered,
          { paddingTop: insets.top },
        ]}
      >
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.loadingText}>
          Kategoriler yükleniyor...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 14,
            paddingBottom: insets.bottom + 32,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>⚙</Text>
          </View>

          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Kategori Yönetimi</Text>
            <Text style={styles.subtitle}>
              Servis kategorilerini buradan yönetebilirsiniz.
            </Text>
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {categories.length}
            </Text>
            <Text style={styles.statLabel}>Toplam</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <Text style={[styles.statValue, styles.activeValue]}>
              {activeCount}
            </Text>
            <Text style={styles.statLabel}>Aktif</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <Text style={[styles.statValue, styles.inactiveValue]}>
              {inactiveCount}
            </Text>
            <Text style={styles.statLabel}>Pasif</Text>
          </View>
        </View>

        {/* Feedback */}
        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.feedbackIcon}>!</Text>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
            <Pressable
              onPress={() => setErrorMessage('')}
              hitSlop={10}
            >
              <Text style={styles.closeFeedback}>✕</Text>
            </Pressable>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>
              {successMessage}
            </Text>
            <Pressable
              onPress={() => setSuccessMessage('')}
              hitSlop={10}
            >
              <Text style={styles.closeFeedback}>✕</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Create Category */}
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionIcon}>
              <Text style={styles.sectionIconText}>＋</Text>
            </View>

            <View>
              <Text style={styles.sectionTitle}>
                Yeni Kategori
              </Text>
              <Text style={styles.sectionDescription}>
                Sisteme yeni bir kategori ekleyin.
              </Text>
            </View>
          </View>

          <Text style={styles.inputLabel}>Kategori Adı</Text>

          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={(value) => {
              setNewName(value);
              setErrorMessage('');
              setSuccessMessage('');
            }}
            placeholder="Örn. Yazıcı, Monitör..."
            placeholderTextColor={palette.muted}
            maxLength={150}
            editable={!isSaving}
            returnKeyType="done"
            onSubmitEditing={() => void handleCreate()}
          />

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
              (isSaving || !newName.trim()) && styles.disabledButton,
            ]}
            onPress={() => void handleCreate()}
            disabled={isSaving || !newName.trim()}
          >
            {isSaving ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <>
                <Text style={styles.primaryButtonIcon}>＋</Text>
                <Text style={styles.primaryButtonText}>
                  Kategori Ekle
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Category List */}
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                Mevcut Kategoriler
              </Text>
              <Text style={styles.sectionDescription}>
                Kategorilerinizi düzenleyin ve yönetin.
              </Text>
            </View>

            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {categories.length}
              </Text>
            </View>
          </View>

          {categories.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>▤</Text>
              </View>

              <Text style={styles.emptyTitle}>
                Henüz kategori yok
              </Text>

              <Text style={styles.emptyDescription}>
                İlk kategorinizi yukarıdaki alandan ekleyebilirsiniz.
              </Text>
            </View>
          ) : (
            categories.map((category) => {
              const isEditing = editingId === category.id;

              return (
                <View
                  key={category.id}
                  style={[
                    styles.categoryCard,
                    !category.is_active && styles.inactiveCard,
                    isEditing && styles.editingCard,
                  ]}
                >
                  {isEditing ? (
                    <>
                      <View style={styles.editHeader}>
                        <Text style={styles.editTitle}>
                          Kategoriyi Düzenle
                        </Text>

                        <View style={styles.editBadge}>
                          <Text style={styles.editBadgeText}>
                            Düzenleme
                          </Text>
                        </View>
                      </View>

                      <TextInput
                        style={styles.input}
                        value={editingName}
                        onChangeText={(value) => {
                          setEditingName(value);
                          setErrorMessage('');
                        }}
                        placeholder="Kategori adı"
                        placeholderTextColor={palette.muted}
                        maxLength={150}
                        editable={!isSaving}
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={() =>
                          void handleUpdate(category.id)
                        }
                      />

                      <View style={styles.editActions}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.primaryButton,
                            styles.editSaveButton,
                            pressed && styles.buttonPressed,
                            isSaving && styles.disabledButton,
                          ]}
                          onPress={() =>
                            void handleUpdate(category.id)
                          }
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <ActivityIndicator color={palette.white} />
                          ) : (
                            <Text style={styles.primaryButtonText}>
                              Değişiklikleri Kaydet
                            </Text>
                          )}
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [
                            styles.cancelButton,
                            pressed && styles.buttonPressed,
                          ]}
                          onPress={cancelEditing}
                          disabled={isSaving}
                        >
                          <Text style={styles.cancelButtonText}>
                            İptal
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.categoryTop}>
                        <View style={styles.categoryIdentity}>
                          <View
                            style={[
                              styles.categoryIcon,
                              !category.is_active &&
                                styles.inactiveCategoryIcon,
                            ]}
                          >
                            <Text style={styles.categoryIconText}>
                              {category.name.charAt(0).toLocaleUpperCase('tr-TR')}
                            </Text>
                          </View>

                          <View style={styles.categoryNameContainer}>
                            <Text
                              style={[
                                styles.categoryName,
                                !category.is_active &&
                                  styles.inactiveCategoryName,
                              ]}
                            >
                              {category.name}
                            </Text>

                            <Text style={styles.categorySubtext}>
                              Servis kategorisi
                            </Text>
                          </View>
                        </View>

                        <View
                          style={[
                            styles.statusBadge,
                            category.is_active
                              ? styles.activeBadge
                              : styles.inactiveBadge,
                          ]}
                        >
                          <View
                            style={[
                              styles.statusDot,
                              category.is_active
                                ? styles.activeDot
                                : styles.inactiveDot,
                            ]}
                          />

                          <Text
                            style={[
                              styles.statusText,
                              {
                                color: category.is_active
                                  ? palette.success
                                  : palette.danger,
                              },
                            ]}
                          >
                            {category.is_active ? 'Aktif' : 'Pasif'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cardDivider} />

                      <View style={styles.categoryActions}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.editButton,
                            pressed && styles.buttonPressed,
                            isSaving && styles.disabledButton,
                          ]}
                          onPress={() => startEditing(category)}
                          disabled={isSaving}
                        >
                          <Text style={styles.editButtonIcon}>✎</Text>
                          <Text style={styles.editButtonText}>
                            Düzenle
                          </Text>
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [
                            styles.toggleButton,
                            category.is_active
                              ? styles.deactivateButton
                              : styles.activateButton,
                            pressed && styles.buttonPressed,
                            isSaving && styles.disabledButton,
                          ]}
                          onPress={() => handleToggleActive(category)}
                          disabled={isSaving}
                        >
                          <Text
                            style={[
                              styles.toggleButtonText,
                              {
                                color: category.is_active
                                  ? palette.danger
                                  : palette.success,
                              },
                            ]}
                          >
                            {category.is_active
                              ? 'Pasife Al'
                              : 'Aktifleştir'}
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>
          ServisTakip • Kategori Yönetimi
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },

  content: {
    paddingHorizontal: 20,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },

  loadingText: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 12,
  },

  // Header

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  headerIcon: {
    width: 49,
    height: 49,
    borderRadius: 15,
    backgroundColor: palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  headerIconText: {
    color: palette.primary,
    fontSize: 25,
  },

  headerTextContainer: {
    flex: 1,
  },

  title: {
    color: palette.text,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  subtitle: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  // Statistics

  statsContainer: {
    flexDirection: 'row',
    backgroundColor: palette.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 16,
    marginBottom: 23,
  },

  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
  },

  activeValue: {
    color: palette.success,
  },

  inactiveValue: {
    color: palette.danger,
  },

  statLabel: {
    fontSize: 11,
    color: palette.muted,
    marginTop: 4,
    fontWeight: '500',
  },

  statDivider: {
    width: 1,
    backgroundColor: palette.border,
  },

  // Feedback

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.dangerBackground,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 9,
  },

  feedbackIcon: {
    color: palette.danger,
    fontSize: 17,
    fontWeight: '800',
  },

  errorText: {
    flex: 1,
    color: palette.danger,
    fontSize: 12,
    lineHeight: 18,
  },

  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.successBackground,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 9,
  },

  successIcon: {
    color: palette.success,
    fontSize: 17,
    fontWeight: '800',
  },

  successText: {
    flex: 1,
    color: palette.success,
    fontSize: 12,
    lineHeight: 18,
  },

  closeFeedback: {
    color: palette.muted,
    fontSize: 14,
    paddingHorizontal: 3,
  },

  // Section

  section: {
    backgroundColor: palette.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 17,
    marginBottom: 27,
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 21,
  },

  sectionIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  sectionIconText: {
    color: palette.primary,
    fontSize: 24,
    fontWeight: '500',
  },

  sectionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },

  sectionDescription: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 4,
  },

  inputLabel: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },

  input: {
    minHeight: 49,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: palette.text,
    backgroundColor: palette.inputBackground,
    fontSize: 13,
  },

  primaryButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 13,
  },

  primaryButtonIcon: {
    color: palette.white,
    fontSize: 19,
    fontWeight: '500',
  },

  primaryButtonText: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '700',
  },

  disabledButton: {
    opacity: 0.55,
  },

  buttonPressed: {
    opacity: 0.75,
  },

  // Category list

  listSection: {
    marginBottom: 10,
  },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  countBadge: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  countText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '800',
  },

  categoryCard: {
    backgroundColor: palette.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 15,
    marginBottom: 12,
  },

  inactiveCard: {
    backgroundColor: '#FCFCFD',
  },

  editingCard: {
    borderColor: '#C4B5FD',
  },

  categoryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  categoryIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },

  categoryIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  inactiveCategoryIcon: {
    backgroundColor: '#F1F1F5',
  },

  categoryIconText: {
    color: palette.primary,
    fontSize: 18,
    fontWeight: '800',
  },

  categoryNameContainer: {
    flex: 1,
  },

  categoryName: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },

  inactiveCategoryName: {
    color: palette.muted,
  },

  categorySubtext: {
    color: palette.muted,
    fontSize: 10,
    marginTop: 4,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 5,
  },

  activeBadge: {
    backgroundColor: palette.successBackground,
  },

  inactiveBadge: {
    backgroundColor: palette.dangerBackground,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  activeDot: {
    backgroundColor: palette.success,
  },

  inactiveDot: {
    backgroundColor: palette.danger,
  },

  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },

  cardDivider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: 14,
  },

  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  editButton: {
    flex: 1,
    minHeight: 39,
    borderRadius: 10,
    backgroundColor: palette.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  editButtonIcon: {
    color: palette.primary,
    fontSize: 15,
  },

  editButtonText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
  },

  toggleButton: {
    flex: 1,
    minHeight: 39,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  deactivateButton: {
    backgroundColor: palette.dangerBackground,
  },

  activateButton: {
    backgroundColor: palette.successBackground,
  },

  toggleButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Editing

  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },

  editTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },

  editBadge: {
    backgroundColor: palette.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  editBadgeText: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: '700',
  },

  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  editSaveButton: {
    flex: 1,
  },

  cancelButton: {
    minHeight: 48,
    paddingHorizontal: 17,
    borderRadius: 12,
    backgroundColor: '#F1F1F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 13,
  },

  cancelButtonText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },

  // Empty state

  emptyCard: {
    backgroundColor: palette.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 28,
    alignItems: 'center',
  },

  emptyIcon: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },

  emptyIconText: {
    color: palette.primary,
    fontSize: 26,
  },

  emptyTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },

  emptyDescription: {
    color: palette.muted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 7,
  },

  // Footer

  footerText: {
    color: palette.muted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 15,
  },
});
