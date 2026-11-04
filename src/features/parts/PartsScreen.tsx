import { Text, View } from 'react-native';

import { screenStyles } from '../../utils/screenStyles';

export function PartsScreen() {
  return (
    <View style={screenStyles.container}>
      <Text style={screenStyles.title}>Parçalar</Text>
      <Text style={screenStyles.description}>Parça envanteri burada listelenecek.</Text>
    </View>
  );
}
