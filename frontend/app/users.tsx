import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, Stack, useRouter } from "expo-router";
import { api } from "@/src/api";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/auth";

const ROLE_LABEL: any = {
  admin: "مدير عمليات",
  supervisor: "مشرف أمن",
  guard: "رجل أمن",
};
const STATUS_LABEL: any = {
  pending: { label: "بانتظار الموافقة", color: theme.colors.warning },
  approved: { label: "معتمد", color: theme.colors.success },
  rejected: { label: "مرفوض", color: theme.colors.error },
};

export default function UsersScreen() {
  const { user: current } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const u = await api.users.list();
      setUsers(u);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const update = async (u: any, patch: any) => {
    try {
      await api.users.update(u.id, patch);
      load();
    } catch (e: any) { Alert.alert("خطأ", e.message); }
  };

  const removeUser = (u: any) => {
    Alert.alert("حذف حساب", `حذف ${u.full_name}؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        try {
          await api.users.delete(u.id);
          load();
        } catch (e: any) { Alert.alert("خطأ", e.message); }
      } },
    ]);
  };

  const askRole = (u: any) => {
    Alert.alert("تغيير الصلاحية", `اختر الصلاحية للحساب ${u.full_name}`, [
      { text: "مدير عمليات", onPress: () => update(u, { role: "admin" }) },
      { text: "مشرف أمن", onPress: () => update(u, { role: "supervisor" }) },
      { text: "رجل أمن", onPress: () => update(u, { role: "guard" }) },
      { text: "إلغاء", style: "cancel" },
    ]);
  };

  const pending = users.filter(u => u.status === "pending");
  const active = users.filter(u => u.status !== "pending");

  return (
    <SafeAreaView style={styles.root} edges={["top"]} testID="users-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-forward" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>إدارة المستخدمين</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 60 }}
          ListHeaderComponent={
            pending.length > 0 ? (
              <View style={styles.alertBox} testID="pending-count">
                <Ionicons name="hourglass" size={20} color={theme.colors.warning} />
                <Text style={styles.alertText}>{pending.length} حساب بانتظار موافقتك</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const st = STATUS_LABEL[item.status] || STATUS_LABEL.approved;
            const isSelf = item.id === current?.id;
            return (
              <View style={styles.card} testID={`user-card-${item.id}`}>
                <View style={styles.row}>
                  <View style={styles.iconBox}><Ionicons name="person-circle" size={32} color={theme.colors.brandPrimary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.full_name} {isSelf ? "(أنت)" : ""}</Text>
                    <Text style={styles.subtle}>{item.email}</Text>
                    <View style={{ flexDirection: "row-reverse", gap: 6, marginTop: 4 }}>
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleText}>{ROLE_LABEL[item.role] || item.role}</Text>
                      </View>
                      <View style={[styles.roleBadge, { backgroundColor: st.color + "20" }]}>
                        <Text style={[styles.roleText, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {item.status === "pending" ? (
                  <View style={styles.actions}>
                    <Pressable testID={`approve-${item.id}`} onPress={() => update(item, { status: "approved" })} style={[styles.actionBtn, { backgroundColor: theme.colors.success }]}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.actionText}>قبول</Text>
                    </Pressable>
                    <Pressable testID={`reject-${item.id}`} onPress={() => update(item, { status: "rejected" })} style={[styles.actionBtn, { backgroundColor: theme.colors.error }]}>
                      <Ionicons name="close" size={16} color="#fff" />
                      <Text style={styles.actionText}>رفض</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.actions}>
                    {!isSelf && (
                      <Pressable testID={`change-role-${item.id}`} onPress={() => askRole(item)} style={[styles.actionBtn, { backgroundColor: theme.colors.brandPrimary }]}>
                        <Ionicons name="shield" size={16} color="#fff" />
                        <Text style={styles.actionText}>تغيير الصلاحية</Text>
                      </Pressable>
                    )}
                    {!isSelf && item.status === "approved" && (
                      <Pressable testID={`revoke-${item.id}`} onPress={() => update(item, { status: "rejected" })} style={[styles.actionBtn, { backgroundColor: theme.colors.warning }]}>
                        <Ionicons name="ban" size={16} color="#fff" />
                        <Text style={styles.actionText}>تعليق</Text>
                      </Pressable>
                    )}
                    {!isSelf && (
                      <Pressable testID={`delete-user-${item.id}`} onPress={() => removeUser(item)} style={[styles.actionBtn, { backgroundColor: theme.colors.error }]}>
                        <Ionicons name="trash" size={16} color="#fff" />
                        <Text style={styles.actionText}>حذف</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: theme.spacing.lg },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.onSurface },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.border },
  alertBox: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: "#FFF8E5", borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.warning },
  alertText: { color: theme.colors.onSurface, fontWeight: "600", textAlign: "right" },
  card: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: theme.spacing.md },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brandTertiary },
  name: { fontSize: 15, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  subtle: { fontSize: 12, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginTop: 2 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brandTertiary },
  roleText: { fontSize: 11, fontWeight: "700", color: theme.colors.onBrandTertiary },
  actions: { flexDirection: "row-reverse", gap: 8, marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.divider },
  actionBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: theme.radius.md },
  actionText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
