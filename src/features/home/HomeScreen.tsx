import { Text, View } from 'react-native';

import { screenStyles } from '../../utils/screenStyles';

export function HomeScreen() {
  return (
    <View style={screenStyles.container}>
      <Text style={screenStyles.title}>Ana Sayfa</Text>
      <Text style={screenStyles.description}>
        Servis operasyonlarına genel bakış burada olacak.
      </Text>
    </View>
  );
}
