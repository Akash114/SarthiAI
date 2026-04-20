import { StatusBar } from 'expo-status-bar';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import Splash from './assets/splash.svg';

export default function App() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.root} testID="splash-root">
      <Splash
        width={width}
        height={height}
        preserveAspectRatio="xMidYMid slice"
      />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#4338ca',
  },
});
