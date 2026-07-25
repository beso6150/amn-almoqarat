import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { api } from "@/src/api";
import { theme } from "@/src/theme";

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const GROUP_COLORS: any = {
  A: theme.colors.brandPrimary,
  B: "#2A3D2D",
  C: theme.colors.brandSecondary,
  D: "#8A3E20",
};

export default function ScheduleScreen() {
  const router = useRouter();
  const [days, setDays] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [d, e] = await Promise.all([api.scheduleWeek(), api.employees.list()]);
        setDays(d); setEmployees(e);
      } catch { }
      setLoading(false);
    })();
  }, []);

  const groupCounts = ["A", "B", "C", "D"].reduce((acc: any, g) => {
    acc[g] = employees.filter(e => e.group === g).length;
    return acc;
  }, {});
  const supervisorByGroup = ["A", "B", "C", "D"].reduce((acc: any, g) => {
    acc[g] = employees.find(e => e.group === g && e.position === "مشرف أمن");
    return acc;
  }, {});

  return (
    <View style={styles.root} testID="schedule-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={[theme.colors.brandPrimary, "#25341C"]} style={styles.header}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-forward" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.headerTitle}>جدول المناوبات</Text>
            <View style={{ width: 40 }} />
          </View>
          <Text style={styles.subtitle}>دورة 8 أيام على مدار السنة (AB → CD)</Text>
          <Text style={styles.subtitleSmall}>البداية: الخميس 16/7/2026</Text>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}>
          <View style={styles.groupsGrid}>
            {["A", "B", "C", "D"].map(g => (
              <View key={g} style={[styles.groupCard, { borderRightColor: GROUP_COLORS[g], borderRightWidth: 4 }]}>
                <Text style={styles.groupTitle}>مجموعة {g}</Text>
                <Text style={styles.groupHours}>{g === "A" || g === "C" ? "06:00 - 18:00" : "18:00 - 06:00"}</Text>
                <Text style={styles.groupCount}>{groupCounts[g]} أفراد</Text>
                {supervisorByGroup[g] ? <Text style={styles.groupSup}>المشرف: {supervisorByGroup[g].name}</Text> : <Text style={styles.groupSupEmpty}>لا يوجد مشرف</Text>}
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>الجدول القادم (14 يوم)</Text>
          {days.map((d, i) => {
            const dateObj = new Date(d.date);
            const dayName = DAY_NAMES[dateObj.getDay()];
            const isToday = i === 0;
            return (
              <View key={d.date} style={[styles.dayRow, isToday && { borderColor: theme.colors.brandPrimary, borderWidth: 2 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayName}>{dayName} {isToday && "(اليوم)"}</Text>
                  <Text style={styles.dayDate}>{d.date}</Text>
                </View>
                <View style={styles.shifts}>
                  <View style={[styles.shiftPill, { backgroundColor: GROUP_COLORS[d.day] + "20" }]}>
                    <Ionicons name="sunny" size={12} color={GROUP_COLORS[d.day]} />
                    <Text style={[styles.shiftText, { color: GROUP_COLORS[d.day] }]}>{d.day}</Text>
                  </View>
                  <View style={[styles.shiftPill, { backgroundColor: GROUP_COLORS[d.night] + "20" }]}>
                    <Ionicons name="moon" size={12} color={GROUP_COLORS[d.night]} />
                    <Text style={[styles.shiftText, { color: GROUP_COLORS[d.night] }]}>{d.night}</Text>
                  </View>
                </View>
              </View>
            );
          })}

          <View style={styles.legend}>
            <Text style={styles.legendTitle}></Text>
            <Text style={styles.legendText}> </Text>
            <Text style={styles.legendText}> </Text>
            <Text style={styles.legendText}>  </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  header: { paddingBottom: theme.spacing.lg },
  headerRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: theme.spacing.md },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#fff" },
  subtitle: { color: "rgba(255,255,255,0.9)", textAlign: "center", fontSize: 13 },
  subtitleSmall: { color: "rgba(255,255,255,0.7)", textAlign: "center", fontSize: 11, marginTop: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  groupsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  groupCard: { width: "48%", backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  groupTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  groupHours: { fontSize: 11, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginTop: 4 },
  groupCount: { fontSize: 12, color: theme.colors.brandPrimary, textAlign: "right", marginTop: 6, fontWeight: "700" },
  groupSup: { fontSize: 11, color: theme.colors.onSurfaceSecondary, textAlign: "right", marginTop: 4 },
  groupSupEmpty: { fontSize: 11, color: theme.colors.warning, textAlign: "right", marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right", marginBottom: theme.spacing.sm },
  dayRow: { flexDirection: "row-reverse", alignItems: "center", backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border },
  dayName: { fontSize: 14, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  dayDate: { fontSize: 12, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginTop: 2 },
  shifts: { flexDirection: "row-reverse", gap: 6 },
  shiftPill: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.pill },
  shiftText: { fontSize: 12, fontWeight: "700" },
  legend: { marginTop: theme.spacing.lg, backgroundColor: theme.colors.brandTertiary, padding: theme.spacing.md, borderRadius: theme.radius.md },
  legendTitle: { fontSize: 13, fontWeight: "700", color: theme.colors.onBrandTertiary, textAlign: "right", marginBottom: 6 },
  legendText: { fontSize: 12, color: theme.colors.onBrandTertiary, textAlign: "right", marginTop: 2, lineHeight: 18 },
});
