import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { theme } from "@/src/theme";

export default function ChangePasswordScreen() {
  const { changePassword, user } = useAuth();
  const router = useRouter();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (pw1.length < 6) return setError("كلمة المرور يجب ألا تقل عن 6 أحرف");
    if (pw1 !== pw2) return setError("كلمتا المرور غير متطابقتين");
    setLoading(true);
    try {
      await changePassword(pw1);
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root} testID="change-password-screen">
      <LinearGradient colors={[theme.colors.brandPrimary, "#25341C"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroInner}>
            <Ionicons name="key" size={48} color="#fff" />
            <Text style={styles.appName}>تغيير كلمة المرور</Text>
            <Text style={styles.tagline}>مرحباً {user?.full_name}، يرجى اختيار كلمة مرور جديدة</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
          <Text style={styles.label}>كلمة المرور الجديدة</Text>
          <TextInput testID="new-password-input" style={styles.input} value={pw1} onChangeText={setPw1} secureTextEntry textAlign="right" />
          <Text style={styles.label}>تأكيد كلمة المرور</Text>
          <TextInput testID="confirm-password-input" style={styles.input} value={pw2} onChangeText={setPw2} secureTextEntry textAlign="right" />
          <Pressable testID="change-password-submit" style={styles.submitBtn} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>حفظ ومتابعة</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  hero: { paddingBottom: theme.spacing.xl },
  heroInner: { alignItems: "center", paddingTop: theme.spacing.lg, paddingHorizontal: theme.spacing.lg, gap: 8 },
  appName: { fontSize: 22, fontWeight: "700", color: "#fff" },
  tagline: { fontSize: 12, color: "rgba(255,255,255,0.85)", textAlign: "center" },
  form: { padding: theme.spacing.xl },
  label: { fontSize: 13, color: theme.colors.onSurfaceSecondary, marginBottom: 6, textAlign: "right", fontWeight: "600" },
  input: { backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: 14, fontSize: 15, marginBottom: theme.spacing.md, color: theme.colors.onSurface, writingDirection: "rtl" },
  submitBtn: { backgroundColor: theme.colors.brandPrimary, borderRadius: theme.radius.md, paddingVertical: 16, alignItems: "center", marginTop: theme.spacing.md },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  errorBox: { backgroundColor: "#FDECE5", borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  errorText: { color: theme.colors.error, textAlign: "right", fontSize: 13 },
});
