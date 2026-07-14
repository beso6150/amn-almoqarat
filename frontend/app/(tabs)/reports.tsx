import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BarChart } from "react-native-gifted-charts";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { theme } from "@/src/theme";
import { exportPdf, exportCsv, arabicPdfShell } from "@/src/helpers";

const W = Dimensions.get("window").width;

type ReportKey = "violations" | "maintenance" | "fuel" | "accidents";

const REPORTS = [
  { key: "violations", label: "المخالفات", icon: "warning", color: theme.colors.error },
  { key: "maintenance", label: "الصيانة", icon: "build", color: theme.colors.brandPrimary },
  { key: "fuel", label: "الوقود", icon: "flame", color: theme.colors.brandSecondary },
  { key: "accidents", label: "الحوادث", icon: "alert-circle", color: theme.colors.warning },
];

export default function ReportsScreen() {
  const [active, setActive] = useState<ReportKey>("violations");
  const [loading, setLoading] = useState(true);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [fuelAlerts, setFuelAlerts] = useState<any[]>([]);

  const load = useCallback(async (key: ReportKey) => {
    setLoading(true);
    try {
      const [veh, emp] = await Promise.all([api.vehicles.list(), api.employees.list()]);
      setVehicles(veh); setEmployees(emp);
      let m: any[] = []; let d: any[] = []; let alerts: any[] = [];
      if (key === "violations") { [m, d] = await Promise.all([api.violationsMonthly(), api.violations.list()]); }
      else if (key === "maintenance") { [m, d] = await Promise.all([api.maintenanceMonthly(), api.maintenance.list()]); }
      else if (key === "fuel") { [m, d, alerts] = await Promise.all([api.fuelMonthly(), api.fuel.list(), api.fuelAlerts()]); }
      else if (key === "accidents") { [m, d] = await Promise.all([api.accidentsMonthly(), api.accidents.list()]); }
      setMonthly(m); setRows(d); setFuelAlerts(alerts);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(active); }, [active, load]));

  const totalAmount = monthly.reduce((s, x) => s + (x.amount || 0), 0);
  const totalCount = monthly.reduce((s, x) => s + (x.count || 0), 0);

  const info = REPORTS.find(r => r.key === active)!;
  const barData = monthly.map(m => ({ value: m.count, label: m.label, frontColor: info.color }));

  const handlePdf = async () => {
    const title = `تقرير ${info.label}`;
    const monthlyRows = monthly.map(m => `<tr><td>${m.label}</td><td>${m.count}</td><td>${(m.amount || 0).toLocaleString()}</td></tr>`).join("");
    const detailHeader = active === "violations"
      ? `<tr><th>التاريخ</th><th>النوع</th><th>السيارة</th><th>الموظف</th><th>المبلغ</th><th>الحالة</th></tr>`
      : active === "maintenance"
      ? `<tr><th>التاريخ</th><th>النوع</th><th>السيارة</th><th>الوصف</th><th>التكلفة</th><th>الحالة</th></tr>`
      : active === "fuel"
      ? `<tr><th>التاريخ</th><th>السيارة</th><th>الموظف</th><th>عداد قبل</th><th>عداد بعد</th><th>التكلفة</th></tr>`
      : `<tr><th>التاريخ</th><th>الوصف</th><th>السيارة</th><th>الموظف</th><th>نسبة الخطأ</th><th>التكلفة</th></tr>`;
    const detailRows = rows.map((r: any) => {
      const veh = vehicles.find(v => v.id === r.vehicle_id);
      const emp = employees.find(e => e.id === r.employee_id);
      if (active === "violations") return `<tr><td>${r.date}</td><td>${r.violation_type}</td><td>${veh?.plate_number || ""}</td><td>${emp?.name || ""}</td><td>${r.amount}</td><td>${r.status === "paid" ? "مسددة" : "غير مسددة"}</td></tr>`;
      if (active === "maintenance") return `<tr><td>${r.date}</td><td>${r.maintenance_type}</td><td>${veh?.plate_number || ""}</td><td>${r.description || ""}</td><td>${r.cost}</td><td>${r.status}</td></tr>`;
      if (active === "fuel") return `<tr><td>${r.date}</td><td>${veh?.plate_number || ""}</td><td>${emp?.name || ""}</td><td>${r.odometer_before || ""}</td><td>${r.odometer_after || ""}</td><td>${r.cost}</td></tr>`;
      return `<tr><td>${r.date}</td><td>${r.description}</td><td>${veh?.plate_number || ""}</td><td>${emp?.name || ""}</td><td>${r.fault_percentage}%</td><td>${r.cost}</td></tr>`;
    }).join("");

    const body = `
      <div class="kpi">
        <div><div class="lbl">إجمالي السجلات</div><div class="val">${totalCount}</div></div>
        <div><div class="lbl">إجمالي التكلفة</div><div class="val">${totalAmount.toLocaleString()} ر.س</div></div>
      </div>
      <h2>الإحصائيات الشهرية</h2>
      <table><tr><th>الشهر</th><th>عدد السجلات</th><th>التكلفة (ر.س)</th></tr>${monthlyRows}</table>
      <h2>تفاصيل السجلات</h2>
      <table>${detailHeader}${detailRows}</table>`;
    await exportPdf(title, arabicPdfShell(title, body));
  };

  const handleExcel = async () => {
    const header = active === "violations" ? ["التاريخ", "النوع", "السيارة", "الموظف", "المبلغ", "الحالة", "الموقع"]
      : active === "maintenance" ? ["التاريخ", "النوع", "السيارة", "الوصف", "التكلفة", "الحالة"]
      : active === "fuel" ? ["التاريخ", "السيارة", "الموظف", "عداد قبل", "عداد بعد", "التكلفة"]
      : ["التاريخ", "الوصف", "السيارة", "الموظف", "نسبة الخطأ", "التكلفة", "الحالة"];
    const dataRows = rows.map((r: any) => {
      const veh = vehicles.find(v => v.id === r.vehicle_id);
      const emp = employees.find(e => e.id === r.employee_id);
      if (active === "violations") return [r.date, r.violation_type, veh?.plate_number || "", emp?.name || "", r.amount, r.status === "paid" ? "مسددة" : "غير مسددة", r.location || ""];
      if (active === "maintenance") return [r.date, r.maintenance_type, veh?.plate_number || "", r.description || "", r.cost, r.status];
      if (active === "fuel") return [r.date, veh?.plate_number || "", emp?.name || "", r.odometer_before || "", r.odometer_after || "", r.cost];
      return [r.date, r.description, veh?.plate_number || "", emp?.name || "", `${r.fault_percentage}%`, r.cost, r.status];
    });
    await exportCsv(`تقرير_${info.label}`, [header, ...dataRows.map(a => a.map(x => String(x)))]);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]} testID="reports-screen">
      <View style={styles.header}>
        <Text style={styles.title}>التقارير والإحصائيات</Text>
      </View>

      <View style={styles.chipRowWrap}>
        <ScrollView horizontal inverted showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: 8 }}>
          {REPORTS.map(r => (
            <Pressable key={r.key} testID={`report-tab-${r.key}`} onPress={() => setActive(r.key as ReportKey)} style={[styles.chip, active === r.key && { backgroundColor: r.color, borderColor: r.color }]}>
              <Ionicons name={r.icon as any} size={14} color={active === r.key ? "#fff" : theme.colors.onSurfaceSecondary} />
              <Text style={[styles.chipText, active === r.key && { color: "#fff" }]}>{r.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { borderRightColor: info.color, borderRightWidth: 4 }]}>
              <Text style={styles.sumLbl}>إجمالي السجلات</Text>
              <Text style={styles.sumVal}>{totalCount}</Text>
            </View>
            <View style={[styles.summaryCard, { borderRightColor: info.color, borderRightWidth: 4 }]}>
              <Text style={styles.sumLbl}>إجمالي التكلفة</Text>
              <Text style={styles.sumVal}>{totalAmount.toLocaleString()} <Text style={{ fontSize: 11 }}>ر.س</Text></Text>
            </View>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>الاتجاه الشهري - آخر 6 أشهر</Text>
            {barData.some(d => d.value > 0) ? (
              <BarChart data={barData} barWidth={26} barBorderRadius={6} spacing={18} yAxisThickness={0} xAxisThickness={0} xAxisLabelTextStyle={{ color: theme.colors.onSurfaceSecondary, fontSize: 10 }} yAxisTextStyle={{ color: theme.colors.onSurfaceTertiary, fontSize: 10 }} noOfSections={4} height={160} width={W - 80} isAnimated />
            ) : <Text style={{ textAlign: "center", padding: 20, color: theme.colors.onSurfaceTertiary }}>لا توجد بيانات</Text>}
          </View>

          {active === "fuel" && fuelAlerts.length > 0 && (
            <View style={styles.alertsCard} testID="fuel-alerts-card">
              <Text style={styles.chartTitle}>⚠️ استهلاك فوق المتوسط</Text>
              {fuelAlerts.map((a, i) => (
                <View key={i} style={styles.alertRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertPlate}>{a.plate}</Text>
                    <Text style={styles.alertSub}>الشهر الحالي: {a.current_month_cost.toLocaleString()} ر.س • المتوسط: {a.average.toLocaleString()} ر.س</Text>
                  </View>
                  <Text style={styles.alertBadge}>+{a.increase_percent}%</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.exportRow}>
            <Pressable testID="export-pdf" onPress={handlePdf} style={[styles.exportBtn, { backgroundColor: theme.colors.error }]}>
              <Ionicons name="document-text" size={18} color="#fff" />
              <Text style={styles.exportText}>مشاركة PDF</Text>
            </Pressable>
            <Pressable testID="export-excel" onPress={handleExcel} style={[styles.exportBtn, { backgroundColor: theme.colors.success }]}>
              <Ionicons name="grid" size={18} color="#fff" />
              <Text style={styles.exportText}>مشاركة Excel</Text>
            </Pressable>
          </View>

          {monthly.map((m, i) => (
            <View key={i} style={styles.monthRow}>
              <Text style={styles.monthLbl}>{m.label}</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.monthCount}>{m.count} سجل</Text>
              <Text style={styles.monthAmount}>{(m.amount || 0).toLocaleString()} ر.س</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  header: { padding: theme.spacing.lg },
  title: { fontSize: 22, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  chipRowWrap: { height: 56, justifyContent: "center" },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0, flexDirection: "row-reverse", gap: 6 },
  chipText: { fontSize: 13, color: theme.colors.onSurfaceSecondary, fontWeight: "600" },
  summaryRow: { flexDirection: "row-reverse", gap: 8, marginBottom: theme.spacing.md },
  summaryCard: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  sumLbl: { fontSize: 12, color: theme.colors.onSurfaceTertiary, textAlign: "right" },
  sumVal: { fontSize: 22, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right", marginTop: 4 },
  chartCard: { backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  chartTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right", marginBottom: 12 },
  alertsCard: { backgroundColor: "#FDECE5", padding: theme.spacing.md, borderRadius: theme.radius.md, marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.error },
  alertRow: { flexDirection: "row-reverse", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  alertPlate: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  alertSub: { fontSize: 11, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginTop: 2 },
  alertBadge: { fontSize: 14, fontWeight: "700", color: theme.colors.error },
  exportRow: { flexDirection: "row-reverse", gap: 8, marginBottom: theme.spacing.md },
  exportBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: theme.radius.md },
  exportText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  monthRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, marginBottom: 6, borderWidth: 1, borderColor: theme.colors.border },
  monthLbl: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface },
  monthCount: { fontSize: 12, color: theme.colors.onSurfaceTertiary },
  monthAmount: { fontSize: 13, fontWeight: "700", color: theme.colors.brandPrimary },
});
