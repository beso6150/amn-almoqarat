import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import { theme } from "@/src/theme";
import { openWhatsApp, openDialer } from "@/src/helpers";

const DEV_NAME = "بسام الحربي";
const DEV_PHONE = "0556728911";

export default function AboutScreen() {
  const router = useRouter();
  return (
    <View style={styles.root} testID="about-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={[theme.colors.brandPrimary, "#25341C"]} style={styles.header}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-forward" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.headerTitle}>معلومات المطور</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ alignItems: "center", paddingBottom: 20 }}>
            <View style={styles.avatar}><Ionicons name="person" size={48} color="#fff" /></View>
            <Text style={styles.name}>{DEV_NAME}</Text>
            <Text style={styles.role}>مطور التطبيق</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>الاستفسارات والملاحظات والشكاوى</Text>
          <Text style={styles.cardBody}>لأي استفسار أو ملاحظة أو شكوى، يمكنك التواصل مباشرة على الرقم أدناه.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="call" size={22} color={theme.colors.brandPrimary} />
            <Text style={styles.rowText}>{DEV_PHONE}</Text>
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <Ionicons name="person" size={22} color={theme.colors.brandPrimary} />
            <Text style={styles.rowText}>{DEV_NAME}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          <Pressable testID="dev-call" onPress={() => openDialer(DEV_PHONE)} style={[styles.actionBtn, { backgroundColor: theme.colors.brandPrimary }]}>
            <Ionicons name="call" size={20} color="#fff" />
            <Text style={styles.actionText}>اتصال</Text>
          </Pressable>
          <Pressable testID="dev-whatsapp" onPress={() => openWhatsApp(DEV_PHONE, "السلام عليكم، لدي استفسار بخصوص تطبيق ميدان")} style={[styles.actionBtn, { backgroundColor: "#25D366" }]}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.actionText}>واتساب</Text>
          </Pressable>
          <Pressable testID="dev-sms" onPress={() => Linking.openURL(`sms:${DEV_PHONE}`)} style={[styles.actionBtn, { backgroundColor: theme.colors.brandSecondary }]}>
            <Ionicons name="chatbubble" size={20} color="#fff" />
            <Text style={styles.actionText}>رسالة</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.wish}>تمنياتي لكم بالتوفيق</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  header: { paddingBottom: 24 },
  headerRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: theme.spacing.md },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#fff" },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginTop: 8 },
  name: { fontSize: 22, fontWeight: "700", color: "#fff", marginTop: 12 },
  role: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 4 },
  card: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border },
  cardTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.onSurface, textAlign: "right", marginBottom: 6 },
  cardBody: { fontSize: 13, color: theme.colors.onSurfaceSecondary, textAlign: "right", lineHeight: 20 },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  rowText: { fontSize: 15, color: theme.colors.onSurface },
  actionBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: theme.radius.md },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  footer: { alignItems: "center", marginTop: theme.spacing.lg },
  wish: { fontSize: 15, color: theme.colors.brandPrimary, fontWeight: "700" },
});
