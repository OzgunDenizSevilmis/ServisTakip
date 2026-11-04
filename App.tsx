import { useCallback, useEffect } from 'react';
import { Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

import { RootNavigator } from './src/navigation/RootNavigator';
import { supabase } from './src/services/supabase/client';

export default function App() {
  const handleDeepLink = useCallback(async (url: string) => {
    try {
      const parsedUrl = new URL(url);
      const code = parsedUrl.searchParams.get('code');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error('Recovery code exchange error:', error.message);
        }

        return;
      }

      const hash = parsedUrl.hash.startsWith('#')
        ? parsedUrl.hash.slice(1)
        : parsedUrl.hash;

      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Recovery session error:', error.message);
        }
      }
    } catch (error) {
      console.error('Deep link handling error:', error);
    }
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleDeepLink(url);
    });

    void Linking.getInitialURL().then((url) => {
      if (url) {
        void handleDeepLink(url);
      }
    });

    return () => subscription.remove();
  }, [handleDeepLink]);

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <RootNavigator />
    </NavigationContainer>
  );
}