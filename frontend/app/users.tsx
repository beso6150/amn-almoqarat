import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, Stack, useRouter } from "expo-router";
import { api } from "@/src/api";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { openWhatsApp } from "@/src/helpers";

const ROLE_LABEL: any = { admin: "مدير عمليات", supervisor: "مشرف أمن", guard: "رجل أمن" };
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
  const [credModal, setCredModal] = useState<{ phone: string; password: string; name: string; message: string } | null>(null);

  const load = useCallback(async () => {
    try { setUsers(await api.users.list()); } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const approve = async (u: any) => {
    try {
      const res = await api.users.approve(u.id);
      const info = await api.users.notifyMessage({ temp_password: res.temp_password, phone: res.phone, full_name: res.full_name });
      setCredModal({ phone: info.phone, password: res.temp_password, name: res.full_name, message: info.message });
      load();
    } catch (e: any) { Alert.alert("خطأ", e.message); }
  };

  const resetPassword = async (u: any) => {
    Alert.alert("إعادة تعيين كلمة المرور", `توليد كلمة مرور جديدة لـ ${u.full_name}؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "متابعة", onPress: async () => {
        try {
          const res = await api.users.resetPassword(u.id);
          const info = await api.users.notifyMessage({ temp_password: res.temp_password, phone: res.phone, full_name: res.full_name });
          setCredModal({ phone: info.phone, password: res.temp_password, name: res.full_name, message: info.message });
          load();
        } catch (e: any) { Alert.alert("خطأ", e.message); }
      } },
    ]);
  };

  const update = async (u: any, patch: any) => {
    try { await api.users.update(u.id, patch); load(); }
    catch (e: any) { Alert.alert("خطأ", e.message); }
  };

  const removeUser = (u: any) => {
    Alert.alert("حذف حساب", `حذف ${u.full_name}؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        try { await api.users.delete(u.id); load(); }
        catch (e: any) { Alert.alert("خطأ", e.message); }
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
          ListHeaderComponent={pending.length > 0 ? (
            <View style={styles.alertBox} testID="pending-count">
              <Ionicons name="hourglass" size={20} color={theme.colors.warning} />
              <Text style={styles.alertText}>{pending.length} حساب بانتظار موافقتك</Text>
            </View>
          ) : null}
          renderItem={({ item }) => {
            const st = STATUS_LABEL[item.status] || STATUS_LABEL.approved;
            const isSelf = item.id === current?.id;
            return (
              <View style={styles.card} testID={`user-card-${item.id}`}>
                <View style={styles.row}>
                  <View style={styles.iconBox}><Ionicons name="person-circle" size={32} color={theme.colors.brandPrimary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.full_name} {isSelf ? "(أنت)" : ""}</Text>
                    <Text style={styles.subtle}>{item.phone}</Text>
                    <View style={{ flexDirection: "row-reverse", gap: 6, marginTop: 4 }}>
                      <View style={styles.roleBadge}><Text style={styles.roleText}>{ROLE_LABEL[item.role] || item.role}</Text></View>
                      <View style={[styles.roleBadge, { backgroundColor: st.color + "20" }]}>
                        <Text style={[styles.roleText, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {item.status === "pending" ? (
                  <View style={styles.actions}>
                    <Pressable testID={`approve-${item.id}`} onPress={() => approve(item)} style={[styles.actionBtn, { backgroundColor: theme.colors.success }]}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.actionText}>قبول وإرسال كلمة المرور</Text>
                    </Pressable>
                    <Pressable testID={`reject-${item.id}`} onPress={() => update(item, { status: "rejected" })} style={[styles.actionBtn, { backgroundColor: theme.colors.error }]}>
                      <Ionicons name="close" size={16} color="#fff" />
                      <Text style={styles.actionText}>رفض</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.actions}>
                    {!isSelf && <Pressable testID={`change-role-${item.id}`} onPress={() => askRole(item)} style={[styles.actionBtn, { backgroundColor: theme.colors.brandPrimary }]}><Ionicons name="shield" size={14} color="#fff" /><Text style={styles.actionText}>الصلاحية</Text></Pressable>}
                    <Pressable testID={`reset-pw-${item.id}`} onPress={() => resetPassword(item)} style={[styles.actionBtn, { backgroundColor: theme.colors.brandSecondary }]}><Ionicons name="key" size={14} color="#fff" /><Text style={styles.actionText}>كلمة مرور جديدة</Text></Pressable>
                    {!isSelf && <Pressable testID={`delete-user-${item.id}`} onPress={() => removeUser(item)} style={[styles.actionBtn, { backgroundColor: theme.colors.error }]}><Ionicons name="trash" size={14} color="#fff" /><Text style={styles.actionText}>حذف</Text></Pressable>}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <Modal visible={!!credModal} animationType="slide" transparent onRequestClose={() => setCredModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal} testID="cred-modal">
            <View style={styles.modalHeader}>
              <Ionicons name="key" size={22} color={theme.colors.success} />
              <Text style={styles.modalTitle}>كلمة مرور جديدة</Text>
              <Pressable onPress={() => setCredModal(null)}><Ionicons name="close" size={22} color={theme.colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
              <Text style={styles.modalLabel}>الموظف</Text>
              <Text style={styles.modalValue}>{credModal?.name}</Text>
              <Text style={styles.modalLabel}>رقم الجوال</Text>
              <Text style={styles.modalValue}>{credModal?.phone}</Text>
              <Text style={styles.modalLabel}>كلمة المرور المؤقتة</Text>
              <View style={styles.passwordBox}>
                <Text style={styles.passwordText}>{credModal?.password}</Text>
              </View>
              <Text style={styles.warn}>يجب على المستخدم تغيير كلمة المرور فور تسجيل الدخول</Text>
              <Pressable
                testID="send-wa-otp"
                onPress={() => {
                  if (credModal) {
                    openWhatsApp(credModal.phone, credModal.message);
                    setCredModal(null);
                  }
                }}
                style={styles.waBtn}
              >
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <Text style={styles.waText}>إرسال عبر واتساب</Text>
              </Pressable>
              <Pressable onPress={() => setCredModal(null)} style={styles.laterBtn}>
                <Text style={styles.laterText}>لاحقاً</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  actions: { flexDirection: "row-reverse", gap: 6, marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.divider, flexWrap: "wrap" },
  actionBtn: { flex: 1, minWidth: "30%", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: theme.radius.md },
  actionText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, maxHeight: "80%" },
  modalHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right", marginRight: 8 },
  modalLabel: { fontSize: 12, color: theme.colors.onSurfaceTertiary, marginBottom: 4, textAlign: "right" },
  modalValue: { fontSize: 15, color: theme.colors.onSurface, textAlign: "right", marginBottom: 14, fontWeight: "600" },
  passwordBox: { backgroundColor: theme.colors.brandTertiary, padding: theme.spacing.lg, borderRadius: theme.radius.md, alignItems: "center" },
  passwordText: { fontSize: 32, fontWeight: "700", color: theme.colors.brandPrimary, letterSpacing: 4, fontFamily: "monospace" },
  warn: { fontSize: 12, color: theme.colors.warning, textAlign: "center", marginTop: theme.spacing.md, marginBottom: theme.spacing.md },
  waBtn: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#25D366", paddingVertical: 14, borderRadius: theme.radius.md, marginTop: 8 },
  waText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  laterBtn: { alignItems: "center", paddingVertical: 12, marginTop: 4 },
  laterText: { color: theme.colors.onSurfaceTertiary, fontSize: 13 },
});
