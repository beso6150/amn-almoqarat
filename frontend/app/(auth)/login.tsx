import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Link } from "expo-router";
import { useAuth } from "@/src/auth";
import { theme } from "@/src/theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (!phone || !password) {
      setError("يرجى إدخال رقم الجوال وكلمة المرور");
      return;
    }
    setLoading(true);
    try {
      const { mustChange } = await login(phone.trim(), password);
      if (mustChange) router.replace("/(auth)/change-password");
      else router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      setError(e.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root} testID="login-screen">
      <LinearGradient colors={[theme.colors.brandPrimary, "#25341C"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroInner}>
            <View style={styles.logoCircle}>
              <Ionicons name="shield-checkmark" size={40} color={theme.colors.onBrandPrimary} />
            </View>
            <Text style={styles.appName}>ميدان</Text>
            <Text style={styles.tagline}>إدارة العمل الميداني</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>تسجيل الدخول</Text>
          <Text style={styles.subtitle}>ادخل رقم جوالك وكلمة المرور</Text>

          {error && (
            <View style={styles.errorBox} testID="login-error">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>رقم الجوال</Text>
          <TextInput
            testID="login-phone-input"
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="05xxxxxxxx"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            textAlign="right"
          />

          <Text style={styles.label}>كلمة المرور</Text>
          <TextInput
            testID="login-password-input"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#999"
            secureTextEntry
            textAlign="right"
          />

          <Pressable
            testID="login-submit-button"
            style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>دخول</Text>}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>ليس لديك حساب؟</Text>
            <Link href="/(auth)/register" asChild>
              <Pressable testID="go-to-register-link">
                <Text style={styles.link}>طلب حساب جديد</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  hero: { paddingBottom: theme.spacing.xxl },
  heroInner: { alignItems: "center", paddingTop: theme.spacing.xl, paddingHorizontal: theme.spacing.lg },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: theme.spacing.md },
  appName: { fontSize: 32, fontWeight: "700", color: theme.colors.onBrandPrimary, marginBottom: 4 },
  tagline: { fontSize: 14, color: "rgba(255,255,255,0.85)" },
  form: { padding: theme.spacing.xl, paddingTop: theme.spacing.xxl },
  title: { fontSize: 24, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right", marginBottom: 4 },
  subtitle: { fontSize: 14, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginBottom: theme.spacing.xl },
  label: { fontSize: 13, color: theme.colors.onSurfaceSecondary, marginBottom: 6, textAlign: "right", fontWeight: "600" },
  input: { backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: 14, fontSize: 15, marginBottom: theme.spacing.md, color: theme.colors.onSurface, writingDirection: "rtl" },
  submitBtn: { backgroundColor: theme.colors.brandPrimary, borderRadius: theme.radius.md, paddingVertical: 16, alignItems: "center", marginTop: theme.spacing.md },
  submitText: { color: theme.colors.onBrandPrimary, fontSize: 16, fontWeight: "700" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: theme.spacing.xl, gap: 6 },
  footerText: { color: theme.colors.onSurfaceTertiary, fontSize: 14 },
  link: { color: theme.colors.brandPrimary, fontSize: 14, fontWeight: "700" },
  errorBox: { backgroundColor: "#FDECE5", borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  errorText: { color: theme.colors.error, textAlign: "right", fontSize: 13 },
});
