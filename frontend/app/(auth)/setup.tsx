import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { theme } from "@/src/theme";

export default function SetupScreen() {
  const { adminSetup } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    setError(null);
    if (!name || !phone || !password) return setError("يرجى ملء جميع الحقول");
    if (password.length < 6) return setError("كلمة المرور يجب ألا تقل عن 6 أحرف");
    setLoading(true);
    try {
      await adminSetup(name.trim(), phone.trim(), password);
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      setError(e.message || "فشل الإعداد");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root} testID="setup-screen">
      <LinearGradient colors={[theme.colors.brandPrimary, "#25341C"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroInner}>
            <View style={styles.logoCircle}><Ionicons name="settings" size={36} color="#fff" /></View>
            <Text style={styles.appName}>إعداد حساب المدير</Text>
            <Text style={styles.tagline}>هذا الإعداد لمرة واحدة فقط</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {error && (<View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>)}
          <Text style={styles.label}>الاسم الكامل</Text>
          <TextInput testID="setup-name-input" style={styles.input} value={name} onChangeText={setName} textAlign="right" />
          <Text style={styles.label}>رقم الجوال</Text>
          <TextInput testID="setup-phone-input" style={styles.input} value={phone} onChangeText={setPhone} placeholder="05xxxxxxxx" keyboardType="phone-pad" textAlign="right" />
          <Text style={styles.label}>كلمة المرور</Text>
          <TextInput testID="setup-password-input" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="6 أحرف على الأقل" textAlign="right" />

          <Pressable testID="setup-submit-button" style={styles.submitBtn} onPress={handle} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>بدء التطبيق</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  hero: { paddingBottom: theme.spacing.xl },
  heroInner: { alignItems: "center", paddingTop: theme.spacing.lg, paddingHorizontal: theme.spacing.lg },
  logoCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: theme.spacing.md },
  appName: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 4 },
  tagline: { fontSize: 12, color: "rgba(255,255,255,0.85)" },
  form: { padding: theme.spacing.xl },
  label: { fontSize: 13, color: theme.colors.onSurfaceSecondary, marginBottom: 6, textAlign: "right", fontWeight: "600" },
  input: { backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: 14, fontSize: 15, marginBottom: theme.spacing.md, color: theme.colors.onSurface, writingDirection: "rtl" },
  submitBtn: { backgroundColor: theme.colors.brandPrimary, borderRadius: theme.radius.md, paddingVertical: 16, alignItems: "center", marginTop: theme.spacing.md },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  errorBox: { backgroundColor: "#FDECE5", borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  errorText: { color: theme.colors.error, textAlign: "right", fontSize: 13 },
});
