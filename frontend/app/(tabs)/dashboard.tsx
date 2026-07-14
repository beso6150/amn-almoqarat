import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BarChart, PieChart } from "react-native-gifted-charts";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { theme } from "@/src/theme";
import { syncReminders } from "@/src/notifications";

const W = Dimensions.get("window").width;

export default function DashboardScreen() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [maintStatus, setMaintStatus] = useState<any>(null);
  const [fuelAlerts, setFuelAlerts] = useState<any[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, m, ms, fa, sched] = await Promise.all([
        api.dashboard(), api.violationsMonthly(), api.maintenanceStatus(),
        api.fuelAlerts(), api.scheduleOnDate(),
      ]);
      setStats(s); setMonthly(m); setMaintStatus(ms); setFuelAlerts(fa); setTodaySchedule(sched);

      Promise.all([api.maintenance.list(), api.leaves.list(), api.vehicles.list(), api.employees.list()])
        .then(([maintenance, leaves, vehicles, employees]) =>
          syncReminders({ maintenance, leaves, vehicles, employees })
        ).catch(() => {});
    } catch {}
    setLoading(false); setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.brandPrimary} />
      </SafeAreaView>
    );
  }

  const barData = monthly.map((m) => ({
    value: m.count, label: m.label, frontColor: theme.colors.brandPrimary,
  }));

  const pieData = maintStatus ? [
    { value: maintStatus.completed || 0.01, color: theme.colors.success },
    { value: maintStatus.pending || 0.01, color: theme.colors.warning },
    { value: maintStatus.upcoming || 0.01, color: theme.colors.brandSecondary },
  ] : [];
  const totalMaint = maintStatus ? (maintStatus.completed + maintStatus.pending + maintStatus.upcoming) : 0;

  return (
    <View style={styles.root}>
      <LinearGradient colors={[theme.colors.brandPrimary, "#25341C"]} style={styles.headerBg}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.helloText}>مرحباً</Text>
              <Text style={styles.userName} testID="dashboard-username">{user?.full_name}</Text>
              <Text style={styles.roleText}>
                {user?.role === "admin" ? "مدير عمليات" : user?.role === "supervisor" ? "مشرف أمن" : "رجل أمن"}
              </Text>
            </View>
            <Pressable testID="more-menu-btn" onPress={() => router.push("/(tabs)/more")} style={styles.iconBtn}>
              <Ionicons name="menu" size={22} color="#fff" />
            </Pressable>
          </View>

          {/* Today shift schedule */}
          {todaySchedule && (
            <View style={styles.shiftCard}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>مناوبة اليوم — {todaySchedule.date}</Text>
                <View style={{ flexDirection: "row-reverse", gap: 12, marginTop: 6 }}>
                  <View><Text style={styles.shiftLbl}>نهار (06-18)</Text><Text style={styles.shiftVal}>مجموعة {todaySchedule.day_shift.group}</Text></View>
                  <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.25)" }} />
                  <View><Text style={styles.shiftLbl}>ليل (18-06)</Text><Text style={styles.shiftVal}>مجموعة {todaySchedule.night_shift.group}</Text></View>
                </View>
              </View>
              <Pressable testID="view-schedule-btn" onPress={() => router.push("/schedule")}>
                <Ionicons name="calendar" size={22} color="#fff" />
              </Pressable>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.brandPrimary} />}
      >
        {isAdmin && stats?.pending_users > 0 && (
          <Pressable testID="pending-users-banner" onPress={() => router.push("/users")} style={styles.pendingBanner}>
            <Ionicons name="person-add" size={20} color={theme.colors.success} />
            <Text style={styles.bannerText}>{stats.pending_users} حساب بانتظار موافقتك</Text>
            <Ionicons name="chevron-back" size={18} color={theme.colors.success} />
          </Pressable>
        )}

        {fuelAlerts.length > 0 && (
          <Pressable testID="fuel-alerts-banner" onPress={() => router.push("/(tabs)/reports")} style={styles.fuelBanner}>
            <Ionicons name="flame" size={20} color={theme.colors.error} />
            <Text style={styles.bannerText}>{fuelAlerts.length} سيارة استهلاكها فوق المتوسط الشهري</Text>
            <Ionicons name="chevron-back" size={18} color={theme.colors.error} />
          </Pressable>
        )}

        <View style={styles.kpiGrid}>
          <KPI testID="kpi-vehicles" icon="car" label="السيارات" value={stats?.total_vehicles ?? 0} color={theme.colors.brandPrimary} onPress={() => router.push("/(tabs)/vehicles")} />
          <KPI testID="kpi-maintenance" icon="build" label="قيد الصيانة" value={stats?.in_maintenance ?? 0} color={theme.colors.warning} onPress={() => router.push({ pathname: "/(tabs)/employees", params: { tab: "maintenance" } })} />
          <KPI testID="kpi-violations" icon="warning" label="مخالفات معلقة" value={stats?.unpaid_violations ?? 0} color={theme.colors.error} onPress={() => router.push({ pathname: "/(tabs)/employees", params: { tab: "violations" } })} />
          <KPI testID="kpi-leaves" icon="airplane" label="إجازات نشطة" value={stats?.active_leaves ?? 0} color={theme.colors.success} onPress={() => router.push({ pathname: "/(tabs)/employees", params: { tab: "leaves" } })} />
        </View>

        <View style={styles.summaryRow}>
          <Pressable style={styles.summaryCard} onPress={() => router.push("/(tabs)/employees")} testID="summary-locations">
            <Ionicons name="business" size={20} color={theme.colors.brandPrimary} />
            <Text style={styles.sumVal}>{stats?.total_locations ?? 0}</Text>
            <Text style={styles.sumLbl}>المقرات</Text>
          </Pressable>
          <Pressable style={styles.summaryCard} onPress={() => router.push("/(tabs)/employees")} testID="summary-employees">
            <Ionicons name="people" size={20} color={theme.colors.brandPrimary} />
            <Text style={styles.sumVal}>{stats?.total_employees ?? 0}</Text>
            <Text style={styles.sumLbl}>الموظفين</Text>
          </Pressable>
          <Pressable style={styles.summaryCard} onPress={() => router.push({ pathname: "/(tabs)/employees", params: { tab: "violations" } })} testID="summary-unpaid-amount">
            <Ionicons name="cash" size={20} color={theme.colors.error} />
            <Text style={styles.sumVal}>{(stats?.unpaid_amount ?? 0).toLocaleString()}</Text>
            <Text style={styles.sumLbl}>ر.س غير مسددة</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.push("/(tabs)/reports")} style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Ionicons name="bar-chart" size={20} color={theme.colors.brandPrimary} />
            <Text style={styles.chartTitle}>المخالفات - آخر 6 أشهر</Text>
            <Text style={{ color: theme.colors.brandPrimary, fontSize: 12, marginRight: "auto" }}>تفاصيل ‹</Text>
          </View>
          {barData.length > 0 && barData.some(d => d.value > 0) ? (
            <BarChart data={barData} barWidth={26} barBorderRadius={6} spacing={18} yAxisThickness={0} xAxisThickness={0} xAxisLabelTextStyle={{ color: theme.colors.onSurfaceSecondary, fontSize: 10 }} yAxisTextStyle={{ color: theme.colors.onSurfaceTertiary, fontSize: 10 }} noOfSections={4} height={140} width={W - 80} isAnimated />
          ) : <Text style={styles.emptyText}>لا توجد مخالفات</Text>}
        </Pressable>

        <Pressable onPress={() => router.push("/(tabs)/reports")} style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Ionicons name="pie-chart" size={20} color={theme.colors.brandPrimary} />
            <Text style={styles.chartTitle}>حالة الصيانة</Text>
            <Text style={{ color: theme.colors.brandPrimary, fontSize: 12, marginRight: "auto" }}>تفاصيل ‹</Text>
          </View>
          {totalMaint > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 8 }}>
              <PieChart data={pieData} donut radius={70} innerRadius={45}
                centerLabelComponent={() => (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 18, fontWeight: "700" }}>{totalMaint}</Text>
                    <Text style={{ fontSize: 10, color: theme.colors.onSurfaceTertiary }}>سجل</Text>
                  </View>
                )}
              />
              <View style={{ gap: 10 }}>
                <LegendDot color={theme.colors.success} label={`منجزة (${maintStatus.completed})`} />
                <LegendDot color={theme.colors.warning} label={`قيد الإصلاح (${maintStatus.pending})`} />
                <LegendDot color={theme.colors.brandSecondary} label={`قادمة (${maintStatus.upcoming})`} />
              </View>
            </View>
          ) : <Text style={styles.emptyText}>لا توجد بيانات صيانة</Text>}
        </Pressable>

        <View style={styles.summaryRow}>
          <Pressable style={styles.summaryCard} onPress={() => router.push({ pathname: "/(tabs)/employees", params: { tab: "fuel" } })} testID="summary-fuel">
            <Ionicons name="flame" size={20} color={theme.colors.brandSecondary} />
            <Text style={styles.sumVal}>{(stats?.fuel_cost_year ?? 0).toLocaleString()}</Text>
            <Text style={styles.sumLbl}>وقود ر.س / {stats?.fuel_count_year || 0} تعبئة</Text>
          </Pressable>
          <Pressable style={styles.summaryCard} onPress={() => router.push({ pathname: "/(tabs)/employees", params: { tab: "accidents" } })} testID="summary-accidents">
            <Ionicons name="alert-circle" size={20} color={theme.colors.error} />
            <Text style={styles.sumVal}>{stats?.open_accidents ?? 0}</Text>
            <Text style={styles.sumLbl}>حوادث مفتوحة</Text>
          </Pressable>
          <Pressable style={styles.summaryCard} onPress={() => router.push({ pathname: "/(tabs)/employees", params: { tab: "accidents" } })} testID="summary-accident-cost">
            <Ionicons name="cash" size={20} color={theme.colors.warning} />
            <Text style={styles.sumVal}>{(stats?.accident_cost_year ?? 0).toLocaleString()}</Text>
            <Text style={styles.sumLbl}>ر.س حوادث</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.push({ pathname: "/(tabs)/employees", params: { tab: "maintenance" } })} style={styles.costCard} testID="maintenance-cost-card">
          <Text style={styles.costLabel}>تكلفة الصيانة هذه السنة</Text>
          <Text style={styles.costVal}>{(stats?.maintenance_cost_year ?? 0).toLocaleString()} ر.س</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const KPI = ({ icon, label, value, color, testID, onPress }: any) => (
  <Pressable testID={testID} onPress={onPress} style={styles.kpiCard}>
    <View style={[styles.kpiIcon, { backgroundColor: color + "20" }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={styles.kpiValue}>{value}</Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </Pressable>
);

const LegendDot = ({ color, label }: any) => (
  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
    <Text style={{ fontSize: 12, color: theme.colors.onSurfaceSecondary }}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  centerContainer: { flex: 1, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center" },
  headerBg: { paddingBottom: theme.spacing.lg },
  headerRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
  helloText: { color: "rgba(255,255,255,0.75)", fontSize: 13, textAlign: "right" },
  userName: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "right" },
  roleText: { color: "rgba(255,255,255,0.75)", fontSize: 11, textAlign: "right", marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  shiftCard: { marginTop: 12, marginHorizontal: theme.spacing.lg, backgroundColor: "rgba(255,255,255,0.12)", padding: 12, borderRadius: theme.radius.md, flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  shiftLbl: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  shiftVal: { color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 2 },
  scroll: { flex: 1, marginTop: -theme.spacing.md },
  pendingBanner: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: "#E8F5E9", borderRadius: theme.radius.md, padding: theme.spacing.md, marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.success },
  fuelBanner: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: "#FDECE5", borderRadius: theme.radius.md, padding: theme.spacing.md, marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.error },
  bannerText: { flex: 1, textAlign: "right", color: theme.colors.onSurfaceSecondary, fontWeight: "600" },
  kpiGrid: { flexDirection: "row-reverse", flexWrap: "wrap", padding: theme.spacing.md, gap: theme.spacing.sm },
  kpiCard: { width: (W - theme.spacing.md * 2 - theme.spacing.sm) / 2, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  kpiIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  kpiValue: { fontSize: 24, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  kpiLabel: { fontSize: 12, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginTop: 2 },
  summaryRow: { flexDirection: "row-reverse", paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  summaryCard: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md, alignItems: "center", borderWidth: 1, borderColor: theme.colors.border },
  sumVal: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface, marginTop: 6 },
  sumLbl: { fontSize: 11, color: theme.colors.onSurfaceTertiary, marginTop: 2, textAlign: "center" },
  chartCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  chartHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: theme.spacing.md },
  chartTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.onSurface },
  emptyText: { textAlign: "center", color: theme.colors.onSurfaceTertiary, padding: theme.spacing.lg },
  costCard: { backgroundColor: theme.colors.brandTertiary, borderRadius: theme.radius.md, padding: theme.spacing.lg, marginHorizontal: theme.spacing.md },
  costLabel: { fontSize: 13, color: theme.colors.onBrandTertiary, textAlign: "right" },
  costVal: { fontSize: 24, fontWeight: "700", color: theme.colors.onBrandTertiary, textAlign: "right", marginTop: 4 },
});
