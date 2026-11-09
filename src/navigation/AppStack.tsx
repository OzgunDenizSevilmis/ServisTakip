import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { HomeScreen } from '../features/home/HomeScreen';
import { PartsScreen } from '../features/parts/PartsScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { TicketsScreen } from '../features/tickets/TicketsScreen';
import { TicketDetailScreen } from '../features/tickets/TicketDetailScreen';

import type {
  AppTabParamList,
  AppStackParamList,
} from './types';

import { colors } from '../theme';

const Tab = createBottomTabNavigator<AppTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

const tabIcons: Record<
  keyof AppTabParamList,
  keyof typeof Ionicons.glyphMap
> = {
  Home: 'home-outline',
  Tickets: 'construct-outline',
  Parts: 'cube-outline',
  Profile: 'person-outline',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={tabIcons[route.name]}
            color={color}
            size={size}
          />
        ),
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Ana Sayfa' }}
      />

      <Tab.Screen
        name="Tickets"
        component={TicketsScreen}
        options={{ title: 'Servisler' }}
      />

      <Tab.Screen
        name="Parts"
        component={PartsScreen}
        options={{ title: 'Parçalar' }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profil' }}
      />
    </Tab.Navigator>
  );
}

export function AppStack() {
  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
      />

      <Stack.Screen
        name="TicketDetail"
        component={TicketDetailScreen}
      />
    </Stack.Navigator>
  );
}