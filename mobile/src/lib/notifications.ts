import * as Notifications from "expo-notifications";

/**
 * Local notifications (expo-notifications) — currently just the daily
 * "Morning brief". Auto-opening the AssistantSheet on tap (NavContext
 * initial-overlay flag, AsyncStorage `pos.openAssistantOnLaunch`) and the
 * Settings toggle UI are a later task; this file only owns the
 * schedule/cancel/query primitives they'll call.
 */

const MORNING_BRIEF_ID = "pos-morning-brief";

export type NotificationPermissionStatus = "granted" | "denied" | "undetermined";

// iOS foreground handler — set once at module load (ES modules are cached, so
// importing this file from multiple places only registers it once). Without
// this, a notification that fires while the app is open shows nothing.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Checks (and, if undetermined, requests) permission to show local
 * notifications. Never throws — resolves "denied" on any native error. */
export async function ensureNotificationPermission(): Promise<NotificationPermissionStatus> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return "granted";
    if (!current.canAskAgain) return "denied";
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

/**
 * Schedules (or reschedules) the daily "Morning brief" local notification at
 * `hour:minute` device-local time. Requests permission first if needed and
 * returns `false` (no-op) if it's denied. Cancels any existing schedule under
 * the same stable identifier first, so calling this again (e.g. the user
 * changes the time in Settings) replaces it instead of stacking a duplicate.
 */
export async function scheduleMorningBrief(hour = 7, minute = 30): Promise<boolean> {
  const status = await ensureNotificationPermission();
  if (status !== "granted") return false;

  await Notifications.cancelScheduledNotificationAsync(MORNING_BRIEF_ID);
  await Notifications.scheduleNotificationAsync({
    identifier: MORNING_BRIEF_ID,
    content: {
      title: "Morning brief",
      body: "Recovery, calendar and money — your day is ready.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  return true;
}

/** Cancels the daily "Morning brief" notification, if scheduled. Safe to call
 * when nothing is scheduled (resolves without error). */
export async function cancelMorningBrief(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(MORNING_BRIEF_ID);
}

/** Whether the "Morning brief" notification is currently scheduled — drives a
 * Settings toggle's initial state (a later task). */
export async function getMorningBriefEnabled(): Promise<boolean> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.some((n) => n.identifier === MORNING_BRIEF_ID);
  } catch {
    return false;
  }
}
