import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { TeamStackParamList } from '../types';
import { TeamBoardScreen } from '../../screens/team/TeamBoardScreen';
import { TeamCreateScreen } from '../../screens/team/TeamCreateScreen';
import { TeamJoinScreen } from '../../screens/team/TeamJoinScreen';
import { TeamListScreen } from '../../screens/team/TeamListScreen';
import { TaskCreateScreen } from '../../screens/TaskCreateScreen';
import { TeamSharedTaskDetailScreen } from '../../screens/team/TeamSharedTaskDetailScreen';

const Stack = createNativeStackNavigator<TeamStackParamList>();

export function TeamStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TeamList" component={TeamListScreen} />
      <Stack.Screen name="TeamCreate" component={TeamCreateScreen} />
      <Stack.Screen name="TeamJoin" component={TeamJoinScreen} />
      <Stack.Screen name="TeamBoard" component={TeamBoardScreen} />
      <Stack.Screen name="TeamCreateTask" component={TaskCreateScreen} />
      <Stack.Screen name="TeamSharedTaskDetail" component={TeamSharedTaskDetailScreen} />
    </Stack.Navigator>
  );
}
