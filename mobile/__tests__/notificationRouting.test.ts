import { routeFromNotificationData } from '../src/lib/notificationRouting';
import { rootNavigationRef } from '../src/navigation/navigationRef';

describe('routeFromNotificationData', () => {
  const navigate = jest.fn();

  beforeEach(() => {
    navigate.mockClear();
    Object.defineProperty(rootNavigationRef, 'isReady', { value: () => true, configurable: true });
    Object.defineProperty(rootNavigationRef, 'navigate', { value: navigate, configurable: true });
  });

  it('routes task_due to task detail', () => {
    routeFromNotificationData({ type: 'task_due', task_id: 'task-1' });
    expect(navigate).toHaveBeenCalledWith('Main', {
      screen: 'GoalsTab',
      params: { screen: 'TaskDetail', params: { taskId: 'task-1' } },
    });
  });

  it('routes task_reminder alias to task detail', () => {
    routeFromNotificationData({ type: 'task_reminder', task_id: 'task-2' });
    expect(navigate).toHaveBeenCalledWith('Main', {
      screen: 'GoalsTab',
      params: { screen: 'TaskDetail', params: { taskId: 'task-2' } },
    });
  });

  it('routes intervention_prompt to activity', () => {
    routeFromNotificationData({ type: 'intervention_prompt' });
    expect(navigate).toHaveBeenCalledWith('Main', {
      screen: 'ActivityTab',
      params: { screen: 'Activity' },
    });
  });

  it('routes goal_progress to goal detail', () => {
    routeFromNotificationData({ type: 'goal_progress', goal_id: 'goal-1', task_id: 'task-1' });
    expect(navigate).toHaveBeenCalledWith('Main', {
      screen: 'GoalsTab',
      params: { screen: 'GoalDetail', params: { goalId: 'goal-1' } },
    });
  });
});
