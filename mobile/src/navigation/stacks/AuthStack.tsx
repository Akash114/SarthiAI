import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../types';
import { AuthScreen } from '../../screens/AuthScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Auth">
        {() => <AuthScreen onAuthed={() => {}} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
