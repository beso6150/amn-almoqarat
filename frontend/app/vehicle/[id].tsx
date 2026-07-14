import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Image, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { api } from "@/src/api";
import { theme } from "@/src/theme";

export default function VehicleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"summary" | "maintenance" | "violations" | "fuel" | "accidents" | "history">("summary");

  useEffect(() => {
    (async () => {
      try {
        const d = await api.vehicleHistory(id as string);
        setData(d);
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  const exportPdf = async () => {
    if (!data) return;
    const v = data.vehicle;
    const t = data.totals;
    const rows = (arr: any[], cols: string[][]) => arr.map(r => `<tr>${cols.map(c => `<td style="padding:6px;border-bottom:1px solid #ddd">${r[c[0]] ?? ""}</td>`).join("")}</tr>`).join("");
    const html = `
    <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <style>
      body { font-family: -apple-system, sans-serif; padding: 20px; direction: rtl; }
      h1 { color: #3A4F2C; border-bottom: 3px solid #3A4F2C; padding-bottom: 8px; }
      h2 { color: #3A4F2C; margin-top: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
      th { background: #D6DDD2; padding: 8px; text-align: right; color: #25341C; }
      td { text-align: right; }
      .kpi { display: flex; gap: 16px; margin: 16px 0; }
      .kpi > div { background: #F7F7F5; padding: 12px 16px; border-radius: 8px; flex: 1; text-align: center; }
      .kpi .lbl { font-size: 12px; color: #4A4A46; }
      .kpi .val { font-size: 18px; font-weight: 700; color: #3A4F2C; margin-top: 4px; }
    </style></head><body>
    <h1>تقرير السيارة - ${v.plate_number}</h1>
    <p><strong>الموديل:</strong> ${v.model} ${v.year || ""} - <strong>اللون:</strong> ${v.color || "-"}</p>

    <div class="kpi">
      <div><div class="lbl">تكلفة الصيانة</div><div class="val">${t.maintenance_cost.toLocaleString()} ر.س</div></div>
      <div><div class="lbl">المخالفات</div><div class="val">${t.violations_amount.toLocaleString()} ر.س</div></div>
      <div><div class="lbl">الوقود</div><div class="val">${t.fuel_cost.toLocaleString()} ر.س</div></div>
      <div><div class="lbl">الحوادث</div><div class="val">${t.accident_cost.toLocaleString()} ر.س</div></div>
      <div><div class="lbl">الإجمالي</div><div class="val">${t.grand_total.toLocaleString()} ر.س</div></div>
    </div>

    <h2>سجل الصيانة (${data.maintenance.length})</h2>
    <table><tr><th>التاريخ</th><th>النوع</th><th>الوصف</th><th>التكلفة</th><th>الحالة</th></tr>
      ${rows(data.maintenance, [["date"], ["maintenance_type"], ["description"], ["cost"], ["status"]])}
    </table>

    <h2>المخالفات (${data.violations.length})</h2>
    <table><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>الموقع</th><th>الحالة</th></tr>
      ${rows(data.violations, [["date"], ["violation_type"], ["amount"], ["location"], ["status"]])}
    </table>

    <h2>سجلات الوقود (${data.fuel_records.length})</h2>
    <table><tr><th>التاريخ</th><th>اللترات</th><th>التكلفة</th><th>عداد قبل</th><th>عداد بعد</th></tr>
      ${rows(data.fuel_records, [["date"], ["liters"], ["cost"], ["odometer_before"], ["odometer_after"]])}
    </table>

    <h2>الحوادث (${data.accidents.length})</h2>
    <table><tr><th>التاريخ</th><th>الوصف</th><th>نسبة الخطأ</th><th>التكلفة</th><th>الحالة</th></tr>
      ${rows(data.accidents, [["date"], ["description"], ["fault_percentage"], ["cost"], ["status"]])}
    </table>

    <p style="margin-top:32px;text-align:center;color:#999;font-size:11px">تقرير تم إنشاؤه من تطبيق ميدان - ${new Date().toLocaleString("ar-SA")}</p>
    </body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      const can = await Sharing.isAvailableAsync();
      if (can) await Sharing.shareAsync(uri);
      else await Share.share({ url: uri });
    } catch (e: any) {}
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={theme.colors.brandPrimary} />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>السيارة غير موجودة</Text>
      </SafeAreaView>
    );
  }

  const v = data.vehicle;
  const t = data.totals;

  const tabs = [
    { key: "summary", label: "ملخص", icon: "stats-chart" },
    { key: "maintenance", label: `صيانة (${data.maintenance.length})`, icon: "build" },
    { key: "violations", label: `مخالفات (${data.violations.length})`, icon: "warning" },
    { key: "fuel", label: `وقود (${data.fuel_records.length})`, icon: "flame" },
    { key: "accidents", label: `حوادث (${data.accidents.length})`, icon: "alert-circle" },
    { key: "history", label: `عهدة (${data.assignments.length})`, icon: "time" },
  ];

  return (
    <SafeAreaView style={styles.root} edges={["top"]} testID="vehicle-detail-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-forward" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.plate}>{v.plate_number}</Text>
          <Text style={styles.model}>{v.model} {v.year || ""}</Text>
        </View>
        <Pressable testID="export-pdf-btn" onPress={exportPdf} style={styles.iconBtn}>
          <Ionicons name="share-outline" size={22} color={theme.colors.brandPrimary} />
        </Pressable>
      </View>

      <View style={styles.chipRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: 8, flexDirection: "row-reverse" }}>
          {tabs.map(x => (
            <Pressable key={x.key} testID={`tab-${x.key}`} onPress={() => setTab(x.key as any)} style={[styles.chip, tab === x.key && styles.chipActive]}>
              <Ionicons name={x.icon as any} size={14} color={tab === x.key ? "#fff" : theme.colors.onSurfaceSecondary} />
              <Text style={[styles.chipText, tab === x.key && styles.chipTextActive]}>{x.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}>
        {tab === "summary" && (
          <>
            {v.photo ? <Image source={{ uri: v.photo }} style={styles.hero} /> : null}
            <View style={styles.kpiGrid}>
              <SumCard label="الصيانة" value={t.maintenance_cost} color={theme.colors.brandPrimary} />
              <SumCard label="المخالفات" value={t.violations_amount} color={theme.colors.brandSecondary} />
              <SumCard label="الوقود" value={t.fuel_cost} color={theme.colors.warning} />
              <SumCard label="الحوادث" value={t.accident_cost} color={theme.colors.error} />
            </View>
            <View style={styles.grandTotal}>
              <Text style={styles.grandLabel}>الإجمالي</Text>
              <Text style={styles.grandVal}>{t.grand_total.toLocaleString()} ر.س</Text>
            </View>
          </>
        )}
        {tab === "maintenance" && data.maintenance.map((m: any) => (
          <ListRow key={m.id} title={m.maintenance_type} subtitle={`${m.date} • ${m.description || ""}`} value={`${m.cost.toLocaleString()} ر.س`} icon="build" color={theme.colors.brandPrimary} />
        ))}
        {tab === "violations" && data.violations.map((x: any) => (
          <ListRow key={x.id} title={x.violation_type} subtitle={`${x.date} • ${x.location || ""}`} value={`${x.amount.toLocaleString()} ر.س`} icon="warning" color={x.status === "paid" ? theme.colors.success : theme.colors.error} />
        ))}
        {tab === "fuel" && data.fuel_records.map((f: any) => (
          <ListRow key={f.id} title={`${f.liters} لتر`} subtitle={`${f.date} • ${f.odometer_after && f.odometer_before ? (f.odometer_after - f.odometer_before) + " كم" : ""}`} value={`${f.cost.toLocaleString()} ر.س`} icon="flame" color={theme.colors.warning} />
        ))}
        {tab === "accidents" && data.accidents.map((a: any) => (
          <ListRow key={a.id} title={a.description} subtitle={`${a.date} • خطأ ${a.fault_percentage}%`} value={`${a.cost.toLocaleString()} ر.س`} icon="alert-circle" color={theme.colors.error} />
        ))}
        {tab === "history" && data.assignments.map((a: any) => (
          <ListRow key={a.id} title={`عهدة ابتداءً من ${a.start_date}`} subtitle={a.end_date ? `حتى ${a.end_date}` : "حالية"} value="" icon="time" color={theme.colors.info} />
        ))}
        {tab === "summary" ? null : (data as any)[tab === "history" ? "assignments" : tab === "fuel" ? "fuel_records" : tab].length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={48} color={theme.colors.onSurfaceTertiary} />
            <Text style={{ color: theme.colors.onSurfaceTertiary, marginTop: 8 }}>لا توجد سجلات</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const SumCard = ({ label, value, color }: any) => (
  <View style={[styles.sumCard, { borderRightColor: color, borderRightWidth: 4 }]}>
    <Text style={styles.sumLabel}>{label}</Text>
    <Text style={styles.sumVal}>{value.toLocaleString()} <Text style={{ fontSize: 11 }}>ر.س</Text></Text>
  </View>
);

const ListRow = ({ title, subtitle, value, icon, color }: any) => (
  <View style={styles.row}>
    <View style={[styles.rowIcon, { backgroundColor: color + "20" }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowSub}>{subtitle}</Text>
    </View>
    {value ? <Text style={styles.rowVal}>{value}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface },
  header: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: theme.spacing.md, gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.border },
  plate: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface },
  model: { fontSize: 12, color: theme.colors.onSurfaceTertiary, marginTop: 2 },
  chipRowWrap: { height: 56, justifyContent: "center" },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0, flexDirection: "row-reverse", gap: 6 },
  chipActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  chipText: { fontSize: 12, color: theme.colors.onSurfaceSecondary, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  hero: { width: "100%", height: 180, borderRadius: theme.radius.md, marginBottom: theme.spacing.md, backgroundColor: theme.colors.surfaceTertiary },
  kpiGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: theme.spacing.sm },
  sumCard: { flex: 1, minWidth: "45%", backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  sumLabel: { fontSize: 12, color: theme.colors.onSurfaceTertiary, textAlign: "right" },
  sumVal: { fontSize: 18, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right", marginTop: 4 },
  grandTotal: { backgroundColor: theme.colors.brandPrimary, borderRadius: theme.radius.md, padding: theme.spacing.lg, marginTop: theme.spacing.md, alignItems: "center" },
  grandLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  grandVal: { color: "#fff", fontSize: 26, fontWeight: "700", marginTop: 4 },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  rowSub: { fontSize: 12, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginTop: 2 },
  rowVal: { fontSize: 13, fontWeight: "700", color: theme.colors.onSurface },
  empty: { alignItems: "center", paddingVertical: 40 },
});
