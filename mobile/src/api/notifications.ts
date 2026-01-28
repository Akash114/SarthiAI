import { apiRequest } from "./client";

export async function registerPushToken(
  userId: string,
  token: string,
  platform: string,
  deviceName?: string,
): Promise<void> {
  await apiRequest("/notifications/register", {
    method: "POST",
    body: {
      user_id: userId,
      token,
      platform,
      device_name: deviceName,
    },
  });
}

export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  await apiRequest("/notifications/register", {
    method: "DELETE",
    body: {
      user_id: userId,
      token,
    },
  });
}
