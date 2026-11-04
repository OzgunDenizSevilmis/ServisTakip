import type { NavigatorScreenParams } from '@react-navigation/native';

export type AppTabParamList = {
  Home: undefined;
  Tickets: undefined;
  Parts: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  App: NavigatorScreenParams<AppTabParamList>;
};
