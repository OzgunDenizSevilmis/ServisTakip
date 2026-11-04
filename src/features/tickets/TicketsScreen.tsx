import { Text, View } from 'react-native';

import { screenStyles } from '../../utils/screenStyles';

export function TicketsScreen() {
  return (
    <View style={screenStyles.container}>
      <Text style={screenStyles.title}>Servisler</Text>
      <Text style={screenStyles.description}>Servis kayıtları burada listelenecek.</Text>
    </View>
  );
}
