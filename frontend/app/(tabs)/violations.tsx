import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator, Alert, Dimensions, Image as ExpoImage } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "react-native-gifted-charts";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { theme } from "@/src/theme";
import { FormSheet, Field, inputStyle } from "@/src/FormSheet";
import { PickerRow } from "./vehicles";
import { useAuth } from "@/src/auth";
import { chooseImage } from "@/src/helpers";

const W = Dimensions.get("window").width;

export default function ViolationsScreen() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({
    vehicle_id: null, employee_id: null, violation_type: "", amount: "", date: new Date().toISOString().slice(0, 10),
    location: "", status: "unpaid", notes: "",
  });

  const load = useCallback(async () => {
    try {
      const [v, m, veh, emp] = await Promise.all([api.violations.list(), api.violationsMonthly(), api.vehicles.list(), api.employees.list()]);
      setItems(v); setMonthly(m); setVehicles(veh); setEmployees(emp);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = () => {
    if (!isAdmin) return;
    setEditing(null);
    setForm({ vehicle_id: vehicles[0]?.id || null, employee_id: null, violation_type: "", amount: "", date: new Date().toISOString().slice(0, 10), location: "", status: "unpaid", notes: "" });
    setSheetOpen(true);
  };

  const openEdit = (it: any) => {
    if (!isAdmin) return;
    setEditing(it);
    setForm({ ...it, amount: String(it.amount) });
    setSheetOpen(true);
  };

  const submit = async () => {
    if (!form.vehicle_id || !form.violation_type || !form.amount) {
      Alert.alert("خطأ", "يرجى ملء الحقول المطلوبة");
      return;
    }
    const body = { ...form, amount: parseFloat(form.amount) };
    try {
      if (editing) await api.violations.update(editing.id, body);
      else await api.violations.create(body);
      setSheetOpen(false);
      load();
    } catch (e: any) { Alert.alert("خطأ", e.message); }
  };

  const remove = (it: any) => {
    Alert.alert("حذف المخالفة", "هل أنت متأكد؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => { await api.violations.delete(it.id); load(); } },
    ]);
  };

  const togglePaid = async (it: any) => {
    try {
      await api.violations.update(it.id, { ...it, status: it.status === "paid" ? "unpaid" : "paid" });
      load();
    } catch {}
  };

  const filtered = items.filter(v => filter === "all" || v.status === filter);
  const totalUnpaid = items.filter(v => v.status === "unpaid").reduce((s, v) => s + (v.amount || 0), 0);
  const lineData = monthly.map(m => ({ value: m.count, label: m.label, dataPointText: String(m.count) }));

  const chips = [
    { key: "all", label: `الكل (${items.length})` },
    { key: "unpaid", label: `غير مسددة` },
    { key: "paid", label: `مسددة` },
  ];

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>المخالفات المرورية</Text>
        {isAdmin && (
          <Pressable testID="add-violation-btn" onPress={openAdd} style={styles.addBtn}>
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: 80 }}
          ListHeaderComponent={
            <View>
              <View style={styles.summary}>
                <Text style={styles.sumLabel}>إجمالي غير المسدد</Text>
                <Text style={styles.sumValue}>{totalUnpaid.toLocaleString()} ر.س</Text>
              </View>

              {lineData.some(d => d.value > 0) && (
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>اتجاه المخالفات - آخر 6 أشهر</Text>
                  <LineChart
                    data={lineData}
                    color={theme.colors.brandSecondary}
                    thickness={3}
                    curved
                    hideDataPoints={false}
                    dataPointsColor={theme.colors.brandSecondary}
                    yAxisThickness={0}
                    xAxisThickness={0}
                    xAxisLabelTextStyle={{ color: theme.colors.onSurfaceSecondary, fontSize: 10 }}
                    yAxisTextStyle={{ color: theme.colors.onSurfaceTertiary, fontSize: 10 }}
                    height={140}
                    width={W - 80}
                    noOfSections={4}
                    isAnimated
                    initialSpacing={20}
                  />
                </View>
              )}

              <View style={styles.chipRowWrap}>
                <FlatList
                  horizontal inverted showsHorizontalScrollIndicator={false}
                  data={chips} keyExtractor={(i) => i.key}
                  contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: 8 }}
                  renderItem={({ item }) => (
                    <Pressable testID={`vfilter-${item.key}`} onPress={() => setFilter(item.key)} style={[styles.chip, filter === item.key && styles.chipActive]}>
                      <Text style={[styles.chipText, filter === item.key && styles.chipTextActive]}>{item.label}</Text>
                    </Pressable>
                  )}
                />
              </View>
            </View>
          }
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="checkmark-circle" size={48} color={theme.colors.success} /><Text style={styles.emptyText}>سجل المخالفات نظيف</Text></View>}
          renderItem={({ item }) => {
            const veh = vehicles.find(v => v.id === item.vehicle_id);
            const emp = employees.find(e => e.id === item.employee_id);
            const paid = item.status === "paid";
            return (
              <Pressable testID={`violation-card-${item.id}`} style={styles.card} onLongPress={() => remove(item)} onPress={() => openEdit(item)}>
                <View style={styles.cardTop}>
                  <View style={[styles.iconBox, { backgroundColor: paid ? theme.colors.success + "20" : theme.colors.error + "20" }]}>
                    <Ionicons name={paid ? "checkmark-circle" : "warning"} size={22} color={paid ? theme.colors.success : theme.colors.error} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vtype}>{item.violation_type}</Text>
                    <Text style={styles.subtle}>{veh?.plate_number || "غير معروف"} {emp && `- ${emp.name}`}</Text>
                    {item.location && <Text style={styles.subtle}>{item.location}</Text>}
                  </View>
                  <View style={{ alignItems: "flex-start" }}>
                    <Text style={styles.amount}>{item.amount.toLocaleString()} ر.س</Text>
                    <Text style={styles.date}>{item.date}</Text>
                  </View>
                </View>
                <Pressable testID={`toggle-paid-${item.id}`} onPress={() => togglePaid(item)} style={[styles.payBtn, { backgroundColor: paid ? theme.colors.surfaceTertiary : theme.colors.success }]}>
                  <Text style={{ color: paid ? theme.colors.onSurfaceSecondary : "#fff", fontWeight: "700", fontSize: 12 }}>
                    {paid ? "تم السداد ✓" : "تحديد كمسددة"}
                  </Text>
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      <FormSheet visible={sheetOpen} title={editing ? "تعديل مخالفة" : "إضافة مخالفة"} onClose={() => setSheetOpen(false)} onSubmit={submit}>
        <Field label="السيارة *">
          <PickerRow value={form.vehicle_id} onChange={(v: any) => setForm({ ...form, vehicle_id: v })} options={vehicles.map(v => ({ value: v.id, label: v.plate_number }))} />
        </Field>
        <Field label="نوع المخالفة *">
          <TextInput style={inputStyle} value={form.violation_type} onChangeText={(t) => setForm({ ...form, violation_type: t })} placeholder="مثال: تجاوز السرعة" />
        </Field>
        <Field label="المبلغ (ر.س) *">
          <TextInput style={inputStyle} value={form.amount} onChangeText={(t) => setForm({ ...form, amount: t })} keyboardType="numeric" />
        </Field>
        <Field label="التاريخ (YYYY-MM-DD)">
          <TextInput style={inputStyle} value={form.date} onChangeText={(t) => setForm({ ...form, date: t })} />
        </Field>
        <Field label="الموقع">
          <TextInput style={inputStyle} value={form.location} onChangeText={(t) => setForm({ ...form, location: t })} />
        </Field>
        <Field label="السائق">
          <PickerRow value={form.employee_id} onChange={(v: any) => setForm({ ...form, employee_id: v })} options={[{ value: null, label: "غير محدد" }, ...employees.map(e => ({ value: e.id, label: e.name }))]} />
        </Field>
        <Field label="الحالة">
          <PickerRow value={form.status} onChange={(v: any) => setForm({ ...form, status: v })} options={[{ value: "unpaid", label: "غير مسددة" }, { value: "paid", label: "مسددة" }]} />
        </Field>
        <Field label="صورة المخالفة">
          {form.photo ? (
            <View>
              <Pressable onPress={() => chooseImage((d) => setForm({ ...form, photo: d }))}>
                <ExpoImage source={{ uri: form.photo }} style={{ width: "100%", height: 160, borderRadius: theme.radius.md }} />
              </Pressable>
              <Pressable onPress={() => setForm({ ...form, photo: "" })} style={{ marginTop: 6, alignSelf: "flex-end" }}>
                <Text style={{ color: theme.colors.error, fontSize: 12 }}>حذف الصورة</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => chooseImage((d) => setForm({ ...form, photo: d }))} style={{ height: 100, borderWidth: 1, borderStyle: "dashed", borderColor: theme.colors.border, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Ionicons name="camera" size={24} color={theme.colors.onSurfaceTertiary} />
              <Text style={{ color: theme.colors.onSurfaceTertiary, fontSize: 13 }}>إضافة صورة</Text>
            </Pressable>
          )}
        </Field>
        <Field label="ملاحظات">
          <TextInput style={[inputStyle, { minHeight: 60 }]} value={form.notes} onChangeText={(t) => setForm({ ...form, notes: t })} multiline />
        </Field>
      </FormSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: theme.spacing.lg },
  title: { fontSize: 22, fontWeight: "700", color: theme.colors.onSurface },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  summary: { backgroundColor: theme.colors.brandSecondary, marginHorizontal: theme.spacing.md, borderRadius: theme.radius.md, padding: theme.spacing.lg, marginBottom: theme.spacing.md },
  sumLabel: { color: "rgba(255,255,255,0.85)", fontSize: 13, textAlign: "right" },
  sumValue: { color: "#fff", fontSize: 26, fontWeight: "700", textAlign: "right", marginTop: 4 },
  chartCard: { backgroundColor: theme.colors.surfaceSecondary, marginHorizontal: theme.spacing.md, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  chartTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right", marginBottom: theme.spacing.md },
  chipRowWrap: { height: 56, justifyContent: "center", marginBottom: 4 },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  chipText: { fontSize: 13, color: theme.colors.onSurfaceSecondary, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  card: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md, marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border },
  cardTop: { flexDirection: "row-reverse", alignItems: "flex-start", gap: theme.spacing.md },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  vtype: { fontSize: 15, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  subtle: { fontSize: 12, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginTop: 2 },
  amount: { fontSize: 15, fontWeight: "700", color: theme.colors.brandSecondary },
  date: { fontSize: 11, color: theme.colors.onSurfaceTertiary, marginTop: 2 },
  payBtn: { paddingVertical: 8, borderRadius: theme.radius.md, alignItems: "center", marginTop: theme.spacing.sm },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: theme.colors.onSurfaceTertiary },
});
