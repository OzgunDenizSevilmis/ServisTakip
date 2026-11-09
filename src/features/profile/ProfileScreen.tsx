
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '../../services/supabase/client';

type Profile = {
  id: string;
  full_name: string;
  role: string;
};

const palette = {
  primary: '#6D28D9',
  secondary: '#8B5CF6',
  lightPurple: '#A78BFA',
  background: '#F9FAFB',
  softPurple: '#EDE9FE',
  text: '#11132D',
  muted: '#77799B',
  border: '#E8E5F2',
  white: '#FFFFFF',
  danger: '#DC2626',
  dangerBackground: '#FEF2F2',
  success: '#15803D',
  successBackground: '#DCFCE7',
};

const getRoleLabel = (role: string) => {
  switch (role) {
    case 'manager':
      return 'Yönetici';
    case 'technician':
      return 'Teknisyen';
    case 'employee':
      return 'Çalışan';
    default:
      return role;
  }
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return '?';

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('');
};

export function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
    const insets = useSafeAreaInsets();


  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError) throw authError;

        const user = authData.user;

        if (!user) {
          throw new Error('Oturum bilgisi bulunamadı.');
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (!isActive) return;

        setProfile(data as Profile);
        setFullName(data.full_name ?? '');
        setEmail(user.email ?? '');
      } catch {
        if (isActive) {
          setErrorMessage('Profil bilgileri yüklenemedi.');
        }
      } finally {
        if (isActive) {
          setIsLoadingProfile(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, []);

  const handleUpdateProfile = async () => {
    if (isSaving || !profile) return;

    const normalizedName = fullName.trim().replace(/\s+/g, ' ');

    if (normalizedName.length < 3) {
      setErrorMessage('Ad soyad en az 3 karakter olmalıdır.');
      setSuccessMessage('');
      return;
    }

    if (normalizedName === profile.full_name) {
      setErrorMessage('');
      setSuccessMessage('Profil bilgileriniz güncel.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: normalizedName,
        })
        .eq('id', profile.id)
        .select('id, full_name, role')
        .single();

      if (error) throw error;

      setProfile(data as Profile);
      setFullName(data.full_name);
      setSuccessMessage('Ad soyad bilginiz başarıyla güncellendi.');
    } catch {
      setErrorMessage(
        'Profil bilgileriniz güncellenemedi. Lütfen tekrar deneyin.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage('Çıkış yapılamadı. Lütfen tekrar deneyin.');
      }
    } catch {
      setErrorMessage('Bir bağlantı hatası oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsSigningOut(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.loadingText}>Profil bilgileri yükleniyor...</Text>
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
        contentContainerStyle={[
  styles.scrollContent,
  {
    paddingTop: insets.top + 8,
    paddingBottom: insets.bottom + 32,
  },
]}

        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profilim</Text>
          <Text style={styles.headerDescription}>
            Hesap bilgilerinizi görüntüleyin ve yönetin.
          </Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.decorativeCircleOne} />
          <View style={styles.decorativeCircleTwo} />

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getInitials(profile?.full_name || fullName)}
            </Text>
          </View>

          <Text style={styles.profileName}>
            {profile?.full_name || 'İsminizi ekleyin'}
          </Text>

          <Text style={styles.profileEmail}>{email || 'E-posta bulunamadı'}</Text>

          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {profile ? getRoleLabel(profile.role) : 'Kullanıcı'}
            </Text>
          </View>
        </View>

        {errorMessage ? (
          <View style={styles.messageError}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.messageSuccess}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hesap Bilgileri</Text>
          <Text style={styles.sectionSubtitle}>
            Hesabınıza ait bilgiler
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.fieldHeader}>
            <View style={styles.fieldIcon}>
              <Text style={styles.fieldIconText}>✉</Text>
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>E-posta Adresi</Text>
              <Text style={styles.fieldValue}>
                {email || 'Belirtilmemiş'}
              </Text>
            </View>
            <Text style={styles.readOnlyText}>Sabit</Text>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.fieldHeader}>
            <View style={styles.fieldIcon}>
              <Text style={styles.fieldIconText}>♙</Text>
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>Hesap Rolü</Text>
              <Text style={styles.fieldValue}>
                {profile ? getRoleLabel(profile.role) : 'Belirtilmemiş'}
              </Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Aktif</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>
          <Text style={styles.sectionSubtitle}>
            Profil bilgilerinizi düzenleyin
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.inputLabel}>Ad Soyad</Text>

          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={(value) => {
              setFullName(value);
              setErrorMessage('');
              setSuccessMessage('');
            }}
            placeholder="Adınızı ve soyadınızı girin"
            placeholderTextColor={palette.muted}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!isSaving}
            maxLength={100}
          />

          <Text style={styles.helperText}>
            Servis kayıtlarında bu isim kullanılacaktır.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.buttonPressed,
              isSaving && styles.buttonDisabled,
            ]}
            onPress={() => void handleUpdateProfile()}
            disabled={isSaving}
            accessibilityRole="button"
          >
            {isSaving ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <>
                <Text style={styles.saveButtonIcon}>✓</Text>
                <Text style={styles.saveButtonText}>
                  Değişiklikleri Kaydet
                </Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.logoutSection}>
          <Text style={styles.logoutTitle}>Oturum İşlemleri</Text>
          <Text style={styles.logoutDescription}>
            Hesabınızdan güvenli bir şekilde çıkış yapabilirsiniz.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.buttonPressed,
              isSigningOut && styles.buttonDisabled,
            ]}
            onPress={() => void handleSignOut()}
            disabled={isSigningOut}
            accessibilityRole="button"
          >
            {isSigningOut ? (
              <ActivityIndicator color={palette.danger} />
            ) : (
              <>
                <Text style={styles.signOutIcon}>↪</Text>
                <Text style={styles.signOutButtonText}>Çıkış Yap</Text>
              </>
            )}
          </Pressable>
        </View>

        <Text style={styles.footerText}>ServisTakip • Hesap Ayarları</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: palette.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: palette.muted,
    fontSize: 14,
    marginTop: 12,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '700',
  },
  headerDescription: {
    color: palette.muted,
    fontSize: 14,
    marginTop: 5,
  },
  profileCard: {
    backgroundColor: palette.primary,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 26,
  },
  decorativeCircleOne: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#8B5CF6',
    opacity: 0.35,
    top: -90,
    right: -45,
  },
  decorativeCircleTwo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#A78BFA',
    opacity: 0.25,
    bottom: -65,
    left: -35,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#C4B5FD',
    marginBottom: 14,
  },
  avatarText: {
    color: palette.primary,
    fontSize: 27,
    fontWeight: '700',
  },
  profileName: {
    color: palette.white,
    fontSize: 21,
    fontWeight: '700',
    textAlign: 'center',
  },
  profileEmail: {
    color: '#EDE9FE',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  roleBadge: {
    backgroundColor: '#FFFFFF30',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginTop: 14,
  },
  roleBadgeText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '600',
  },
  messageError: {
    backgroundColor: palette.dangerBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 13,
    marginBottom: 16,
  },
  errorText: {
    color: palette.danger,
    fontSize: 13,
  },
  messageSuccess: {
    backgroundColor: palette.successBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 13,
    marginBottom: 16,
  },
  successText: {
    color: palette.success,
    fontSize: 13,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: 18,
    padding: 17,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 24,
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: palette.softPurple,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fieldIconText: {
    color: palette.primary,
    fontSize: 21,
    fontWeight: '600',
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    color: palette.muted,
    fontSize: 12,
    marginBottom: 4,
  },
  fieldValue: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  readOnlyText: {
    color: palette.muted,
    fontSize: 10,
    backgroundColor: palette.background,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  activeBadge: {
    backgroundColor: palette.successBackground,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: palette.success,
    fontSize: 11,
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: 16,
  },
  inputLabel: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 9,
  },
  input: {
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: '#D8D0F2',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 50,
    color: palette.text,
    fontSize: 14,
  },
  helperText: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 8,
  },
  saveButton: {
    minHeight: 52,
    backgroundColor: palette.primary,
    borderRadius: 13,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  saveButtonIcon: {
    color: palette.white,
    fontSize: 18,
    fontWeight: '700',
  },
  saveButtonText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '700',
  },
  logoutSection: {
    marginTop: 2,
  },
  logoutTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '700',
  },
  logoutDescription: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 5,
    marginBottom: 14,
  },
  signOutButton: {
    minHeight: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: palette.dangerBackground,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  signOutIcon: {
    color: palette.danger,
    fontSize: 19,
    fontWeight: '700',
  },
  signOutButtonText: {
    color: palette.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footerText: {
    color: palette.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 25,
  },
});
