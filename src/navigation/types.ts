import type { NavigatorScreenParams } from '@react-navigation/native';

export type AppTabParamList = {
  Home: undefined;
  Tickets: undefined;
  Parts: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<AppTabParamList>;
  TicketDetail: {
    ticketId: string;
  };
};

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};