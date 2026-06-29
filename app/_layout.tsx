import { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { supabase } from '@/src/services';
import { useAuthStore } from '@/src/store/authStore';
import { fetchProfile } from '@/src/services';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useFrameworkReady();

  const { session, setSession, setProfile, setLoading, loading } = useAuthStore();
  const segments = useSegments();

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  // Bootstrap auth session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        (async () => {
          try {
            const profile = await fetchProfile(s.user.id);
            setProfile(profile);
          } catch {
            // non-critical
          }
        })();
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      (async () => {
        setSession(s);
        if (s?.user) {
          try {
            const profile = await fetchProfile(s.user.id);
            setProfile(profile);
          } catch {
            // non-critical
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle navigation once fonts + auth are resolved
  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    if (loading) return;

    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login');
    } else {
      if (!inTabsGroup) router.replace('/(tabs)');
    }
  }, [fontsLoaded, fontError, loading, session]);

  if ((!fontsLoaded && !fontError) || loading) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}
