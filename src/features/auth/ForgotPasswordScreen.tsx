import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../../services/supabase/client';
import { colors } from '../../theme';

type NavigationProp = NativeStackNavigationProp<{
  Login: undefined;
  ForgotPassword: undefined;
}>;

export function ForgotPasswordScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      Alert.alert('Eksik bilgi', 'E-posta adresinizi girin.');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: 'servistakip://reset-password',
        },
      );

      if (error) {
        Alert.alert('İşlem başarısız', error.message);
        return;
      }

      Alert.alert(
        'E-posta gönderildi',
        'Şifre yenileme bağlantısı için e-posta kutunuzu kontrol edin.',
        [{ text: 'Giriş ekranına dön', onPress: () => navigation.navigate('Login') }],
      );
    } catch {
      Alert.alert('Hata', 'Beklenmeyen bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Şifremi Unuttum</Text>
      <Text style={styles.description}>
        Şifrenizi yenilemek için kayıtlı e-posta adresinizi girin.
      </Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="E-posta"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isLoading}
      />

      <Pressable
        style={[styles.button, isLoading && styles.disabledButton]}
        onPress={handleResetPassword}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Sıfırlama bağlantısı gönder</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.backButton}
        onPress={() => navigation.navigate('Login')}
        disabled={isLoading}
      >
        <Text style={styles.backButtonText}>Giriş ekranına dön</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  title: {
    marginBottom: 12,
    fontSize: 28,
    fontWeight: '700',
    color: '#172033',
  },
  description: {
    marginBottom: 24,
    fontSize: 15,
    lineHeight: 22,
    color: '#647084',
  },
  input: {
    height: 52,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#D7DCE5',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: '#172033',
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});
