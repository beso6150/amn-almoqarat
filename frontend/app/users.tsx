import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { openWhatsApp } from "@/src/helpers";

type UserRole = "admin" | "supervisor" | "guard";

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "مدير عمليات",
  supervisor: "مشرف أمن",
  guard: "رجل أمن",
};

const ROLE_OPTIONS: Array<{
  value: UserRole;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
    {
      value: "admin",
      label: "مدير عمليات",
      description: "صلاحية كاملة لإدارة المستخدمين والبيانات.",
      icon: "shield-checkmark",
    },
    {
      value: "supervisor",
      label: "مشرف أمن",
      description: "متابعة فرق الأمن والعمليات.",
      icon: "people",
    },
    {
      value: "guard",
      label: "رجل أمن",
      description: "استخدام الوظائف الميدانية المسموحة.",
      icon: "person",
    },
  ];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: "بانتظار الموافقة", color: theme.colors.warning },
  approved: { label: "معتمد", color: theme.colors.success },
  rejected: { label: "مرفوض", color: theme.colors.error },
};

export default function UsersScreen() {
  const { user: current } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [credModal, setCredModal] = useState<{
    phone: string;
    password: string;
    name: string;
    message: string;
  } | null>(null);

  const [roleUser, setRoleUser] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>("guard");
  const [savingRole, setSavingRole] = useState(false);

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const load = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      const result = await api.users.list();
      setUsers(Array.isArray(result) ? result : []);
    } catch (e: any) {
      showMessage(
        "خطأ",
        e?.response?.data?.detail || e?.message || "تعذر تحميل المستخدمين"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const approve = async (u: any) => {
    if (!u?.id || processingId) return;
    try {
      setProcessingId(u.id);
      const res = await api.users.approve(u.id);
      const info = await api.users.notifyMessage({
        temp_password: res.temp_password,
        phone: res.phone,
        full_name: res.full_name,
      });
      setCredModal({
        phone: info.phone,
        password: res.temp_password,
        name: res.full_name,
        message: info.message,
      });
      await load(true);
    } catch (e: any) {
      showMessage("خطأ", e?.response?.data?.detail || e?.message || "تعذر اعتماد المستخدم");
    } finally {
      setProcessingId(null);
    }
  };

  const updateUser = async (u: any, patch: any) => {
    if (!u?.id || processingId) return;
    try {
      setProcessingId(u.id);
      await api.users.update(u.id, patch);
      await load(true);
    } catch (e: any) {
      showMessage("خطأ", e?.response?.data?.detail || e?.message || "تعذر تحديث المستخدم");
    } finally {
      setProcessingId(null);
    }
  };

  const openRoleModal = (u: any) => {
    if (!u || u.id === current?.id) return;
    const role: UserRole =
      u.role === "admin" || u.role === "supervisor" || u.role === "guard"
        ? u.role
        : "guard";
    setRoleUser(u);
    setSelectedRole(role);
  };

  const closeRoleModal = () => {
    if (!savingRole) setRoleUser(null);
  };

  const saveRole = async () => {
    if (!roleUser?.id || savingRole) return;
    if (selectedRole === roleUser.role) {
      setRoleUser(null);
      return;
    }

    try {
      setSavingRole(true);
      await api.users.update(roleUser.id, { role: selectedRole });
      const name = roleUser.full_name;
      setRoleUser(null);
      await load(true);
      showMessage(
        "تم تغيير الصلاحية",
        `تم تغيير صلاحية ${name} إلى ${ROLE_LABEL[selectedRole]}.\n\nيجب على المستخدم تسجيل الخروج ثم الدخول من جديد.`
      );
    } catch (e: any) {
      showMessage(
        "تعذر تغيير الصلاحية",
        e?.response?.data?.detail || e?.message || "تأكد من اتصال التطبيق بالخادم"
      );
    } finally {
      setSavingRole(false);
    }
  };

  const resetPassword = (u: any) => {
    const execute = async () => {
      try {
        setProcessingId(u.id);
        const res = await api.users.resetPassword(u.id);
        const info = await api.users.notifyMessage({
          temp_password: res.temp_password,
          phone: res.phone,
          full_name: res.full_name,
        });
        setCredModal({
          phone: info.phone,
          password: res.temp_password,
          name: res.full_name,
          message: info.message,
        });
        await load(true);
      } catch (e: any) {
        showMessage("خطأ", e?.response?.data?.detail || e?.message || "تعذر إنشاء كلمة المرور");
      } finally {
        setProcessingId(null);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`توليد كلمة مرور جديدة لـ ${u.full_name}؟`)) void execute();
      return;
    }

    Alert.alert("إعادة تعيين كلمة المرور", `توليد كلمة مرور جديدة لـ ${u.full_name}؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "متابعة", onPress: () => void execute() },
    ]);
  };

  const removeUser = (u: any) => {
    const execute = async () => {
      try {
        setProcessingId(u.id);
        await api.users.delete(u.id);
        await load(true);
      } catch (e: any) {
        showMessage("خطأ", e?.response?.data?.detail || e?.message || "تعذر حذف المستخدم");
      } finally {
        setProcessingId(null);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`حذف حساب ${u.full_name}؟`)) void execute();
      return;
    }

    Alert.alert("حذف حساب", `حذف ${u.full_name}؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => void execute() },
    ]);
  };

  const pending = users.filter((u) => u.status === "pending");

  return (
    <SafeAreaView style={styles.root} edges={["top"]} testID="users-screen">
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-forward" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>إدارة المستخدمين</Text>
        <Pressable onPress={() => void load(true)} style={styles.iconBtn}>
          {refreshing ? (
            <ActivityIndicator size="small" color={theme.colors.brandPrimary} />
          ) : (
            <Ionicons name="refresh" size={20} color={theme.colors.onSurface} />
          )}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 60 }}
          ListHeaderComponent={
            pending.length > 0 ? (
              <View style={styles.alertBox}>
                <Ionicons name="hourglass" size={20} color={theme.colors.warning} />
                <Text style={styles.alertText}>{pending.length} حساب بانتظار موافقتك</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const status = STATUS_LABEL[item.status] || STATUS_LABEL.approved;
            const isSelf = item.id === current?.id;
            const busy = processingId === item.id;

            return (
              <View style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.iconBox}>
                    <Ionicons name="person-circle" size={32} color={theme.colors.brandPrimary} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>
                      {item.full_name} {isSelf ? "(أنت)" : ""}
                    </Text>
                    <Text style={styles.subtle}>{item.phone}</Text>

                    <View style={styles.badgesRow}>
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleText}>
                          {ROLE_LABEL[item.role as UserRole] || item.role}
                        </Text>
                      </View>

                      <View style={[styles.roleBadge, { backgroundColor: status.color + "20" }]}>
                        <Text style={[styles.roleText, { color: status.color }]}>
                          {status.label}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {item.status === "pending" ? (
                  <View style={styles.actions}>
                    <Pressable
                      disabled={busy}
                      onPress={() => void approve(item)}
                      style={[styles.actionBtn, { backgroundColor: theme.colors.success }, busy && styles.disabled]}
                    >
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.actionText}>قبول وإرسال كلمة المرور</Text>
                    </Pressable>

                    <Pressable
                      disabled={busy}
                      onPress={() => void updateUser(item, { status: "rejected" })}
                      style={[styles.actionBtn, { backgroundColor: theme.colors.error }, busy && styles.disabled]}
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                      <Text style={styles.actionText}>رفض</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.actions}>
                    {!isSelf && (
                      <Pressable
                        disabled={busy}
                        onPress={() => openRoleModal(item)}
                        style={[styles.actionBtn, { backgroundColor: theme.colors.brandPrimary }, busy && styles.disabled]}
                      >
                        <Ionicons name="shield" size={14} color="#fff" />
                        <Text style={styles.actionText}>الصلاحية</Text>
                      </Pressable>
                    )}

                    <Pressable
                      disabled={busy}
                      onPress={() => resetPassword(item)}
                      style={[styles.actionBtn, { backgroundColor: theme.colors.brandSecondary }, busy && styles.disabled]}
                    >
                      <Ionicons name="key" size={14} color="#fff" />
                      <Text style={styles.actionText}>كلمة مرور جديدة</Text>
                    </Pressable>

                    {!isSelf && (
                      <Pressable
                        disabled={busy}
                        onPress={() => removeUser(item)}
                        style={[styles.actionBtn, { backgroundColor: theme.colors.error }, busy && styles.disabled]}
                      >
                        <Ionicons name="trash" size={14} color="#fff" />
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

      <Modal visible={!!roleUser} transparent animationType="fade" onRequestClose={closeRoleModal}>
        <View style={styles.centerOverlay}>
          <View style={styles.roleModal}>
            <View style={styles.modalHeader}>
              <Ionicons name="shield-checkmark" size={22} color={theme.colors.brandPrimary} />
              <Text style={styles.modalTitle}>تغيير الصلاحية</Text>
              <Pressable onPress={closeRoleModal} disabled={savingRole}>
                <Ionicons name="close" size={22} color={theme.colors.onSurface} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.roleContent}>
              <Text style={styles.modalLabel}>المستخدم</Text>
              <Text style={styles.roleUserName}>{roleUser?.full_name}</Text>
              <Text style={styles.roleHint}>اختر الصلاحية الجديدة ثم اضغط حفظ.</Text>

              {ROLE_OPTIONS.map((role) => {
                const selected = selectedRole === role.value;
                return (
                  <Pressable
                    key={role.value}
                    onPress={() => setSelectedRole(role.value)}
                    style={[styles.roleOption, selected && styles.roleOptionSelected]}
                  >
                    <View style={[styles.roleIcon, selected && styles.roleIconSelected]}>
                      <Ionicons
                        name={role.icon}
                        size={21}
                        color={selected ? "#fff" : theme.colors.brandPrimary}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.roleOptionTitle}>{role.label}</Text>
                      <Text style={styles.roleOptionDescription}>{role.description}</Text>
                    </View>

                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={22}
                      color={selected ? theme.colors.brandPrimary : theme.colors.onSurfaceTertiary}
                    />
                  </Pressable>
                );
              })}

              <Pressable
                disabled={savingRole}
                onPress={() => void saveRole()}
                style={[styles.saveButton, savingRole && styles.disabled]}
              >
                {savingRole ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="save" size={18} color="#fff" />
                )}
                <Text style={styles.saveButtonText}>
                  {savingRole ? "جارٍ الحفظ..." : "حفظ الصلاحية"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!credModal}
        animationType="slide"
        transparent
        onRequestClose={() => setCredModal(null)}
      >
        <View style={styles.bottomOverlay}>
          <View style={styles.credentialModal}>
            <View style={styles.modalHeader}>
              <Ionicons name="key" size={22} color={theme.colors.success} />
              <Text style={styles.modalTitle}>كلمة مرور جديدة</Text>
              <Pressable onPress={() => setCredModal(null)}>
                <Ionicons name="close" size={22} color={theme.colors.onSurface} />
              </Pressable>
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

              <Text style={styles.warn}>
                يجب على المستخدم تغيير كلمة المرور فور تسجيل الدخول
              </Text>

              <Pressable
                onPress={() => {
                  if (!credModal) return;
                  openWhatsApp(credModal.phone, credModal.message);
                  setCredModal(null);
                }}
                style={styles.waBtn}
              >
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <Text style={styles.waText}>إرسال عبر واتساب</Text>
              </Pressable>

              <Pressable onPress={() => setCredModal(null)} style={styles.laterBtn}>
                <Text style={styles.laterText}>لاحقًا</Text>
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
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.onSurface },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  alertBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF8E5",
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  alertText: { flex: 1, color: theme.colors.onSurface, fontWeight: "600", textAlign: "right" },
  card: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: theme.spacing.md },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.brandTertiary,
  },
  name: { fontSize: 15, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right" },
  subtle: { fontSize: 12, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginTop: 2 },
  badgesRow: { flexDirection: "row-reverse", gap: 6, marginTop: 4, flexWrap: "wrap" },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brandTertiary,
  },
  roleText: { fontSize: 11, fontWeight: "700", color: theme.colors.onBrandTertiary },
  actions: {
    flexDirection: "row-reverse",
    gap: 6,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    flexWrap: "wrap",
  },
  actionBtn: {
    flex: 1,
    minWidth: "30%",
    minHeight: 40,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
  },
  actionText: { color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center" },
  disabled: { opacity: 0.55 },
  centerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.md,
  },
  bottomOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  roleModal: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "88%",
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  credentialModal: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: theme.colors.onSurface,
    textAlign: "right",
    marginRight: 8,
  },
  roleContent: { padding: theme.spacing.lg },
  modalLabel: { fontSize: 12, color: theme.colors.onSurfaceTertiary, marginBottom: 4, textAlign: "right" },
  modalValue: { fontSize: 15, color: theme.colors.onSurface, textAlign: "right", marginBottom: 14, fontWeight: "600" },
  roleUserName: { fontSize: 18, fontWeight: "800", color: theme.colors.onSurface, textAlign: "right" },
  roleHint: {
    marginTop: 5,
    marginBottom: theme.spacing.md,
    fontSize: 12,
    color: theme.colors.onSurfaceSecondary,
    textAlign: "right",
  },
  roleOption: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: theme.spacing.md,
    marginBottom: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  roleOptionSelected: {
    backgroundColor: theme.colors.brandTertiary,
    borderColor: theme.colors.brandPrimary,
  },
  roleIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.brandTertiary,
  },
  roleIconSelected: { backgroundColor: theme.colors.brandPrimary },
  roleOptionTitle: { fontSize: 14, fontWeight: "800", color: theme.colors.onSurface, textAlign: "right" },
  roleOptionDescription: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 17,
    color: theme.colors.onSurfaceTertiary,
    textAlign: "right",
  },
  saveButton: {
    minHeight: 48,
    marginTop: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brandPrimary,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  passwordBox: {
    backgroundColor: theme.colors.brandTertiary,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: "center",
  },
  passwordText: {
    fontSize: 32,
    fontWeight: "700",
    color: theme.colors.brandPrimary,
    letterSpacing: 4,
    fontFamily: "monospace",
  },
  warn: {
    fontSize: 12,
    color: theme.colors.warning,
    textAlign: "center",
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  waBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#25D366",
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    marginTop: 8,
  },
  waText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  laterBtn: { alignItems: "center", paddingVertical: 12, marginTop: 4 },
  laterText: { color: theme.colors.onSurfaceTertiary, fontSize: 13 },
});