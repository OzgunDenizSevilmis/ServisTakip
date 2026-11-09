import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { Session } from '@supabase/supabase-js';

import { AuthStack } from './AuthStack';
import { AppStack } from './AppStack';
import type { RootStackParamList } from './types';

import { supabase } from '../services/supabase/client';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!isMounted) return;

      console.log('AUTH EVENT:', event);
      console.log('AUTH SESSION:', Boolean(currentSession));

      switch (event) {
        case 'INITIAL_SESSION':
        case 'SIGNED_IN':
        case 'SIGNED_OUT':
        case 'TOKEN_REFRESHED':
        case 'USER_UPDATED':
          setSession(currentSession);
          setIsLoading(false);
          break;

        case 'PASSWORD_RECOVERY':
          setSession(currentSession);
          setIsPasswordRecovery(true);
          setIsLoading(false);
          break;

        default:
          break;
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isPasswordRecovery ? (
        <Stack.Screen name="Auth">
          {() => <AuthStack initialRouteName="ResetPassword" />}
        </Stack.Screen>
      ) : session ? (
        <Stack.Screen name="App" component={AppStack} />
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});