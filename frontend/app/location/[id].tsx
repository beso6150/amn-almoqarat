import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import { theme } from "@/src/theme";
import { openWhatsApp, openDialer } from "@/src/helpers";

export default function LocationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.locationDetails(id as string);
        setData(d);
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={theme.colors.brandPrimary} /></SafeAreaView>;
  if (!data) return <SafeAreaView style={styles.center}><Text>غير موجود</Text></SafeAreaView>;

  const { location: loc, employees, vehicles } = data;

  const groupCounts = ["A", "B", "C", "D"].reduce((acc: any, g) => {
    acc[g] = employees.filter((e: any) => e.group === g).length;
    return acc;
  }, {});

  return (
    <View style={styles.root} testID="location-detail-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={[theme.colors.brandPrimary, "#25341C"]} style={styles.header}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-forward" size={22} color="#fff" />
            </Pressable>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={styles.headerTitle}>{loc.name}</Text>
              <Text style={styles.headerSub}>{loc.address}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}>
        <View style={styles.kpiRow}>
          <View style={styles.kpi}><Text style={styles.kpiV}>{employees.length}</Text><Text style={styles.kpiL}>موظف</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiV}>{vehicles.length}</Text><Text style={styles.kpiL}>سيارة</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiV}>{Object.values(groupCounts).filter((c: any) => c > 0).length}</Text><Text style={styles.kpiL}>مجموعة نشطة</Text></View>
        </View>

        {Object.entries(groupCounts).some(([, c]: any) => c > 0) && (
          <View style={styles.groupsCard}>
            <Text style={styles.sectionTitle}>توزيع المجموعات</Text>
            <View style={{ flexDirection: "row-reverse", gap: 8 }}>
              {["A", "B", "C", "D"].map(g => (
                <View key={g} style={styles.groupPill}>
                  <Text style={styles.groupPillG}>{g}</Text>
                  <Text style={styles.groupPillC}>{groupCounts[g]}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>الموظفون ({employees.length})</Text>
        {employees.length === 0 ? (
          <View style={styles.empty}><Ionicons name="people-outline" size={40} color={theme.colors.onSurfaceTertiary} /><Text style={styles.emptyText}>لا يوجد موظفون</Text></View>
        ) : employees.map((e: any) => (
          <View key={e.id} style={styles.item} testID={`loc-employee-${e.id}`}>
            <View style={styles.iconBox}><Ionicons name="person" size={20} color={theme.colors.brandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{e.name}</Text>
              <Text style={styles.itemSub}>{e.position || "—"}{e.group && e.group !== "none" ? ` • مجموعة ${e.group}` : ""}</Text>
            </View>
            {e.phone && (
              <View style={{ flexDirection: "row-reverse", gap: 6 }}>
                <Pressable testID={`loc-call-${e.id}`} onPress={() => openDialer(e.phone)} style={styles.miniBtn}><Ionicons name="call" size={16} color={theme.colors.brandPrimary} /></Pressable>
                <Pressable testID={`loc-wa-${e.id}`} onPress={() => openWhatsApp(e.phone)} style={styles.miniBtn}><Ionicons name="logo-whatsapp" size={16} color="#25D366" /></Pressable>
              </View>
            )}
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: theme.spacing.lg }]}>السيارات ({vehicles.length})</Text>
        {vehicles.length === 0 ? (
          <View style={styles.empty}><Ionicons name="car-outline" size={40} color={theme.colors.onSurfaceTertiary} /><Text style={styles.emptyText}>لا يوجد سيارات</Text></View>
        ) : vehicles.map((v: any) => (
          <Pressable key={v.id} onPress={() => router.push({ pathname: "/vehicle/[id]", params: { id: v.id } })} style={styles.item} testID={`loc-vehicle-${v.id}`}>
            <View style={styles.iconBox}><Ionicons name="car" size={20} color={theme.colors.brandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{v.plate_number}</Text>
              <Text style={styles.itemSub}>{v.model} {v.year || ""}</Text>
            </View>
            <Ionicons name="chevron-back" size={18} color={theme.colors.onSurfaceTertiary} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface },
  header: { paddingBottom: theme.spacing.lg },
  headerRow: { flexDirection: "row-reverse", alignItems: "center", padding: theme.spacing.md },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff", textAlign: "center" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  kpiRow: { flexDirection: "row-reverse", gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  kpi: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: "center", borderWidth: 1, borderColor: theme.colors.border },
  kpiV: { fontSize: 22, fontWeight: "700", color: theme.colors.brandPrimary },
  kpiL: { fontSize: 12, color: theme.colors.onSurfaceTertiary, marginTop: 2 },
  groupsCard: { backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right", marginBottom: theme.spacing.sm },
  groupPill: { flex: 1, alignItems: "center", padding: 10, backgroundColor: theme.colors.brandTertiary, borderRadius: theme.radius.md },
  groupPillG: { fontSize: 15, fontWeight: "700", color: theme.colors.brandPrimary },
  groupPillC: { fontSize: 11, color: theme.colors.onBrandTertiary, marginTop: 2 },
  item: { flexDirection: "row-reverse", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brandTertiary },
  itemName: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  itemSub: { fontSize: 12, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginTop: 2 },
  miniBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.border },
  empty: { alignItems: "center", padding: 30, gap: 8 },
  emptyText: { color: theme.colors.onSurfaceTertiary, fontSize: 13 },
});
