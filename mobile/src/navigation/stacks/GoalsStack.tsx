import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { GoalsStackParamList } from '../types';
import { GoalListScreen } from '../../screens/GoalListScreen';
import { GoalsAllScreen } from '../../screens/GoalsAllScreen';
import { GoalDetailScreen } from '../../screens/GoalDetailScreen';
import { TaskDetailScreen } from '../../screens/TaskDetailScreen';
import { EditTaskScreen } from '../../screens/EditTaskScreen';
import { TaskCreateScreen } from '../../screens/TaskCreateScreen';

const Stack = createNativeStackNavigator<GoalsStackParamList>();

export function GoalsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Goals" component={GoalListScreen} />
      <Stack.Screen name="GoalsAll" component={GoalsAllScreen} />
      <Stack.Screen name="GoalDetail" component={GoalDetailScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <Stack.Screen name="EditTask" component={EditTaskScreen} />
      <Stack.Screen name="CreateTask" component={TaskCreateScreen} />
    </Stack.Navigator>
  );
}
