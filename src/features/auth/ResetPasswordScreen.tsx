
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

import { supabase } from '../../services/supabase/client';
import { colors } from '../../theme';

export function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdatePassword = async () => {
    if (password.length < 6) {
      Alert.alert('Geçersiz şifre', 'Şifreniz en az 6 karakter olmalıdır.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Şifreler eşleşmiyor', 'Girdiğiniz şifreler aynı olmalıdır.');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        Alert.alert('Şifre güncellenemedi', error.message);
        return;
      }

      Alert.alert(
        'Şifre güncellendi',
        'Yeni şifrenizle giriş yapabilirsiniz.',
      );
    } catch {
      Alert.alert('Hata', 'Beklenmeyen bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Yeni Şifre Belirle</Text>
      <Text style={styles.description}>
        Hesabınız için yeni bir şifre oluşturun.
      </Text>

      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Yeni şifre"
        secureTextEntry
        autoCapitalize="none"
        editable={!isLoading}
      />

      <TextInput
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Yeni şifreyi tekrar girin"
        secureTextEntry
        autoCapitalize="none"
        editable={!isLoading}
      />

      <Pressable
        style={[styles.button, isLoading && styles.disabledButton]}
        onPress={handleUpdatePassword}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Şifreyi Güncelle</Text>
        )}
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
});
