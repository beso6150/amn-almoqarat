import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { theme } from "@/src/theme";

export default function MoreScreen() {
  const router = useRouter();
  const { user, logout, isAdmin } = useAuth();

  const items: any[] = [
    { icon: "calendar", label: "جدول المناوبات", route: "/schedule", color: theme.colors.brandPrimary },
    { icon: "business", label: "المقرات", route: { pathname: "/(tabs)/employees" as const, params: { tab: "locations" } }, color: theme.colors.brandPrimary },
    { icon: "analytics", label: "التقارير", route: "/(tabs)/reports", color: theme.colors.brandSecondary },
    { icon: "key-outline", label: "تغيير كلمة المرور", route: "/(auth)/change-password", color: theme.colors.info },
    { icon: "person-circle", label: "معلومات المطور", route: "/about", color: theme.colors.success },
  ];
  if (isAdmin) {
    items.splice(0, 0, { icon: "people-circle", label: "إدارة المستخدمين", route: "/users", color: theme.colors.brandSecondary });
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]} testID="more-screen">
      <View style={styles.header}>
        <Text style={styles.title}>المزيد</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md }}>
        <View style={styles.profile}>
          <View style={styles.avatar}><Ionicons name="person" size={32} color={theme.colors.brandPrimary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.full_name}</Text>
            <Text style={styles.phone}>{user?.phone}</Text>
            <Text style={styles.role}>{user?.role === "admin" ? "مدير عمليات" : user?.role === "supervisor" ? "مشرف أمن" : "رجل أمن"}</Text>
          </View>
        </View>

        {items.map((it, i) => (
          <Pressable key={i} testID={`more-item-${i}`} onPress={() => router.push(it.route)} style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: it.color + "20" }]}>
              <Ionicons name={it.icon} size={20} color={it.color} />
            </View>
            <Text style={styles.rowLbl}>{it.label}</Text>
            <Ionicons name="chevron-back" size={18} color={theme.colors.onSurfaceTertiary} />
          </Pressable>
        ))}

        <Pressable testID="logout-button" onPress={logout} style={[styles.row, { marginTop: theme.spacing.lg }]}>
          <View style={[styles.rowIcon, { backgroundColor: theme.colors.error + "20" }]}>
            <Ionicons name="log-out" size={20} color={theme.colors.error} />
          </View>
          <Text style={[styles.rowLbl, { color: theme.colors.error }]}>تسجيل الخروج</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  header: { padding: theme.spacing.lg },
  title: { fontSize: 22, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  profile: { flexDirection: "row-reverse", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.lg, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 17, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  phone: { fontSize: 13, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginTop: 2 },
  role: { fontSize: 12, color: theme.colors.brandPrimary, textAlign: "right", marginTop: 2, fontWeight: "600" },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: theme.spacing.md, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  rowLbl: { flex: 1, fontSize: 15, fontWeight: "600", color: theme.colors.onSurface, textAlign: "right" },
});
