import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { theme } from "@/src/theme";
import { FormSheet, Field, inputStyle } from "@/src/FormSheet";
import { PickerRow } from "./vehicles";

type Tab = "locations" | "employees" | "leaves" | "maintenance";

export default function EmployeesScreen() {
  const [tab, setTab] = useState<Tab>("employees");
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    try {
      const [l, e, lv, m, v] = await Promise.all([
        api.listLocations(), api.listEmployees(), api.listLeaves(), api.listMaintenance(), api.listVehicles(),
      ]);
      setLocations(l); setEmployees(e); setLeaves(lv); setMaintenance(m); setVehicles(v);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const openAdd = () => {
    setEditing(null);
    if (tab === "locations") setForm({ name: "", address: "", phone: "", manager: "" });
    else if (tab === "employees") setForm({ name: "", national_id: "", phone: "", position: "", location_id: null, salary: "" });
    else if (tab === "leaves") setForm({ employee_id: employees[0]?.id, leave_type: "اعتيادية", start_date: today, end_date: in30, reason: "", status: "approved" });
    else if (tab === "maintenance") setForm({ vehicle_id: vehicles[0]?.id, maintenance_type: "", description: "", cost: "", date: today, status: "completed", next_due_date: "" });
    setSheetOpen(true);
  };

  const openEdit = (it: any) => {
    setEditing(it);
    if (tab === "employees") setForm({ ...it, salary: it.salary ? String(it.salary) : "" });
    else if (tab === "maintenance") setForm({ ...it, cost: String(it.cost || 0) });
    else setForm({ ...it });
    setSheetOpen(true);
  };

  const submit = async () => {
    try {
      if (tab === "locations") {
        if (!form.name || !form.address) return Alert.alert("خطأ", "الاسم والعنوان مطلوبان");
        if (editing) await api.updateLocation(editing.id, form); else await api.createLocation(form);
      } else if (tab === "employees") {
        if (!form.name) return Alert.alert("خطأ", "الاسم مطلوب");
        const body = { ...form, salary: parseFloat(form.salary) || 0 };
        if (editing) await api.updateEmployee(editing.id, body); else await api.createEmployee(body);
      } else if (tab === "leaves") {
        if (!form.employee_id) return Alert.alert("خطأ", "يرجى اختيار موظف");
        if (editing) await api.updateLeave(editing.id, form); else await api.createLeave(form);
      } else if (tab === "maintenance") {
        if (!form.vehicle_id || !form.maintenance_type) return Alert.alert("خطأ", "السيارة ونوع الصيانة مطلوبان");
        const body = { ...form, cost: parseFloat(form.cost) || 0, next_due_date: form.next_due_date || null };
        if (editing) await api.updateMaintenance(editing.id, body); else await api.createMaintenance(body);
      }
      setSheetOpen(false);
      load();
    } catch (e: any) { Alert.alert("خطأ", e.message); }
  };

  const remove = (it: any) => {
    Alert.alert("تأكيد الحذف", "هل أنت متأكد؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        if (tab === "locations") await api.deleteLocation(it.id);
        else if (tab === "employees") await api.deleteEmployee(it.id);
        else if (tab === "leaves") await api.deleteLeave(it.id);
        else if (tab === "maintenance") await api.deleteMaintenance(it.id);
        load();
      } },
    ]);
  };

  const tabs = [
    { key: "employees", label: "الموظفين", icon: "people" },
    { key: "locations", label: "المقرات", icon: "business" },
    { key: "leaves", label: "الإجازات", icon: "airplane" },
    { key: "maintenance", label: "الصيانة", icon: "build" },
  ];

  const renderItem = ({ item }: any) => {
    if (tab === "locations") {
      const count = vehicles.filter(v => v.location_id === item.id).length;
      const empCount = employees.filter(e => e.location_id === item.id).length;
      return (
        <Pressable style={styles.card} onPress={() => openEdit(item)} onLongPress={() => remove(item)} testID={`location-card-${item.id}`}>
          <View style={styles.iconBox}><Ionicons name="business" size={22} color={theme.colors.brandPrimary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.subtle}>{item.address}</Text>
            {item.manager && <Text style={styles.subtle}>المدير: {item.manager}</Text>}
          </View>
          <View style={styles.countCol}>
            <Text style={styles.count}>{count}</Text>
            <Text style={styles.countLbl}>سيارة</Text>
            <Text style={[styles.count, { marginTop: 4 }]}>{empCount}</Text>
            <Text style={styles.countLbl}>موظف</Text>
          </View>
        </Pressable>
      );
    }
    if (tab === "employees") {
      const loc = locations.find(l => l.id === item.location_id);
      const activeLeave = leaves.find(lv => lv.employee_id === item.id && lv.start_date <= today && lv.end_date >= today && lv.status === "approved");
      return (
        <Pressable style={styles.card} onPress={() => openEdit(item)} onLongPress={() => remove(item)} testID={`employee-card-${item.id}`}>
          <View style={styles.iconBox}><Ionicons name="person" size={22} color={theme.colors.brandPrimary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            {item.position && <Text style={styles.subtle}>{item.position}</Text>}
            {loc && <Text style={styles.subtle}>{loc.name}</Text>}
          </View>
          <View style={[styles.badge, { backgroundColor: activeLeave ? theme.colors.warning + "20" : theme.colors.success + "20" }]}>
            <Text style={[styles.badgeText, { color: activeLeave ? theme.colors.warning : theme.colors.success }]}>
              {activeLeave ? "في إجازة" : "على رأس العمل"}
            </Text>
          </View>
        </Pressable>
      );
    }
    if (tab === "leaves") {
      const emp = employees.find(e => e.id === item.employee_id);
      const isActive = item.start_date <= today && item.end_date >= today && item.status === "approved";
      const isPast = item.end_date < today;
      const days = Math.ceil((new Date(item.end_date).getTime() - new Date(item.start_date).getTime()) / 86400000) + 1;
      return (
        <Pressable style={styles.card} onPress={() => openEdit(item)} onLongPress={() => remove(item)} testID={`leave-card-${item.id}`}>
          <View style={[styles.iconBox, { backgroundColor: isActive ? theme.colors.warning + "20" : theme.colors.brandTertiary }]}>
            <Ionicons name="airplane" size={22} color={isActive ? theme.colors.warning : theme.colors.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{emp?.name || "غير معروف"}</Text>
            <Text style={styles.subtle}>{item.leave_type} - {days} يوم</Text>
            <Text style={styles.subtle}>{item.start_date} → {item.end_date}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isActive ? theme.colors.warning + "20" : isPast ? theme.colors.surfaceTertiary : theme.colors.info + "20" }]}>
            <Text style={[styles.badgeText, { color: isActive ? theme.colors.warning : isPast ? theme.colors.onSurfaceTertiary : theme.colors.info }]}>
              {isActive ? "نشطة" : isPast ? "منتهية" : "قادمة"}
            </Text>
          </View>
        </Pressable>
      );
    }
    if (tab === "maintenance") {
      const veh = vehicles.find(v => v.id === item.vehicle_id);
      const stColor = item.status === "completed" ? theme.colors.success : item.status === "pending" ? theme.colors.warning : theme.colors.brandSecondary;
      const stLabel = item.status === "completed" ? "منجزة" : item.status === "pending" ? "قيد الإصلاح" : "قادمة";
      return (
        <Pressable style={styles.card} onPress={() => openEdit(item)} onLongPress={() => remove(item)} testID={`maintenance-card-${item.id}`}>
          <View style={[styles.iconBox, { backgroundColor: stColor + "20" }]}>
            <Ionicons name="build" size={22} color={stColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.maintenance_type}</Text>
            <Text style={styles.subtle}>{veh?.plate_number || "غير معروف"}</Text>
            {item.description && <Text style={styles.subtle}>{item.description}</Text>}
            <Text style={styles.subtle}>{item.date}{item.next_due_date && ` • القادمة: ${item.next_due_date}`}</Text>
          </View>
          <View style={{ alignItems: "flex-start" }}>
            <Text style={styles.cost}>{item.cost.toLocaleString()} ر.س</Text>
            <View style={[styles.badge, { backgroundColor: stColor + "20", marginTop: 4 }]}>
              <Text style={[styles.badgeText, { color: stColor }]}>{stLabel}</Text>
            </View>
          </View>
        </Pressable>
      );
    }
    return null;
  };

  const data = tab === "locations" ? locations : tab === "employees" ? employees : tab === "leaves" ? leaves : maintenance;
  const addLabel = tab === "locations" ? "مقر" : tab === "employees" ? "موظف" : tab === "leaves" ? "إجازة" : "صيانة";

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>الإدارة</Text>
        <Pressable testID="add-item-btn" onPress={openAdd} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.chipRowWrap}>
        <FlatList
          horizontal inverted showsHorizontalScrollIndicator={false}
          data={tabs} keyExtractor={(t) => t.key}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: 8 }}
          renderItem={({ item }) => (
            <Pressable testID={`tab-${item.key}`} onPress={() => setTab(item.key as Tab)} style={[styles.chip, tab === item.key && styles.chipActive]}>
              <Ionicons name={item.icon as any} size={14} color={tab === item.key ? "#fff" : theme.colors.onSurfaceSecondary} />
              <Text style={[styles.chipText, tab === item.key && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          )}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={48} color={theme.colors.onSurfaceTertiary} />
              <Text style={styles.emptyText}>لا توجد بيانات</Text>
              <Pressable testID="empty-add-btn" onPress={openAdd} style={styles.addBigBtn}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>+ إضافة {addLabel}</Text>
              </Pressable>
            </View>
          }
        />
      )}

      <FormSheet visible={sheetOpen} title={`${editing ? "تعديل" : "إضافة"} ${addLabel}`} onClose={() => setSheetOpen(false)} onSubmit={submit}>
        {tab === "locations" && (
          <>
            <Field label="اسم المقر *"><TextInput style={inputStyle} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} /></Field>
            <Field label="العنوان *"><TextInput style={inputStyle} value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} /></Field>
            <Field label="الهاتف"><TextInput style={inputStyle} value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} keyboardType="phone-pad" /></Field>
            <Field label="المدير"><TextInput style={inputStyle} value={form.manager} onChangeText={(t) => setForm({ ...form, manager: t })} /></Field>
          </>
        )}
        {tab === "employees" && (
          <>
            <Field label="الاسم *"><TextInput style={inputStyle} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} /></Field>
            <Field label="رقم الهوية"><TextInput style={inputStyle} value={form.national_id} onChangeText={(t) => setForm({ ...form, national_id: t })} keyboardType="numeric" /></Field>
            <Field label="الهاتف"><TextInput style={inputStyle} value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} keyboardType="phone-pad" /></Field>
            <Field label="الوظيفة"><TextInput style={inputStyle} value={form.position} onChangeText={(t) => setForm({ ...form, position: t })} /></Field>
            <Field label="الراتب"><TextInput style={inputStyle} value={form.salary} onChangeText={(t) => setForm({ ...form, salary: t })} keyboardType="numeric" /></Field>
            <Field label="المقر">
              <PickerRow value={form.location_id} onChange={(v: any) => setForm({ ...form, location_id: v })} options={[{ value: null, label: "غير محدد" }, ...locations.map(l => ({ value: l.id, label: l.name }))]} />
            </Field>
          </>
        )}
        {tab === "leaves" && (
          <>
            <Field label="الموظف *">
              <PickerRow value={form.employee_id} onChange={(v: any) => setForm({ ...form, employee_id: v })} options={employees.map(e => ({ value: e.id, label: e.name }))} />
            </Field>
            <Field label="نوع الإجازة">
              <PickerRow value={form.leave_type} onChange={(v: any) => setForm({ ...form, leave_type: v })} options={[{ value: "اعتيادية", label: "اعتيادية" }, { value: "مرضية", label: "مرضية" }, { value: "عارضة", label: "عارضة" }]} />
            </Field>
            <Field label="تاريخ البدء"><TextInput style={inputStyle} value={form.start_date} onChangeText={(t) => setForm({ ...form, start_date: t })} placeholder="YYYY-MM-DD" /></Field>
            <Field label="تاريخ الانتهاء"><TextInput style={inputStyle} value={form.end_date} onChangeText={(t) => setForm({ ...form, end_date: t })} placeholder="YYYY-MM-DD" /></Field>
            <Field label="السبب"><TextInput style={[inputStyle, { minHeight: 60 }]} value={form.reason} onChangeText={(t) => setForm({ ...form, reason: t })} multiline /></Field>
            <Field label="الحالة">
              <PickerRow value={form.status} onChange={(v: any) => setForm({ ...form, status: v })} options={[{ value: "approved", label: "معتمدة" }, { value: "pending", label: "قيد المراجعة" }, { value: "rejected", label: "مرفوضة" }]} />
            </Field>
          </>
        )}
        {tab === "maintenance" && (
          <>
            <Field label="السيارة *">
              <PickerRow value={form.vehicle_id} onChange={(v: any) => setForm({ ...form, vehicle_id: v })} options={vehicles.map(v => ({ value: v.id, label: v.plate_number }))} />
            </Field>
            <Field label="نوع الصيانة *"><TextInput style={inputStyle} value={form.maintenance_type} onChangeText={(t) => setForm({ ...form, maintenance_type: t })} placeholder="مثال: تغيير زيت" /></Field>
            <Field label="الوصف"><TextInput style={inputStyle} value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} /></Field>
            <Field label="التكلفة (ر.س)"><TextInput style={inputStyle} value={form.cost} onChangeText={(t) => setForm({ ...form, cost: t })} keyboardType="numeric" /></Field>
            <Field label="التاريخ"><TextInput style={inputStyle} value={form.date} onChangeText={(t) => setForm({ ...form, date: t })} placeholder="YYYY-MM-DD" /></Field>
            <Field label="الحالة">
              <PickerRow value={form.status} onChange={(v: any) => setForm({ ...form, status: v })} options={[{ value: "completed", label: "منجزة" }, { value: "pending", label: "قيد الإصلاح" }, { value: "upcoming", label: "قادمة" }]} />
            </Field>
            <Field label="تاريخ الصيانة القادمة"><TextInput style={inputStyle} value={form.next_due_date || ""} onChangeText={(t) => setForm({ ...form, next_due_date: t })} placeholder="YYYY-MM-DD (اختياري)" /></Field>
          </>
        )}
      </FormSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: theme.spacing.lg },
  title: { fontSize: 22, fontWeight: "700", color: theme.colors.onSurface },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  chipRowWrap: { height: 56, justifyContent: "center" },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0, flexDirection: "row-reverse", gap: 6 },
  chipActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  chipText: { fontSize: 13, color: theme.colors.onSurfaceSecondary, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  card: { flexDirection: "row-reverse", alignItems: "flex-start", gap: theme.spacing.md, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border },
  iconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  subtle: { fontSize: 12, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginTop: 2 },
  countCol: { alignItems: "center" },
  count: { fontSize: 16, fontWeight: "700", color: theme.colors.brandPrimary },
  countLbl: { fontSize: 10, color: theme.colors.onSurfaceTertiary },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
  badgeText: { fontSize: 11, fontWeight: "700" },
  cost: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: theme.colors.onSurfaceTertiary },
  addBigBtn: { marginTop: theme.spacing.md, backgroundColor: theme.colors.brandPrimary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: theme.radius.pill },
});
