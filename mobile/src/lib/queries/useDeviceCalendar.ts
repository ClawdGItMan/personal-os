import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getCalendarAccessStatus,
  getDeviceEventsToday,
  listDeviceCalendars,
  requestCalendarAccess,
} from "../deviceCalendar";
import type {
  DeviceCalendarInfo,
  DeviceCalendarPermissionStatus,
  DeviceCalendarTodayEvent,
} from "../deviceCalendar";

/** AsyncStorage key for the user's selected device-calendar IDs. Default (key
 * absent) is `[]` — the feature is off until a Settings screen (later task)
 * opts in via `setSelectedIds`. */
const STORAGE_KEY = "pos.deviceCalendars";

export type UseDeviceCalendarResult = {
  /** Device calendar IDs the user opted into. [] = feature off. */
  selectedIds: string[];
  /** Persists the new selection to AsyncStorage and reloads events. */
  setSelectedIds: (ids: string[]) => Promise<void>;
  /** Every event-entity calendar on the device — [] until permission is granted. */
  calendars: DeviceCalendarInfo[];
  /** Today's events from the selected calendars, CalendarTodayEvent-shaped
   * (`source: "device"`). [] when the feature is off or permission is denied. */
  events: DeviceCalendarTodayEvent[];
  /** Current calendar permission — "unknown" only until the first check
   * resolves (mount). */
  permission: DeviceCalendarPermissionStatus | "unknown";
  loading: boolean;
  error: string | null;
  /** Prompts the OS permission dialog (no-op if already resolved), then
   * reloads calendars + events. */
  requestAccess: () => Promise<DeviceCalendarPermissionStatus>;
  refetch: () => Promise<void>;
};

async function readSelectedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Device calendars (EventKit/CalendarProvider via `deviceCalendar.ts`),
 * read-only. Selection is opt-in and persisted in AsyncStorage
 * (`pos.deviceCalendars`) — hook idioms per `useTasks.ts` (refetch, optimistic
 * local state, error surfaced as a string).
 */
export function useDeviceCalendar(): UseDeviceCalendarResult {
  const [selectedIds, setSelectedIdsState] = useState<string[]>([]);
  const [calendars, setCalendars] = useState<DeviceCalendarInfo[]>([]);
  const [events, setEvents] = useState<DeviceCalendarTodayEvent[]>([]);
  const [permission, setPermission] = useState<DeviceCalendarPermissionStatus | "unknown">("unknown");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCalendarsAndEvents = useCallback(async (ids: string[]) => {
    try {
      const [calendarList, eventList, status] = await Promise.all([
        listDeviceCalendars(),
        getDeviceEventsToday(ids),
        getCalendarAccessStatus(),
      ]);
      setCalendars(calendarList);
      setEvents(eventList);
      setPermission(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const refetch = useCallback(async () => {
    setError(null);
    const ids = await readSelectedIds();
    setSelectedIdsState(ids);
    await loadCalendarsAndEvents(ids);
    setLoading(false);
  }, [loadCalendarsAndEvents]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const setSelectedIds = useCallback(
    async (ids: string[]) => {
      // Optimistic: reflect the new selection locally first, then persist.
      setSelectedIdsState(ids);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      await loadCalendarsAndEvents(ids);
    },
    [loadCalendarsAndEvents],
  );

  const requestAccess = useCallback(async () => {
    const status = await requestCalendarAccess();
    setPermission(status);
    await loadCalendarsAndEvents(selectedIds);
    return status;
  }, [selectedIds, loadCalendarsAndEvents]);

  return {
    selectedIds,
    setSelectedIds,
    calendars,
    events,
    permission,
    loading,
    error,
    requestAccess,
    refetch,
  };
}
