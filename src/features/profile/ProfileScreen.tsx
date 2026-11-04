import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '../../services/supabase/client';
import { screenStyles } from '../../utils/screenStyles';
import { colors, spacing, typography } from '../../theme';

export function ProfileScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSignOut = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage('Çıkış yapılamadı. Lütfen tekrar deneyin.');
      }
    } catch {
      setErrorMessage('Bir bağlantı hatası oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={screenStyles.container}>
      <Text style={screenStyles.title}>Profil</Text>
      <Text style={screenStyles.description}>Profil ayarları burada olacak.</Text>

      {errorMessage ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {errorMessage}
        </Text>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.signOutButton,
          (pressed || isLoading) && styles.buttonPressed,
        ]}
        onPress={() => void handleSignOut()}
        disabled={isLoading}
        accessibilityRole="button"
      >
        {isLoading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.signOutButtonText}>Çıkış Yap</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  signOutButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderRadius: 8,
    padding: spacing.md,
    minHeight: 48,
    marginTop: spacing.xl,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  signOutButtonText: {
    color: colors.background,
    ...typography.body,
  },
  error: {
    color: colors.danger,
    ...typography.body,
    marginTop: spacing.md,
  },
});
