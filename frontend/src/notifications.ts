import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotifPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  const r = await Notifications.requestPermissionsAsync();
  return r.status === "granted";
}

/** Cancel every scheduled notification and re-schedule maintenance / leave reminders. */
export async function syncReminders(opts: {
  maintenance: any[];
  leaves: any[];
  vehicles: any[];
  employees: any[];
}) {
  try {
    const ok = await ensureNotifPermission();
    if (!ok) return;

    // Only Android needs channel setup
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "التنبيهات",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    const soon = new Date(now.getTime() + 45 * 86400000); // 45 days ahead

    // Maintenance: 3 days before next_due_date
    for (const m of opts.maintenance) {
      if (!m.next_due_date) continue;
      const due = new Date(m.next_due_date);
      if (isNaN(due.getTime())) continue;
      const trigger = new Date(due.getTime() - 3 * 86400000);
      trigger.setHours(9, 0, 0, 0);
      if (trigger < now || trigger > soon) continue;
      const veh = opts.vehicles.find((v: any) => v.id === m.vehicle_id);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "تذكير صيانة قادمة",
          body: `${veh?.plate_number || "سيارة"}: ${m.maintenance_type} خلال 3 أيام`,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger } as any,
      });
    }

    // Leaves ending: 1 day before end_date
    for (const lv of opts.leaves) {
      if (!lv.end_date || lv.status !== "approved") continue;
      const end = new Date(lv.end_date);
      if (isNaN(end.getTime())) continue;
      const trigger = new Date(end.getTime() - 86400000);
      trigger.setHours(9, 0, 0, 0);
      if (trigger < now || trigger > soon) continue;
      const emp = opts.employees.find((e: any) => e.id === lv.employee_id);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "انتهاء إجازة قريباً",
          body: `${emp?.name || "الموظف"}: تنتهي إجازته غداً`,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger } as any,
      });
    }
  } catch (e) {
    // silent
  }
}
