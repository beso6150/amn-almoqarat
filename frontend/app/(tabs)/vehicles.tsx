import React, { useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { theme } from "@/src/theme";
import { FormSheet, Field, inputStyle } from "@/src/FormSheet";

const STATUS_MAP: any = {
  active: { label: "نشطة", color: theme.colors.success },
  maintenance: { label: "قيد الصيانة", color: theme.colors.warning },
  out_of_service: { label: "خارج الخدمة", color: theme.colors.error },
};

export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ plate_number: "", model: "", year: "", color: "", location_id: null, driver_id: null, status: "active" });

  const load = useCallback(async () => {
    try {
      const [v, l, e] = await Promise.all([api.listVehicles(), api.listLocations(), api.listEmployees()]);
      setVehicles(v); setLocations(l); setEmployees(e);
    } catch (err) {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = () => {
    setEditing(null);
    setForm({ plate_number: "", model: "", year: "", color: "", location_id: null, driver_id: null, status: "active" });
    setSheetOpen(true);
  };
  const openEdit = (v: any) => {
    setEditing(v);
    setForm({ ...v, year: v.year ? String(v.year) : "" });
    setSheetOpen(true);
  };

  const submit = async () => {
    if (!form.plate_number || !form.model) {
      Alert.alert("خطأ", "يرجى إدخال رقم اللوحة والموديل");
      return;
    }
    const body = { ...form, year: form.year ? parseInt(form.year) : null };
    try {
      if (editing) await api.updateVehicle(editing.id, body);
      else await api.createVehicle(body);
      setSheetOpen(false);
      load();
    } catch (e: any) { Alert.alert("خطأ", e.message); }
  };

  const remove = (v: any) => {
    Alert.alert("حذف السيارة", `هل تريد حذف ${v.plate_number}؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => { await api.deleteVehicle(v.id); load(); } },
    ]);
  };

  const filtered = vehicles.filter(v => {
    if (filter !== "all" && v.status !== filter) return false;
    if (search && !v.plate_number.includes(search) && !v.model.includes(search)) return false;
    return true;
  });

  const filterChips = [
    { key: "all", label: "الكل" },
    { key: "active", label: "نشطة" },
    { key: "maintenance", label: "قيد الصيانة" },
    { key: "out_of_service", label: "خارج الخدمة" },
  ];

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>السيارات</Text>
        <Pressable testID="add-vehicle-btn" onPress={openAdd} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={theme.colors.onSurfaceTertiary} />
        <TextInput
          testID="vehicle-search"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="ابحث برقم اللوحة أو الموديل"
          placeholderTextColor={theme.colors.onSurfaceTertiary}
          textAlign="right"
        />
      </View>

      <View style={styles.chipRowWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filterChips}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: 8 }}
          inverted
          renderItem={({ item }) => (
            <Pressable
              testID={`filter-${item.key}`}
              onPress={() => setFilter(item.key)}
              style={[styles.chip, filter === item.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === item.key && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          )}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="car-outline" size={48} color={theme.colors.onSurfaceTertiary} />
              <Text style={styles.emptyText}>لا توجد سيارات</Text>
            </View>
          }
          renderItem={({ item }) => {
            const loc = locations.find(l => l.id === item.location_id);
            const drv = employees.find(e => e.id === item.driver_id);
            const st = STATUS_MAP[item.status] || STATUS_MAP.active;
            return (
              <Pressable testID={`vehicle-card-${item.id}`} style={styles.card} onLongPress={() => remove(item)} onPress={() => openEdit(item)}>
                <View style={styles.cardTop}>
                  <View style={styles.iconBox}><Ionicons name="car-sport" size={22} color={theme.colors.brandPrimary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.plate}>{item.plate_number}</Text>
                    <Text style={styles.model}>{item.model} {item.year ? `- ${item.year}` : ""}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: st.color + "20" }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                <View style={styles.cardMeta}>
                  {loc && <Meta icon="location" text={loc.name} />}
                  {drv && <Meta icon="person" text={drv.name} />}
                  {item.color && <Meta icon="color-palette" text={item.color} />}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <FormSheet
        visible={sheetOpen}
        title={editing ? "تعديل سيارة" : "إضافة سيارة"}
        onClose={() => setSheetOpen(false)}
        onSubmit={submit}
        testID="vehicle-form-sheet"
      >
        <Field label="رقم اللوحة *">
          <TextInput style={inputStyle} value={form.plate_number} onChangeText={(t) => setForm({ ...form, plate_number: t })} testID="vf-plate" />
        </Field>
        <Field label="الموديل *">
          <TextInput style={inputStyle} value={form.model} onChangeText={(t) => setForm({ ...form, model: t })} testID="vf-model" />
        </Field>
        <Field label="سنة الصنع">
          <TextInput style={inputStyle} value={form.year} onChangeText={(t) => setForm({ ...form, year: t })} keyboardType="numeric" />
        </Field>
        <Field label="اللون">
          <TextInput style={inputStyle} value={form.color} onChangeText={(t) => setForm({ ...form, color: t })} />
        </Field>
        <Field label="الحالة">
          <PickerRow value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[
            { value: "active", label: "نشطة" }, { value: "maintenance", label: "قيد الصيانة" }, { value: "out_of_service", label: "خارج الخدمة" }
          ]} />
        </Field>
        <Field label="المقر">
          <PickerRow value={form.location_id} onChange={(v) => setForm({ ...form, location_id: v })} options={[{ value: null, label: "غير محدد" }, ...locations.map(l => ({ value: l.id, label: l.name }))]} />
        </Field>
        <Field label="السائق">
          <PickerRow value={form.driver_id} onChange={(v) => setForm({ ...form, driver_id: v })} options={[{ value: null, label: "غير محدد" }, ...employees.map(e => ({ value: e.id, label: e.name }))]} />
        </Field>
      </FormSheet>
    </SafeAreaView>
  );
}

const Meta = ({ icon, text }: any) => (
  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
    <Ionicons name={icon} size={13} color={theme.colors.onSurfaceTertiary} />
    <Text style={{ fontSize: 12, color: theme.colors.onSurfaceTertiary }}>{text}</Text>
  </View>
);

export const PickerRow = ({ value, onChange, options }: any) => (
  <FlatList
    horizontal
    inverted
    showsHorizontalScrollIndicator={false}
    data={options}
    keyExtractor={(item) => String(item.value)}
    contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
    renderItem={({ item }) => (
      <Pressable
        onPress={() => onChange(item.value)}
        style={{
          paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill,
          backgroundColor: value === item.value ? theme.colors.brandPrimary : theme.colors.surface,
          borderWidth: 1, borderColor: value === item.value ? theme.colors.brandPrimary : theme.colors.border,
        }}
      >
        <Text style={{ color: value === item.value ? "#fff" : theme.colors.onSurface, fontSize: 13, fontWeight: "600" }}>{item.label}</Text>
      </Pressable>
    )}
  />
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: theme.spacing.lg },
  title: { fontSize: 24, fontWeight: "700", color: theme.colors.onSurface },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  searchRow: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
    marginHorizontal: theme.spacing.lg, backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: theme.colors.onSurface, writingDirection: "rtl" },
  chipRowWrap: { height: 56, justifyContent: "center", marginTop: 4 },
  chip: {
    height: 36, paddingHorizontal: 16, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  chipText: { fontSize: 13, color: theme.colors.onSurfaceSecondary, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  card: {
    backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md,
    padding: theme.spacing.md, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border,
  },
  cardTop: { flexDirection: "row-reverse", alignItems: "center", gap: theme.spacing.md },
  iconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  plate: { fontSize: 16, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  model: { fontSize: 13, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
  statusText: { fontSize: 11, fontWeight: "700" },
  cardMeta: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 12, marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.divider },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: theme.colors.onSurfaceTertiary },
});
