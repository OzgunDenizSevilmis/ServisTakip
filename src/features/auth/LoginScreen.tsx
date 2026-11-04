
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

      console.log('LOGIN SESSION:', Boolean(data.session));
      console.log('LOGIN USER:', data.user?.id);
      console.log('LOGIN ERROR:', error?.message);

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
        <Text style={styles.title}>ServisTakip</Text>
        <Text style={styles.description}>Hesabınıza giriş yapın.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>E-posta</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@firma.com"
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
              (pressed || isLoading) && styles.buttonPressed,
            ]}
            onPress={() => void handleLogin()}
            disabled={isLoading}
            accessibilityRole="button"
          >
            {isLoading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.buttonText}>Giriş Yap</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.forgotPasswordButton}
            onPress={() => navigation.navigate('ForgotPassword')}
            disabled={isLoading}
          >
            <Text style={styles.forgotPasswordText}>Şifremi unuttum</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Register')}
            disabled={isLoading}
          >
            <Text style={styles.secondaryButtonText}>
              Hesabınız yok mu? Kayıt olun
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
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    ...typography.title,
    textAlign: 'center',
  },
  description: {
    color: colors.textMuted,
    ...typography.body,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  form: {
    marginTop: spacing.xl,
  },
  label: {
    color: colors.text,
    ...typography.body,
    marginBottom: spacing.xs,
  },
  input: {
    color: colors.text,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  error: {
    color: colors.danger,
    ...typography.body,
    marginBottom: spacing.md,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: spacing.md,
    minHeight: 48,
    marginTop: spacing.sm,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.background,
    ...typography.body,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    padding: spacing.sm,
  },
  forgotPasswordText: {
    color: colors.primary,
    ...typography.body,
  },
  secondaryButton: {
    alignItems: 'center',
    padding: spacing.md,
  },
  secondaryButtonText: {
    color: colors.primary,
    ...typography.body,
    textAlign: 'center',
  },
});
