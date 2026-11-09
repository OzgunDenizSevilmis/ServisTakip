
import { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../../services/supabase/client';
import { colors, spacing, typography } from '../../theme';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
};

type RegisterNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Register'
>;

export function RegisterScreen() {
  const navigation = useNavigation<RegisterNavigationProp>();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (isLoading) return;

    const normalizedName = fullName.trim().replace(/\s+/g, ' ');
    const normalizedEmail = email.trim().toLowerCase();

    if (
      !normalizedName ||
      !normalizedEmail ||
      !password ||
      !confirmPassword
    ) {
      setErrorMessage('Tüm alanları doldurun.');
      return;
    }

    if (normalizedName.length < 3) {
      setErrorMessage('Ad soyad en az 3 karakter olmalıdır.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorMessage('Geçerli bir e-posta adresi girin.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Şifre en az 6 karakter olmalıdır.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Şifreler eşleşmiyor.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: normalizedName,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        return;
      }

      setErrorMessage(
        'Hesabınız oluşturuldu. Giriş ekranından hesabınıza giriş yapabilirsiniz.',
      );

      navigation.navigate('Login');
    } catch {
      setErrorMessage('Kayıt sırasında bir bağlantı hatası oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View pointerEvents="none" style={styles.waveContainer}>
            <View style={styles.waveBack} />
            <View style={styles.waveMiddle} />
            <View style={styles.waveFront} />
          </View>

          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoSymbol}>◆</Text>
            </View>
            <Text style={styles.brandTitle}>ServisTakip</Text>
            <Text style={styles.brandDescription}>
              Servis ve bakım taleplerinizi kolayca yönetin.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                ✦ Ücretsiz hesap oluşturun
              </Text>
            </View>

            <Text style={styles.welcomeTitle}>Aramıza Hoş Geldiniz!</Text>
            <Text style={styles.welcomeDescription}>
              Servis taleplerinizi takip etmek için hesabınızı oluşturun.
            </Text>

            <Text style={styles.label}>Ad Soyad</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Adınız ve soyadınız"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="name"
              editable={!isLoading}
              maxLength={100}
            />

            <Text style={styles.label}>E-posta</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="E-posta adresiniz"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!isLoading}
            />

            <Text style={styles.label}>Şifre</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="En az 6 karakter"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!isLoading}
            />

            <Text style={styles.label}>Şifre Tekrar</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Şifrenizi tekrar girin"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!isLoading}
            />

            {errorMessage ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {errorMessage}
              </Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={() => void handleRegister()}
              disabled={isLoading}
              accessibilityRole="button"
            >
              {isLoading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.buttonText}>Hesap Oluştur</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Login')}
              disabled={isLoading}
            >
              <Text style={styles.secondaryText}>
                Zaten hesabınız var mı?{' '}
                <Text style={styles.link}>Giriş Yap</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  waveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 115,
    overflow: 'hidden',
  },
  waveBack: {
    position: 'absolute',
    bottom: -95,
    left: -100,
    width: '155%',
    height: 180,
    borderRadius: 200,
    backgroundColor: '#C4B5FD',
    transform: [{ rotate: '-8deg' }],
  },
  waveMiddle: {
    position: 'absolute',
    bottom: -110,
    left: -65,
    width: '150%',
    height: 180,
    borderRadius: 200,
    backgroundColor: '#8B5CF6',
    transform: [{ rotate: '5deg' }],
  },
  waveFront: {
    position: 'absolute',
    bottom: -130,
    left: -40,
    width: '140%',
    height: 180,
    borderRadius: 200,
    backgroundColor: '#6D28D9',
    transform: [{ rotate: '-2deg' }],
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    zIndex: 1,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 21,
    backgroundColor: colors.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoSymbol: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '700',
  },
  brandTitle: {
    color: colors.text,
    ...typography.title,
    fontWeight: '700',
  },
  brandDescription: {
    color: colors.textMuted,
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
    lineHeight: 22,
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 1,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryBackground,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  badgeText: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: '600',
  },
  welcomeTitle: {
    color: colors.text,
    ...typography.heading,
  },
  welcomeDescription: {
    color: colors.textMuted,
    ...typography.body,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  label: {
    color: colors.text,
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  input: {
    color: colors.text,
    ...typography.body,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  error: {
    color: colors.danger,
    ...typography.caption,
    marginBottom: spacing.md,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 52,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: colors.surface,
    ...typography.body,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  secondaryText: {
    color: colors.textMuted,
    ...typography.caption,
    textAlign: 'center',
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});
