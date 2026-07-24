import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Link } from "expo-router";
import { useAuth } from "@/src/auth";
import { theme } from "@/src/theme";

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    setError(null);
    if (!name || !phone) return setError("يرجى ملء جميع الحقول");
    setLoading(true);
    try {
      console.log(name);
      console.log(phone);
      const res = await register(name.trim(), phone.trim());
      if (res.pending) {
        router.replace({ pathname: "/(auth)/pending", params: { message: res.message || "بانتظار موافقة المدير" } });
      }
    } catch (e: any) {
      setError(e.message || "فشل الطلب");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root} testID="register-screen">
      <LinearGradient colors={[theme.colors.brandPrimary, "#25341C"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroInner}>
            <View style={styles.logoCircle}>
              <Ionicons name="person-add" size={36} color={theme.colors.onBrandPrimary} />
            </View>
            <Text style={styles.appName}>طلب حساب جديد</Text>
            <Text style={styles.tagline}>سيرسل لك المدير كلمة المرور عبر واتساب</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {error && (<View style={styles.errorBox} testID="register-error"><Text style={styles.errorText}>{error}</Text></View>)}

          <Text style={styles.label}>الاسم الكامل</Text>
          <TextInput testID="register-name-input" style={styles.input} value={name} onChangeText={setName} placeholder="أدخل اسمك الكامل" placeholderTextColor="#999" textAlign="right" />

          <Text style={styles.label}>رقم الجوال</Text>
          <TextInput testID="register-phone-input" style={styles.input} value={phone} onChangeText={setPhone} placeholder="05xxxxxxxx" placeholderTextColor="#999" keyboardType="phone-pad" textAlign="right" />

          <Pressable testID="register-submit-button" style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]} onPress={handle} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>إرسال الطلب</Text>}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>لديك حساب بالفعل؟</Text>
            <Link href="/(auth)/login" asChild>
              <Pressable testID="go-to-login-link"><Text style={styles.link}>تسجيل الدخول</Text></Pressable>
            </Link>
          </View>
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
  appName: { fontSize: 24, fontWeight: "700", color: theme.colors.onBrandPrimary, marginBottom: 4 },
  tagline: { fontSize: 12, color: "rgba(255,255,255,0.85)", textAlign: "center" },
  form: { padding: theme.spacing.xl, paddingTop: theme.spacing.xl },
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
