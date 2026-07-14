import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BarChart, PieChart } from "react-native-gifted-charts";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { theme } from "@/src/theme";

const W = Dimensions.get("window").width;

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [maintStatus, setMaintStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, m, ms] = await Promise.all([
        api.dashboard(), api.violationsMonthly(), api.maintenanceStatus(),
      ]);
      setStats(s);
      setMonthly(m);
      setMaintStatus(ms);
    } catch (e) {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSeed = async () => {
    try {
      await api.seed();
      await load();
    } catch (e) {}
  };

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.brandPrimary} />
      </SafeAreaView>
    );
  }

  const barData = monthly.map((m) => ({
    value: m.count,
    label: m.label,
    frontColor: theme.colors.brandPrimary,
    topLabelComponent: () => (
      <Text style={{ fontSize: 9, color: theme.colors.onSurfaceSecondary, marginBottom: 2 }}>{m.count || ""}</Text>
    ),
  }));

  const pieData = maintStatus ? [
    { value: maintStatus.completed || 0.01, color: theme.colors.success, text: "منجزة" },
    { value: maintStatus.pending || 0.01, color: theme.colors.warning, text: "قيد الإصلاح" },
    { value: maintStatus.upcoming || 0.01, color: theme.colors.brandSecondary, text: "قادمة" },
  ] : [];

  const totalMaint = maintStatus ? (maintStatus.completed + maintStatus.pending + maintStatus.upcoming) : 0;

  const hasNoData = stats && stats.total_vehicles === 0 && stats.total_employees === 0;

  return (
    <View style={styles.root}>
      <LinearGradient colors={[theme.colors.brandPrimary, "#25341C"]} style={styles.headerBg}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.helloText}>مرحباً</Text>
              <Text style={styles.userName} testID="dashboard-username">{user?.full_name}</Text>
            </View>
            <Pressable testID="logout-button" onPress={logout} style={styles.iconBtn}>
              <Ionicons name="log-out-outline" size={22} color="#fff" />
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
      >
        {hasNoData && (
          <Pressable testID="seed-demo-button" onPress={handleSeed} style={styles.seedBanner}>
            <Ionicons name="sparkles" size={20} color={theme.colors.brandSecondary} />
            <Text style={styles.seedText}>اضغط لإضافة بيانات تجريبية</Text>
          </Pressable>
        )}

        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          <KPI icon="car" label="إجمالي السيارات" value={stats?.total_vehicles ?? 0} color={theme.colors.brandPrimary} testID="kpi-vehicles" />
          <KPI icon="build" label="قيد الصيانة" value={stats?.in_maintenance ?? 0} color={theme.colors.warning} testID="kpi-maintenance" />
          <KPI icon="warning" label="مخالفات معلقة" value={stats?.unpaid_violations ?? 0} color={theme.colors.error} testID="kpi-violations" />
          <KPI icon="airplane" label="إجازات نشطة" value={stats?.active_leaves ?? 0} color={theme.colors.success} testID="kpi-leaves" />
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard} testID="summary-locations">
            <Ionicons name="business" size={20} color={theme.colors.brandPrimary} />
            <Text style={styles.sumVal}>{stats?.total_locations ?? 0}</Text>
            <Text style={styles.sumLbl}>المقرات</Text>
          </View>
          <View style={styles.summaryCard} testID="summary-employees">
            <Ionicons name="people" size={20} color={theme.colors.brandPrimary} />
            <Text style={styles.sumVal}>{stats?.total_employees ?? 0}</Text>
            <Text style={styles.sumLbl}>الموظفين</Text>
          </View>
          <View style={styles.summaryCard} testID="summary-unpaid-amount">
            <Ionicons name="cash" size={20} color={theme.colors.error} />
            <Text style={styles.sumVal}>{(stats?.unpaid_amount ?? 0).toLocaleString()}</Text>
            <Text style={styles.sumLbl}>ر.س غير مسددة</Text>
          </View>
        </View>

        {/* Violations chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Ionicons name="bar-chart" size={20} color={theme.colors.brandPrimary} />
            <Text style={styles.chartTitle}>المخالفات - آخر 6 أشهر</Text>
          </View>
          {barData.length > 0 && barData.some(d => d.value > 0) ? (
            <BarChart
              data={barData}
              barWidth={26}
              barBorderRadius={6}
              spacing={18}
              yAxisThickness={0}
              xAxisThickness={0}
              xAxisLabelTextStyle={{ color: theme.colors.onSurfaceSecondary, fontSize: 10 }}
              yAxisTextStyle={{ color: theme.colors.onSurfaceTertiary, fontSize: 10 }}
              noOfSections={4}
              height={160}
              width={W - 80}
              isAnimated
            />
          ) : (
            <Text style={styles.emptyText}>لا توجد مخالفات</Text>
          )}
        </View>

        {/* Maintenance pie */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Ionicons name="pie-chart" size={20} color={theme.colors.brandPrimary} />
            <Text style={styles.chartTitle}>حالة الصيانة</Text>
          </View>
          {totalMaint > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 8 }}>
              <PieChart
                data={pieData}
                donut
                radius={70}
                innerRadius={45}
                centerLabelComponent={() => (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: theme.colors.onSurface }}>{totalMaint}</Text>
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
          ) : (
            <Text style={styles.emptyText}>لا توجد بيانات صيانة</Text>
          )}
        </View>

        {/* Alerts */}
        {stats && stats.upcoming_maintenance > 0 && (
          <View style={styles.alertCard} testID="upcoming-maintenance-alert">
            <Ionicons name="notifications" size={22} color={theme.colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>صيانة قادمة</Text>
              <Text style={styles.alertText}>{stats.upcoming_maintenance} صيانة مستحقة خلال 30 يوم</Text>
            </View>
          </View>
        )}

        <View style={styles.costCard} testID="maintenance-cost-card">
          <Text style={styles.costLabel}>تكلفة الصيانة هذه السنة</Text>
          <Text style={styles.costVal}>{(stats?.maintenance_cost_year ?? 0).toLocaleString()} ر.س</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const KPI = ({ icon, label, value, color, testID }: any) => (
  <View style={styles.kpiCard} testID={testID}>
    <View style={[styles.kpiIcon, { backgroundColor: color + "20" }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={styles.kpiValue}>{value}</Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </View>
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
  headerRow: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md,
  },
  helloText: { color: "rgba(255,255,255,0.75)", fontSize: 13, textAlign: "right" },
  userName: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "right" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1, marginTop: -theme.spacing.md },
  seedBanner: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
    backgroundColor: "#FFF8E5", borderRadius: theme.radius.md, padding: theme.spacing.md,
    marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.warning,
  },
  seedText: { flex: 1, textAlign: "right", color: theme.colors.onSurfaceSecondary, fontWeight: "600" },
  kpiGrid: {
    flexDirection: "row-reverse", flexWrap: "wrap", padding: theme.spacing.md, gap: theme.spacing.sm,
  },
  kpiCard: {
    width: (W - theme.spacing.md * 2 - theme.spacing.sm) / 2,
    backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md,
    padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border,
  },
  kpiIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  kpiValue: { fontSize: 24, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  kpiLabel: { fontSize: 12, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginTop: 2 },
  summaryRow: {
    flexDirection: "row-reverse", paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm, marginBottom: theme.spacing.md,
  },
  summaryCard: {
    flex: 1, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md,
    padding: theme.spacing.md, alignItems: "center", borderWidth: 1, borderColor: theme.colors.border,
  },
  sumVal: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface, marginTop: 6 },
  sumLbl: { fontSize: 11, color: theme.colors.onSurfaceTertiary, marginTop: 2, textAlign: "center" },
  chartCard: {
    backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md,
    marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.md,
    padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border,
  },
  chartHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: theme.spacing.md },
  chartTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.onSurface },
  emptyText: { textAlign: "center", color: theme.colors.onSurfaceTertiary, padding: theme.spacing.lg },
  alertCard: {
    flexDirection: "row-reverse", alignItems: "center", gap: theme.spacing.md,
    backgroundColor: "#FFF8E5", borderRadius: theme.radius.md, padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.warning,
  },
  alertTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  alertText: { fontSize: 12, color: theme.colors.onSurfaceSecondary, textAlign: "right", marginTop: 2 },
  costCard: {
    backgroundColor: theme.colors.brandTertiary, borderRadius: theme.radius.md,
    padding: theme.spacing.lg, marginHorizontal: theme.spacing.md,
  },
  costLabel: { fontSize: 13, color: theme.colors.onBrandTertiary, textAlign: "right" },
  costVal: { fontSize: 24, fontWeight: "700", color: theme.colors.onBrandTertiary, textAlign: "right", marginTop: 4 },
});
