import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { theme } from "@/src/theme";

export default function PendingScreen() {
  const { message } = useLocalSearchParams<{ message?: string }>();
  const router = useRouter();
  return (
    <LinearGradient colors={[theme.colors.brandPrimary, "#25341C"]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="pending-screen">
        <View style={styles.box}>
          <View style={styles.iconCircle}>
            <Ionicons name="hourglass" size={48} color={theme.colors.warning} />
          </View>
          <Text style={styles.title}>بانتظار الموافقة</Text>
          <Text style={styles.text}>
            {message || "تم إنشاء حسابك بنجاح. سيتم إشعار المدير لمراجعة حسابك."}
          </Text>
          <Text style={styles.subtitle}>
            سيتم تفعيل حسابك فور موافقة المدير. حاول تسجيل الدخول لاحقاً.
          </Text>
          <Pressable
            testID="back-to-login"
            style={styles.btn}
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text style={styles.btnText}>العودة إلى تسجيل الدخول</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: 24 },
  box: {
    backgroundColor: "#fff", borderRadius: theme.radius.lg, padding: 32, alignItems: "center",
  },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: "#FFF3E0",
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: "700", color: theme.colors.onSurface, marginBottom: 12 },
  text: { fontSize: 15, color: theme.colors.onSurfaceSecondary, textAlign: "center", marginBottom: 12, lineHeight: 22 },
  subtitle: { fontSize: 13, color: theme.colors.onSurfaceTertiary, textAlign: "center", marginBottom: 24 },
  btn: {
    backgroundColor: theme.colors.brandPrimary, paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: theme.radius.md,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
