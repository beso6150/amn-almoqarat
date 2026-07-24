import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator, Alert, Image as ExpoImage, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import { theme } from "@/src/theme";
import { FormSheet, Field, inputStyle } from "@/src/FormSheet";
import { SearchPicker } from "@/src/SearchPicker";
import { openWhatsApp, openDialer, chooseImage } from "@/src/helpers";
import { useAuth } from "@/src/auth";

type Tab = "employees" | "locations" | "leaves" | "maintenance" | "fuel" | "accidents" | "violations";

const POSITIONS = [{ v: "رجل أمن", l: "رجل أمن" }, { v: "مشرف أمن", l: "مشرف أمن" }, { v: "مدير عمليات", l: "مدير عمليات" }];
const GROUPS = [{ v: "none", l: "بدون" }, { v: "A", l: "A (نهار)" }, { v: "B", l: "B (ليل)" }, { v: "C", l: "C (نهار)" }, { v: "D", l: "D (ليل)" }];

export default function ManagementScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("employees");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [locations, setLocations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [fuel, setFuel] = useState<any[]>([]);
  const [accidents, setAccidents] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    try {
      const [l, e, lv, m, v, f, a, vio] = await Promise.all([
        api.locations.list(), api.employees.list(), api.leaves.list(),
        api.maintenance.list(), api.vehicles.list(),
        api.fuel.list(), api.accidents.list(), api.violations.list(),
      ]);
      setLocations(l); setEmployees(e); setLeaves(lv); setMaintenance(m); setVehicles(v);
      setFuel(f); setAccidents(a); setViolations(vio);
    } catch { }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const openAdd = () => {
    if (!isAdmin) return;
    setEditing(null);
    if (tab === "locations") setForm({ name: "", address: "", region: "مكة", phone: "", manager: "" });
    else if (tab === "employees") setForm({ name: "", employee_number: "", national_id: "", phone: "", position: "رجل أمن", group: "none", location_id: null });
    else if (tab === "leaves") setForm({ employee_id: null, leave_type: "سنوية", start_date: today, end_date: in30, reason: "", status: "approved" });
    else if (tab === "maintenance") setForm({ vehicle_id: null, employee_id: null, maintenance_type: "", description: "", cost: "", date: today, status: "completed", next_due_date: "" });
    else if (tab === "fuel") setForm({ vehicle_id: null, employee_id: null, date: today, cost: "", odometer_before: "", odometer_after: "", notes: "" });
    else if (tab === "accidents") setForm({ vehicle_id: null, employee_id: null, date: today, description: "", fault_percentage: "0", cost: "", status: "open", location: "", notes: "", photos: [] });
    else if (tab === "violations") setForm({ vehicle_id: null, employee_id: null, violation_type: "", amount: "", date: today, location: "", status: "unpaid", photo: "", notes: "" });
    setSheetOpen(true);
  };

  const openEdit = (it: any) => {
    if (!isAdmin) return;
    setEditing(it);
    if (tab === "maintenance") setForm({ ...it, cost: String(it.cost || 0) });
    else if (tab === "fuel") setForm({ ...it, cost: String(it.cost || 0), odometer_before: String(it.odometer_before || 0), odometer_after: String(it.odometer_after || 0) });
    else if (tab === "accidents") setForm({ ...it, fault_percentage: String(it.fault_percentage || 0), cost: String(it.cost || 0), photos: it.photos || [] });
    else if (tab === "violations") setForm({ ...it, amount: String(it.amount || 0) });
    else setForm({ ...it });
    setSheetOpen(true);
  };

  const submit = async () => {
    try {
      if (tab === "locations") {
        if (!form.name || !form.address) return Alert.alert("خطأ", "الاسم والعنوان مطلوبان");
        if (editing) await api.locations.update(editing.id, form); else await api.locations.create(form);
      } else if (tab === "employees") {
        if (!form.name) return Alert.alert("خطأ", "الاسم مطلوب");
        if (editing) await api.employees.update(editing.id, form); else await api.employees.create(form);
      } else if (tab === "leaves") {
        if (!form.employee_id) {
          return Alert.alert("خطأ", "يرجى اختيار موظف");
        }

        const body = {
          ...form,
          leave_type: "سنوية",
          status: form.status || "approved",
        };

        let savedLeave: any;

        if (editing) {
          savedLeave = await api.leaves.update(editing.id, body);
        } else {
          savedLeave = await api.leaves.create(body);
        }

        const phone = savedLeave?.whatsapp_phone;
        const message = savedLeave?.whatsapp_message;

        setSheetOpen(false);
        await load();

        if (phone && message) {
          Alert.alert(
            "تم حفظ الإجازة",
            "هل تريد إرسال تفاصيل الإجازة للموظف عبر واتساب؟",
            [
              {
                text: "إلغاء",
                style: "cancel",
              },
              {
                text: "إرسال واتساب",
                onPress: () => openWhatsApp(phone, message),
              },
            ]
          );
        } else {
          Alert.alert(
            "تم حفظ الإجازة",
            "لم يظهر زر واتساب لأن الموظف لا يملك رقم جوال مسجلًا."
          );
        }

        return;
      } else if (tab === "maintenance") {
        if (!form.vehicle_id || !form.maintenance_type) return Alert.alert("خطأ", "السيارة ونوع الصيانة مطلوبان");
        const body = { ...form, cost: parseFloat(form.cost) || 0, next_due_date: form.next_due_date || null };
        if (editing) await api.maintenance.update(editing.id, body); else await api.maintenance.create(body);
      } else if (tab === "fuel") {
        if (!form.vehicle_id) return Alert.alert("خطأ", "يرجى اختيار سيارة");
        const body = { ...form, cost: parseFloat(form.cost) || 0, odometer_before: parseFloat(form.odometer_before) || 0, odometer_after: parseFloat(form.odometer_after) || 0 };
        if (editing) await api.fuel.update(editing.id, body); else await api.fuel.create(body);
      } else if (tab === "accidents") {
        if (!form.vehicle_id || !form.description) return Alert.alert("خطأ", "السيارة والوصف مطلوبان");
        const body = { ...form, fault_percentage: parseFloat(form.fault_percentage) || 0, cost: parseFloat(form.cost) || 0, photos: form.photos || [] };
        if (editing) await api.accidents.update(editing.id, body); else await api.accidents.create(body);
      } else if (tab === "violations") {
        if (!form.vehicle_id || !form.violation_type || !form.amount) return Alert.alert("خطأ", "السيارة، النوع، والمبلغ مطلوبة");
        const body = { ...form, amount: parseFloat(form.amount) || 0 };
        let created: any;
        if (editing) created = await api.violations.update(editing.id, body);
        else created = await api.violations.create(body);
        setSheetOpen(false);
        load();
        // Offer WhatsApp notification
        if (created?.employee_id) {
          setTimeout(() => askNotifyViolation(created.id || editing?.id), 300);
        }
        return;
      }
      setSheetOpen(false);
      load();
    } catch (e: any) { Alert.alert("خطأ", e.message); }
  };

  const askNotifyViolation = (vid: string) => {
    Alert.alert("إشعار الموظف", "هل تريد إرسال إشعار عبر واتساب للموظف بالمخالفة؟", [
      { text: "لاحقاً", style: "cancel" },
      {
        text: "إرسال الآن", onPress: async () => {
          try {
            const info = await api.violationNotifyInfo(vid);
            openWhatsApp(info.phone, info.message);
          } catch (e: any) { Alert.alert("تعذر الإرسال", e.message); }
        }
      },
    ]);
  };

  const remove = (it: any) => {
    if (!isAdmin) return;
    Alert.alert("تأكيد الحذف", "هل أنت متأكد؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف", style: "destructive", onPress: async () => {
          try {
            if (tab === "locations") await api.locations.delete(it.id);
            else if (tab === "employees") await api.employees.delete(it.id);
            else if (tab === "leaves") await api.leaves.delete(it.id);
            else if (tab === "maintenance") await api.maintenance.delete(it.id);
            else if (tab === "fuel") await api.fuel.delete(it.id);
            else if (tab === "accidents") await api.accidents.delete(it.id);
            else if (tab === "violations") await api.violations.delete(it.id);
            load();
          } catch (e: any) { Alert.alert("خطأ", e.message); }
        }
      },
    ]);
  };

  const tabs = [
    { key: "employees", label: "الموظفين", icon: "people" },
    { key: "locations", label: "المقرات", icon: "business" },
    { key: "leaves", label: "الإجازات", icon: "airplane" },
    { key: "maintenance", label: "الصيانة", icon: "build" },
    { key: "fuel", label: "الوقود", icon: "flame" },
    { key: "accidents", label: "الحوادث", icon: "alert-circle" },
    { key: "violations", label: "المخالفات", icon: "warning" },
  ];

  const employeeItems = employees.map(e => ({ id: e.id, name: e.name, sub: `${e.employee_number || ""} • ${e.position || ""}${e.group && e.group !== "none" ? " • مجموعة " + e.group : ""}` }));
  const vehicleItems = vehicles.map(v => ({ id: v.id, name: v.plate_number, sub: v.model }));
  const locationItems = locations.map(l => ({ id: l.id, name: l.name, sub: l.address }));

  const rawData = tab === "locations" ? locations : tab === "employees" ? employees : tab === "leaves" ? leaves : tab === "maintenance" ? maintenance : tab === "fuel" ? fuel : tab === "accidents" ? accidents : violations;
  const data = search.trim() ? rawData.filter((it: any) => {
    const q = search.toLowerCase();
    const strFields = [it.name, it.employee_number, it.phone, it.position, it.plate_number, it.model, it.maintenance_type, it.violation_type, it.description, it.address].filter(Boolean).join(" ").toLowerCase();
    return strFields.includes(q);
  }) : rawData;
  const addLabel = tab === "locations" ? "مقر" : tab === "employees" ? "موظف" : tab === "leaves" ? "إجازة" : tab === "maintenance" ? "صيانة" : tab === "fuel" ? "تعبئة وقود" : tab === "accidents" ? "حادث" : "مخالفة";

  const renderItem = ({ item }: any) => {
    if (tab === "locations") {
      const count = vehicles.filter(v => v.location_id === item.id).length;
      const empCount = employees.filter(e => e.location_id === item.id).length;
      return (
        <Pressable style={styles.card} onPress={() => router.push({ pathname: "/location/[id]", params: { id: item.id } })} onLongPress={() => remove(item)} testID={`location-card-${item.id}`}>
          <View style={styles.iconBox}><Ionicons name="business" size={22} color={theme.colors.brandPrimary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.subtle}>{item.address}</Text>
            {isAdmin && <Pressable testID={`edit-loc-${item.id}`} onPress={() => openEdit(item)}><Text style={{ color: theme.colors.brandPrimary, fontSize: 12, marginTop: 4, textAlign: "right" }}>تعديل</Text></Pressable>}
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
        <View style={styles.cardCol} testID={`employee-card-${item.id}`}>
          <Pressable style={{ flexDirection: "row-reverse", flex: 1, alignItems: "flex-start", gap: theme.spacing.md }} onPress={() => openEdit(item)} onLongPress={() => remove(item)}>
            <View style={styles.iconBox}><Ionicons name="person" size={22} color={theme.colors.brandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              {item.employee_number ? <Text style={styles.subtle}>الرقم الوظيفي: {item.employee_number}</Text> : null}
              <View style={{ flexDirection: "row-reverse", gap: 6, marginTop: 4 }}>
                {item.position ? <View style={styles.miniBadge}><Text style={styles.miniBadgeText}>{item.position}</Text></View> : null}
                {item.group && item.group !== "none" ? <View style={[styles.miniBadge, { backgroundColor: theme.colors.brandSecondary + "20" }]}><Text style={[styles.miniBadgeText, { color: theme.colors.brandSecondary }]}>مجموعة {item.group}</Text></View> : null}
              </View>
              {loc && <Text style={styles.subtle}>{loc.name}</Text>}
            </View>
            <View style={[styles.badge, { backgroundColor: activeLeave ? theme.colors.warning + "20" : theme.colors.success + "20" }]}>
              <Text style={[styles.badgeText, { color: activeLeave ? theme.colors.warning : theme.colors.success }]}>{activeLeave ? "في إجازة" : "على رأس العمل"}</Text>
            </View>
          </Pressable>
          {item.phone ? (
            <View style={styles.contactRow}>
              <Pressable testID={`call-${item.id}`} onPress={() => openDialer(item.phone)} style={[styles.contactBtn, { backgroundColor: theme.colors.brandPrimary }]}>
                <Ionicons name="call" size={16} color="#fff" /><Text style={styles.contactText}>اتصال</Text>
              </Pressable>
              <Pressable testID={`whatsapp-${item.id}`} onPress={() => openWhatsApp(item.phone)} style={[styles.contactBtn, { backgroundColor: "#25D366" }]}>
                <Ionicons name="logo-whatsapp" size={16} color="#fff" /><Text style={styles.contactText}>واتساب</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
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
            <Text style={[styles.badgeText, { color: isActive ? theme.colors.warning : isPast ? theme.colors.onSurfaceTertiary : theme.colors.info }]}>{isActive ? "نشطة" : isPast ? "منتهية" : "قادمة"}</Text>
          </View>
        </Pressable>
      );
    }
    if (tab === "maintenance") {
      const veh = vehicles.find(v => v.id === item.vehicle_id);
      const emp = employees.find(e => e.id === item.employee_id);
      const stColor = item.status === "completed" ? theme.colors.success : item.status === "pending" ? theme.colors.warning : theme.colors.brandSecondary;
      const stLabel = item.status === "completed" ? "منجزة" : item.status === "pending" ? "قيد الإصلاح" : "قادمة";
      return (
        <Pressable style={styles.card} onPress={() => openEdit(item)} onLongPress={() => remove(item)} testID={`maintenance-card-${item.id}`}>
          <View style={[styles.iconBox, { backgroundColor: stColor + "20" }]}><Ionicons name="build" size={22} color={stColor} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.maintenance_type}</Text>
            <Text style={styles.subtle}>{veh?.plate_number || "غير معروف"}{emp && ` • ${emp.name}`}</Text>
            {item.description && <Text style={styles.subtle}>{item.description}</Text>}
            <Text style={styles.subtle}>{item.date}{item.next_due_date && ` • القادمة: ${item.next_due_date}`}</Text>
          </View>
          <View style={{ alignItems: "flex-start" }}>
            <Text style={styles.cost}>{item.cost.toLocaleString()} ر.س</Text>
            <View style={[styles.badge, { backgroundColor: stColor + "20", marginTop: 4 }]}><Text style={[styles.badgeText, { color: stColor }]}>{stLabel}</Text></View>
          </View>
        </Pressable>
      );
    }
    if (tab === "fuel") {
      const veh = vehicles.find(v => v.id === item.vehicle_id);
      const emp = employees.find(e => e.id === item.employee_id);
      const dist = (item.odometer_after && item.odometer_before) ? (item.odometer_after - item.odometer_before) : 0;
      return (
        <Pressable style={styles.card} onPress={() => openEdit(item)} onLongPress={() => remove(item)} testID={`fuel-card-${item.id}`}>
          <View style={[styles.iconBox, { backgroundColor: theme.colors.brandSecondary + "20" }]}><Ionicons name="flame" size={22} color={theme.colors.brandSecondary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.cost.toLocaleString()} ر.س</Text>
            <Text style={styles.subtle}>{veh?.plate_number || "غير معروف"}{emp && ` • ${emp.name}`}</Text>
            <Text style={styles.subtle}>{item.date}{dist > 0 && ` • ${dist} كم`}</Text>
          </View>
          {(item.photo_before || item.photo_after) && <Ionicons name="camera" size={18} color={theme.colors.brandPrimary} />}
        </Pressable>
      );
    }
    if (tab === "accidents") {
      const veh = vehicles.find(v => v.id === item.vehicle_id);
      const emp = employees.find(e => e.id === item.employee_id);
      const closed = item.status === "closed";
      return (
        <Pressable style={styles.card} onPress={() => openEdit(item)} onLongPress={() => remove(item)} testID={`accident-card-${item.id}`}>
          <View style={[styles.iconBox, { backgroundColor: theme.colors.error + "20" }]}><Ionicons name="alert-circle" size={22} color={theme.colors.error} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.description}</Text>
            <Text style={styles.subtle}>{veh?.plate_number || "غير معروف"}{emp && ` • ${emp.name}`}</Text>
            <Text style={styles.subtle}>{item.date} • نسبة الخطأ: {item.fault_percentage}%</Text>
          </View>
          <View style={{ alignItems: "flex-start" }}>
            <Text style={styles.cost}>{item.cost.toLocaleString()} ر.س</Text>
            <View style={[styles.badge, { backgroundColor: closed ? theme.colors.success + "20" : theme.colors.warning + "20", marginTop: 4 }]}><Text style={[styles.badgeText, { color: closed ? theme.colors.success : theme.colors.warning }]}>{closed ? "مغلقة" : "مفتوحة"}</Text></View>
          </View>
        </Pressable>
      );
    }
    if (tab === "violations") {
      const veh = vehicles.find(v => v.id === item.vehicle_id);
      const emp = employees.find(e => e.id === item.employee_id);
      const paid = item.status === "paid";
      return (
        <View style={styles.cardCol} testID={`violation-card-${item.id}`}>
          <Pressable style={{ flexDirection: "row-reverse", flex: 1, alignItems: "flex-start", gap: theme.spacing.md }} onPress={() => openEdit(item)} onLongPress={() => remove(item)}>
            <View style={[styles.iconBox, { backgroundColor: paid ? theme.colors.success + "20" : theme.colors.error + "20" }]}>
              <Ionicons name={paid ? "checkmark-circle" : "warning"} size={22} color={paid ? theme.colors.success : theme.colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.violation_type}</Text>
              <Text style={styles.subtle}>{veh?.plate_number || "غير معروف"}{emp && ` • ${emp.name}`}</Text>
              {item.location && <Text style={styles.subtle}>{item.location}</Text>}
              <Text style={styles.subtle}>{item.date}</Text>
            </View>
            <View style={{ alignItems: "flex-start" }}>
              <Text style={styles.cost}>{item.amount.toLocaleString()} ر.س</Text>
              <View style={[styles.badge, { backgroundColor: paid ? theme.colors.success + "20" : theme.colors.error + "20", marginTop: 4 }]}><Text style={[styles.badgeText, { color: paid ? theme.colors.success : theme.colors.error }]}>{paid ? "مسددة" : "غير مسددة"}</Text></View>
            </View>
          </Pressable>
          {item.employee_id && emp?.phone && (
            <View style={styles.contactRow}>
              <Pressable testID={`notify-violation-${item.id}`} onPress={() => askNotifyViolation(item.id)} style={[styles.contactBtn, { backgroundColor: "#25D366" }]}>
                <Ionicons name="logo-whatsapp" size={16} color="#fff" /><Text style={styles.contactText}>{item.notified ? "إعادة الإرسال" : "إشعار الموظف"}</Text>
              </Pressable>
              <Pressable testID={`toggle-paid-${item.id}`} onPress={async () => { try { await api.violations.update(item.id, { ...item, status: paid ? "unpaid" : "paid" }); load(); } catch (e: any) { Alert.alert("خطأ", e.message); } }} style={[styles.contactBtn, { backgroundColor: paid ? theme.colors.surfaceTertiary : theme.colors.success }]}>
                <Text style={{ color: paid ? theme.colors.onSurfaceSecondary : "#fff", fontWeight: "700", fontSize: 12 }}>{paid ? "تم السداد" : "تحديد كمسددة"}</Text>
              </Pressable>
            </View>
          )}
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>الإدارة</Text>
        {isAdmin && (
          <Pressable testID="add-item-btn" onPress={openAdd} style={styles.addBtn}>
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        )}
      </View>

      <View style={styles.chipRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: 8 }}>
          {tabs.map(t => (
            <Pressable key={t.key} testID={`tab-${t.key}`} onPress={() => { setTab(t.key as Tab); setSearch(""); }} style={[styles.chip, tab === t.key && styles.chipActive]}>
              <Ionicons name={t.icon as any} size={14} color={tab === t.key ? "#fff" : theme.colors.onSurfaceSecondary} />
              <Text style={[styles.chipText, tab === t.key && styles.chipTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={theme.colors.onSurfaceTertiary} />
        <TextInput testID="mgmt-search" style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="ابحث…" placeholderTextColor={theme.colors.onSurfaceTertiary} textAlign="right" />
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
              {isAdmin && (<Pressable testID="empty-add-btn" onPress={openAdd} style={styles.addBigBtn}><Text style={{ color: "#fff", fontWeight: "700" }}>+ إضافة {addLabel}</Text></Pressable>)}
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
            <Field label="الرقم الوظيفي"><TextInput style={inputStyle} value={form.employee_number} onChangeText={(t) => setForm({ ...form, employee_number: t })} placeholder="EMP-001" /></Field>
            <Field label="رقم الهوية"><TextInput style={inputStyle} value={form.national_id} onChangeText={(t) => setForm({ ...form, national_id: t })} keyboardType="numeric" /></Field>
            <Field label="الهاتف"><TextInput style={inputStyle} value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} keyboardType="phone-pad" placeholder="05xxxxxxxx" /></Field>
            <Field label="الوظيفة">
              <View style={{ flexDirection: "row-reverse", gap: 6, flexWrap: "wrap" }}>
                {POSITIONS.map(p => (
                  <Pressable key={p.v} onPress={() => setForm({ ...form, position: p.v })} style={[styles.pill, form.position === p.v && styles.pillActive]}>
                    <Text style={[styles.pillText, form.position === p.v && { color: "#fff" }]}>{p.l}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field label="المجموعة">
              <View style={{ flexDirection: "row-reverse", gap: 6, flexWrap: "wrap" }}>
                {GROUPS.map(g => (
                  <Pressable key={g.v} onPress={() => setForm({ ...form, group: g.v })} style={[styles.pill, form.group === g.v && styles.pillActive]}>
                    <Text style={[styles.pillText, form.group === g.v && { color: "#fff" }]}>{g.l}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field label="المقر">
              <SearchPicker label="اختر المقر" items={locationItems} value={form.location_id} onChange={(v) => setForm({ ...form, location_id: v })} testID="emp-location-picker" />
            </Field>
          </>
        )}
        {tab === "leaves" && (
          <>
            <Field label="الموظف *">
              <SearchPicker label="ابحث عن موظف" items={employeeItems} value={form.employee_id} onChange={(v) => setForm({ ...form, employee_id: v })} allowClear={false} testID="leave-employee-picker" />
            </Field>
            <Field label="نوع الإجازة">
              <View style={{ padding: 12, backgroundColor: theme.colors.brandTertiary, borderRadius: theme.radius.md }}>
                <Text style={{ color: theme.colors.onBrandTertiary, textAlign: "right", fontWeight: "700" }}>إجازة سنوية</Text>
              </View>
            </Field>
            <Field label="تاريخ البدء"><TextInput style={inputStyle} value={form.start_date} onChangeText={(t) => setForm({ ...form, start_date: t })} placeholder="YYYY-MM-DD" /></Field>
            <Field label="تاريخ الانتهاء"><TextInput style={inputStyle} value={form.end_date} onChangeText={(t) => setForm({ ...form, end_date: t })} placeholder="YYYY-MM-DD" /></Field>
            <Field label="السبب"><TextInput style={[inputStyle, { minHeight: 60 }]} value={form.reason} onChangeText={(t) => setForm({ ...form, reason: t })} multiline /></Field>
            <Field label="الحالة">
              <View style={{ flexDirection: "row-reverse", gap: 6 }}>
                {[{ v: "approved", l: "معتمدة" }, { v: "pending", l: "قيد المراجعة" }, { v: "rejected", l: "مرفوضة" }].map(s => (
                  <Pressable key={s.v} onPress={() => setForm({ ...form, status: s.v })} style={[styles.pill, form.status === s.v && styles.pillActive]}>
                    <Text style={[styles.pillText, form.status === s.v && { color: "#fff" }]}>{s.l}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
          </>
        )}
        {tab === "maintenance" && (
          <>
            <Field label="السيارة *"><SearchPicker label="ابحث عن سيارة" items={vehicleItems} value={form.vehicle_id} onChange={(v) => setForm({ ...form, vehicle_id: v })} allowClear={false} testID="maint-vehicle-picker" /></Field>
            <Field label="الموظف المسؤول"><SearchPicker label="ابحث عن موظف" items={employeeItems} value={form.employee_id} onChange={(v) => setForm({ ...form, employee_id: v })} testID="maint-employee-picker" /></Field>
            <Field label="نوع الصيانة *"><TextInput style={inputStyle} value={form.maintenance_type} onChangeText={(t) => setForm({ ...form, maintenance_type: t })} placeholder="مثال: تغيير زيت" /></Field>
            <Field label="الوصف"><TextInput style={inputStyle} value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} /></Field>
            <Field label="التكلفة (ر.س)"><TextInput style={inputStyle} value={form.cost} onChangeText={(t) => setForm({ ...form, cost: t })} keyboardType="numeric" /></Field>
            <Field label="التاريخ"><TextInput style={inputStyle} value={form.date} onChangeText={(t) => setForm({ ...form, date: t })} placeholder="YYYY-MM-DD" /></Field>
            <Field label="الحالة">
              <View style={{ flexDirection: "row-reverse", gap: 6 }}>
                {[{ v: "completed", l: "منجزة" }, { v: "pending", l: "قيد الإصلاح" }, { v: "upcoming", l: "قادمة" }].map(s => (
                  <Pressable key={s.v} onPress={() => setForm({ ...form, status: s.v })} style={[styles.pill, form.status === s.v && styles.pillActive]}>
                    <Text style={[styles.pillText, form.status === s.v && { color: "#fff" }]}>{s.l}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field label="تاريخ الصيانة القادمة"><TextInput style={inputStyle} value={form.next_due_date || ""} onChangeText={(t) => setForm({ ...form, next_due_date: t })} placeholder="YYYY-MM-DD (اختياري)" /></Field>
          </>
        )}
        {tab === "fuel" && (
          <>
            <Field label="السيارة *"><SearchPicker label="ابحث عن سيارة" items={vehicleItems} value={form.vehicle_id} onChange={(v) => setForm({ ...form, vehicle_id: v })} allowClear={false} testID="fuel-vehicle-picker" /></Field>
            <Field label="السائق"><SearchPicker label="ابحث عن موظف" items={employeeItems} value={form.employee_id} onChange={(v) => setForm({ ...form, employee_id: v })} testID="fuel-employee-picker" /></Field>
            <Field label="التاريخ"><TextInput style={inputStyle} value={form.date} onChangeText={(t) => setForm({ ...form, date: t })} placeholder="YYYY-MM-DD" /></Field>
            <Field label="التكلفة (ر.س)"><TextInput style={inputStyle} value={form.cost} onChangeText={(t) => setForm({ ...form, cost: t })} keyboardType="numeric" /></Field>
            <Field label="قراءة العداد قبل"><TextInput style={inputStyle} value={form.odometer_before} onChangeText={(t) => setForm({ ...form, odometer_before: t })} keyboardType="numeric" placeholder="كم" /></Field>
            <Field label="قراءة العداد بعد"><TextInput style={inputStyle} value={form.odometer_after} onChangeText={(t) => setForm({ ...form, odometer_after: t })} keyboardType="numeric" placeholder="كم" /></Field>
            <Field label="صورة العداد قبل التعبئة"><PhotoField uri={form.photo_before} onPick={() => chooseImage((d) => setForm({ ...form, photo_before: d }))} onClear={() => setForm({ ...form, photo_before: "" })} /></Field>
            <Field label="صورة العداد بعد التعبئة"><PhotoField uri={form.photo_after} onPick={() => chooseImage((d) => setForm({ ...form, photo_after: d }))} onClear={() => setForm({ ...form, photo_after: "" })} /></Field>
            <Field label="ملاحظات"><TextInput style={[inputStyle, { minHeight: 60 }]} value={form.notes} onChangeText={(t) => setForm({ ...form, notes: t })} multiline /></Field>
          </>
        )}
        {tab === "accidents" && (
          <>
            <Field label="السيارة *"><SearchPicker label="ابحث عن سيارة" items={vehicleItems} value={form.vehicle_id} onChange={(v) => setForm({ ...form, vehicle_id: v })} allowClear={false} testID="acc-vehicle-picker" /></Field>
            <Field label="السائق"><SearchPicker label="ابحث عن موظف" items={employeeItems} value={form.employee_id} onChange={(v) => setForm({ ...form, employee_id: v })} testID="acc-employee-picker" /></Field>
            <Field label="الوصف *"><TextInput style={[inputStyle, { minHeight: 60 }]} value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} multiline placeholder="وصف الحادث" /></Field>
            <Field label="التاريخ"><TextInput style={inputStyle} value={form.date} onChangeText={(t) => setForm({ ...form, date: t })} placeholder="YYYY-MM-DD" /></Field>
            <Field label="الموقع"><TextInput style={inputStyle} value={form.location} onChangeText={(t) => setForm({ ...form, location: t })} /></Field>
            <Field label="نسبة الخطأ (%)"><TextInput style={inputStyle} value={form.fault_percentage} onChangeText={(t) => setForm({ ...form, fault_percentage: t })} keyboardType="numeric" placeholder="0-100" /></Field>
            <Field label="التكلفة (ر.س)"><TextInput style={inputStyle} value={form.cost} onChangeText={(t) => setForm({ ...form, cost: t })} keyboardType="numeric" /></Field>
            <Field label="الحالة">
              <View style={{ flexDirection: "row-reverse", gap: 6 }}>
                {[{ v: "open", l: "مفتوحة" }, { v: "closed", l: "مغلقة" }].map(s => (
                  <Pressable key={s.v} onPress={() => setForm({ ...form, status: s.v })} style={[styles.pill, form.status === s.v && styles.pillActive]}>
                    <Text style={[styles.pillText, form.status === s.v && { color: "#fff" }]}>{s.l}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field label="صور الحادث"><PhotoListField photos={form.photos || []} onAdd={() => chooseImage((d) => setForm({ ...form, photos: [...(form.photos || []), d] }))} onRemove={(idx: number) => setForm({ ...form, photos: (form.photos || []).filter((_: any, i: number) => i !== idx) })} /></Field>
            <Field label="ملاحظات"><TextInput style={[inputStyle, { minHeight: 60 }]} value={form.notes} onChangeText={(t) => setForm({ ...form, notes: t })} multiline /></Field>
          </>
        )}
        {tab === "violations" && (
          <>
            <Field label="السيارة *"><SearchPicker label="ابحث عن سيارة" items={vehicleItems} value={form.vehicle_id} onChange={(v) => setForm({ ...form, vehicle_id: v })} allowClear={false} testID="vio-vehicle-picker" /></Field>
            <Field label="الموظف *"><SearchPicker label="ابحث عن موظف" items={employeeItems} value={form.employee_id} onChange={(v) => setForm({ ...form, employee_id: v })} testID="vio-employee-picker" /></Field>
            <Field label="نوع المخالفة *"><TextInput style={inputStyle} value={form.violation_type} onChangeText={(t) => setForm({ ...form, violation_type: t })} placeholder="مثال: تجاوز السرعة" /></Field>
            <Field label="المبلغ (ر.س) *"><TextInput style={inputStyle} value={form.amount} onChangeText={(t) => setForm({ ...form, amount: t })} keyboardType="numeric" /></Field>
            <Field label="التاريخ"><TextInput style={inputStyle} value={form.date} onChangeText={(t) => setForm({ ...form, date: t })} placeholder="YYYY-MM-DD" /></Field>
            <Field label="الموقع"><TextInput style={inputStyle} value={form.location} onChangeText={(t) => setForm({ ...form, location: t })} /></Field>
            <Field label="الحالة">
              <View style={{ flexDirection: "row-reverse", gap: 6 }}>
                {[{ v: "unpaid", l: "غير مسددة" }, { v: "paid", l: "مسددة" }].map(s => (
                  <Pressable key={s.v} onPress={() => setForm({ ...form, status: s.v })} style={[styles.pill, form.status === s.v && styles.pillActive]}>
                    <Text style={[styles.pillText, form.status === s.v && { color: "#fff" }]}>{s.l}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field label="صورة المخالفة"><PhotoField uri={form.photo} onPick={() => chooseImage((d) => setForm({ ...form, photo: d }))} onClear={() => setForm({ ...form, photo: "" })} /></Field>
            <Field label="ملاحظات"><TextInput style={[inputStyle, { minHeight: 60 }]} value={form.notes} onChangeText={(t) => setForm({ ...form, notes: t })} multiline /></Field>
          </>
        )}
      </FormSheet>
    </SafeAreaView>
  );
}

const PhotoField = ({ uri, onPick, onClear }: any) => (
  uri ? (
    <View>
      <Pressable onPress={onPick}><ExpoImage source={{ uri }} style={{ width: "100%", height: 140, borderRadius: theme.radius.md }} /></Pressable>
      <Pressable onPress={onClear} style={{ marginTop: 4, alignSelf: "flex-end" }}><Text style={{ color: theme.colors.error, fontSize: 12 }}>حذف الصورة</Text></Pressable>
    </View>
  ) : (
    <Pressable onPress={onPick} style={{ height: 100, borderWidth: 1, borderStyle: "dashed", borderColor: theme.colors.border, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center", gap: 6 }}>
      <Ionicons name="camera" size={24} color={theme.colors.onSurfaceTertiary} />
      <Text style={{ color: theme.colors.onSurfaceTertiary, fontSize: 13 }}>إضافة صورة</Text>
    </Pressable>
  )
);

const PhotoListField = ({ photos, onAdd, onRemove }: any) => (
  <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
    {photos.map((p: string, i: number) => (
      <View key={i} style={{ position: "relative" }}>
        <ExpoImage source={{ uri: p }} style={{ width: 80, height: 80, borderRadius: theme.radius.md }} />
        <Pressable onPress={() => onRemove(i)} style={{ position: "absolute", top: -6, left: -6, backgroundColor: theme.colors.error, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="close" size={14} color="#fff" />
        </Pressable>
      </View>
    ))}
    <Pressable onPress={onAdd} style={{ width: 80, height: 80, borderWidth: 1, borderStyle: "dashed", borderColor: theme.colors.border, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="add" size={24} color={theme.colors.onSurfaceTertiary} />
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: theme.spacing.lg },
  title: { fontSize: 22, fontWeight: "700", color: theme.colors.onSurface },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  chipRowWrap: { height: 56, justifyContent: "center" },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0, flexDirection: "row-reverse", gap: 6 },
  chipActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  chipText: { fontSize: 12, color: theme.colors.onSurfaceSecondary, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  searchRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: theme.colors.onSurface, writingDirection: "rtl" },
  card: { flexDirection: "row-reverse", alignItems: "flex-start", gap: theme.spacing.md, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border },
  cardCol: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border },
  contactRow: { flexDirection: "row-reverse", gap: 8, marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.divider },
  contactBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: theme.radius.md },
  contactText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  iconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  subtle: { fontSize: 12, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
  badgeText: { fontSize: 11, fontWeight: "700" },
  miniBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brandTertiary },
  miniBadgeText: { fontSize: 10, fontWeight: "700", color: theme.colors.onBrandTertiary },
  countCol: { alignItems: "center" },
  count: { fontSize: 16, fontWeight: "700", color: theme.colors.brandPrimary },
  countLbl: { fontSize: 10, color: theme.colors.onSurfaceTertiary },
  cost: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: theme.colors.onSurfaceTertiary },
  addBigBtn: { marginTop: theme.spacing.md, backgroundColor: theme.colors.brandPrimary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: theme.radius.pill },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  pillActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  pillText: { fontSize: 13, color: theme.colors.onSurface, fontWeight: "600" },
});
