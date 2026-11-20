
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createTicket,
  getActiveCategories,
  uploadTicketAttachment,
  type TicketAttachmentInput,
  type TicketCategory,
} from '../../services/tickets';
import { colors, spacing, typography } from '../../theme';

type Priority = 'low' | 'normal' | 'high';

const priorities: { label: string; value: Priority }[] = [
  { label: 'Düşük', value: 'low' },
  { label: 'Normal', value: 'normal' },
  { label: 'Yüksek', value: 'high' },
];

type SelectedPhoto = TicketAttachmentInput & {
  id: string;
};

type Props = {
  onSuccess?: () => void;
};

const MAX_PHOTOS = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function CreateTicketScreen({ onSuccess }: Props) {
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');

  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
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

  async function handleSelectPhotos() {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert(
        'Fotoğraf sınırı',
        'Bir servis kaydına en fazla 3 fotoğraf ekleyebilirsiniz.',
      );
      return;
    }

    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'İzin gerekli',
        'Fotoğraf seçebilmek için galeri erişim izni vermelisiniz.',
      );
      return;
    }

    const remaining = MAX_PHOTOS - photos.length;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    const selectedPhotos: SelectedPhoto[] = [];

    for (const asset of result.assets) {
      const mimeType = asset.mimeType;

      if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
        Alert.alert(
          'Geçersiz dosya',
          'Yalnızca JPEG ve PNG fotoğrafları seçebilirsiniz.',
        );
        continue;
      }

      if (!asset.fileSize || asset.fileSize > MAX_FILE_SIZE) {
        Alert.alert(
          'Dosya boyutu',
          'Fotoğrafların boyutu 5 MB sınırını aşmamalıdır.',
        );
        continue;
      }

      selectedPhotos.push({
        id: `${Date.now()}-${Math.random()}`,
        uri: asset.uri,
        mimeType,
        fileSize: asset.fileSize,
      });
    }

    setPhotos((current) =>
      [...current, ...selectedPhotos].slice(0, MAX_PHOTOS),
    );
  }

  function handleRemovePhoto(photoId: string) {
    setPhotos((current) =>
      current.filter((photo) => photo.id !== photoId),
    );
  }

  function resetForm() {
    setTitle('');
    setDescription('');
    setLocation('');
    setCategoryId('');
    setPriority('normal');
    setPhotos([]);
  }

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

    let createdTicket: { id: string; ticket_no: string | null } | null =
      null;

    try {
      createdTicket = await createTicket({
        title,
        description,
        categoryId,
        location,
        priority,
      });

      for (const photo of photos) {
        
        await uploadTicketAttachment(createdTicket.id, {
          uri: photo.uri,
          mimeType: photo.mimeType,
          fileSize: photo.fileSize,
        });
      }

      Alert.alert(
        'Başarılı',
        `Servis kaydı oluşturuldu${
          createdTicket.ticket_no
            ? `: ${createdTicket.ticket_no}`
            : '.'
        }`,
        [
          {
            text: 'Tamam',
            onPress: () => {
              resetForm();
              onSuccess?.();
            },
          },
        ],
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Servis kaydı oluşturulamadı.';

      if (createdTicket) {
        Alert.alert(
          'Fotoğraf yükleme hatası',
          `Servis kaydı (${createdTicket.ticket_no ?? createdTicket.id}) oluşturuldu ancak fotoğrafların tamamı yüklenemedi.\n\n${message}\n\nKayıt tekrar oluşturulmayacaktır.`,
        );
      } else {
        Alert.alert('Kayıt hatası', message);
      }
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
            <Text style={styles.helperText}>
              Aktif kategori bulunamadı.
            </Text>
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

          <View style={styles.photoSection}>
            <View style={styles.photoHeader}>
              <Text style={styles.label}>Fotoğraflar</Text>
              <Text style={styles.photoCount}>
                {photos.length}/{MAX_PHOTOS}
              </Text>
            </View>

            <Text style={styles.helperText}>
              Sorunu göstermek için en fazla 3 JPEG veya PNG fotoğraf
              ekleyebilirsiniz. Her fotoğraf en fazla 5 MB olabilir.
            </Text>

            <View style={styles.photoList}>
              {photos.map((photo) => (
                <View key={photo.id} style={styles.photoItem}>
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.photoPreview}
                  />

                  <Pressable
                    onPress={() => handleRemovePhoto(photo.id)}
                    style={styles.removePhotoButton}
                    disabled={isSubmitting}
                  >
                    <Ionicons
                      name="close-circle"
                      size={25}
                      color={colors.danger}
                    />
                  </Pressable>
                </View>
              ))}

              {photos.length < MAX_PHOTOS && (
                <Pressable
                  onPress={() => void handleSelectPhotos()}
                  style={styles.addPhotoButton}
                  disabled={isSubmitting}
                >
                  <Ionicons
                    name="camera-outline"
                    size={28}
                    color={colors.primary}
                  />
                  <Text style={styles.addPhotoText}>Fotoğraf ekle</Text>
                </Pressable>
              )}
            </View>
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
  photoSection: {
    marginTop: spacing.md,
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  photoList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  photoItem: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.surface,
    borderRadius: 20,
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
  },
  addPhotoText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
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
