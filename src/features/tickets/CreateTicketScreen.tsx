import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createTicket,
  getActiveCategories,
  type TicketCategory,
} from '../../services/tickets';
import { colors, spacing, typography } from '../../theme';

type Priority = 'low' | 'normal' | 'high';

const priorities: { label: string; value: Priority }[] = [
  { label: 'Düşük', value: 'low' },
  { label: 'Normal', value: 'normal' },
  { label: 'Yüksek', value: 'high' },
];

type Props = {
  onSuccess?: () => void;
};

export function CreateTicketScreen({ onSuccess }: Props) {
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');

  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      try {
        const result = await getActiveCategories();

        if (isMounted) {
          setCategories(result);
        }
      } catch (error) {
        if (isMounted) {
          Alert.alert(
            'Kategori hatası',
            error instanceof Error
              ? error.message
              : 'Kategoriler yüklenemedi.',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingCategories(false);
        }
      }
    }

    void loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit() {
    if (!title.trim()) {
      Alert.alert('Eksik bilgi', 'Lütfen servis kaydı başlığını girin.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Eksik bilgi', 'Lütfen sorunun açıklamasını girin.');
      return;
    }

    if (!categoryId) {
      Alert.alert('Eksik bilgi', 'Lütfen bir kategori seçin.');
      return;
    }

    if (!location.trim()) {
      Alert.alert('Eksik bilgi', 'Lütfen konum bilgisini girin.');
      return;
    }

    setIsSubmitting(true);

    try {
      const ticket = await createTicket({
        title,
        description,
        categoryId,
        location,
        priority,
      });

      Alert.alert(
        'Başarılı',
        `Servis kaydı oluşturuldu${ticket.ticket_no ? `: ${ticket.ticket_no}` : '.'}`,
        [
          {
            text: 'Tamam',
            onPress: () => {
              setTitle('');
              setDescription('');
              setLocation('');
              setCategoryId('');
              setPriority('normal');
              onSuccess?.();
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        'Kayıt hatası',
        error instanceof Error
          ? error.message
          : 'Servis kaydı oluşturulamadı.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top,
        },
      ]}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Yeni Servis Kaydı</Text>
          <Text style={styles.description}>
            Yaşadığınız teknik sorunu bildirmek için aşağıdaki formu doldurun.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Başlık</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Örn. Bilgisayar açılmıyor"
            placeholderTextColor={colors.textMuted}
            maxLength={120}
          />

          <Text style={styles.label}>Açıklama</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Sorunu ayrıntılı olarak açıklayın"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />

          <Text style={styles.label}>Kategori</Text>
          {isLoadingCategories ? (
            <ActivityIndicator color={colors.primary} />
          ) : categories.length === 0 ? (
            <Text style={styles.helperText}>Aktif kategori bulunamadı.</Text>
          ) : (
            <View style={styles.optionsContainer}>
              {categories.map((category) => {
                const selected = categoryId === category.id;

                return (
                  <Pressable
                    key={category.id}
                    onPress={() => setCategoryId(category.id)}
                    style={[
                      styles.option,
                      selected && styles.selectedOption,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selected && styles.selectedOptionText,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={styles.label}>Konum</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Örn. A Blok, 2. kat"
            placeholderTextColor={colors.textMuted}
            maxLength={200}
          />

          <Text style={styles.label}>Öncelik</Text>
          <View style={styles.optionsContainer}>
            {priorities.map((item) => {
              const selected = priority === item.value;

              return (
                <Pressable
                  key={item.value}
                  onPress={() => setPriority(item.value)}
                  style={[
                    styles.option,
                    selected && styles.selectedOption,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.selectedOptionText,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => void handleSubmit()}
            disabled={isSubmitting || isLoadingCategories}
            style={({ pressed }) => [
              styles.submitButton,
              (isSubmitting || isLoadingCategories) &&
                styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                Servis Kaydı Oluştur
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  label: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    backgroundColor: colors.background,
    ...typography.body,
  },
  multilineInput: {
    minHeight: 120,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  optionText: {
    ...typography.body,
    color: colors.text,
  },
  selectedOptionText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  helperText: {
    ...typography.body,
    color: colors.textMuted,
  },
  submitButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.8,
  },
  submitButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});