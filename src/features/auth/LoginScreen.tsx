
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { AuthStackParamList } from '../../navigation/AuthStack';
import { supabase } from '../../services/supabase/client';
import { colors, spacing, typography } from '../../theme';

type LoginNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Login'
>;

export function LoginScreen() {
  const navigation = useNavigation<LoginNavigationProp>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (isLoading) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMessage('E-posta ve şifre alanlarını doldurun.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorMessage('Geçerli bir e-posta adresi girin.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data.session) {
        setErrorMessage('Giriş başarılı ancak oturum oluşturulamadı.');
        return;
      }

      const storageKeys = await AsyncStorage.getAllKeys();
      const authKeys = storageKeys.filter((key) =>
        key.includes('auth-token'),
      );

      console.log('AUTH STORAGE KEYS:', authKeys);
    } catch (error) {
      console.error('Giriş hatası:', error);
      setErrorMessage(
        'Bir bağlantı hatası oluştu. Lütfen tekrar deneyin.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
          <Text style={styles.welcomeTitle}>Hoş Geldiniz!</Text>
          <Text style={styles.welcomeDescription}>
            Hesabınıza giriş yapın.
          </Text>

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
            returnKeyType="next"
          />

          <Text style={styles.label}>Şifre</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Şifrenizi girin"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            editable={!isLoading}
            returnKeyType="done"
            onSubmitEditing={() => void handleLogin()}
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
            onPress={() => void handleLogin()}
            disabled={isLoading}
            accessibilityRole="button"
          >
            {isLoading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.buttonText}>Giriş Yap</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Register')}
            disabled={isLoading}
          >
            <Text style={styles.secondaryText}>
              Hesabınız yok mu? <Text style={styles.link}>Hesap Oluştur</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xl,
      zIndex: 1,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoSymbol: {
    color: colors.primary,
    fontSize: 38,
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
    marginTop: spacing.sm,
    maxWidth: 280,
    lineHeight: 24,
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 1,
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
});
