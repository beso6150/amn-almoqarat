import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { theme } from "@/src/theme";

export default function Index() {
  const { user, loading, adminExists } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (user.must_change_password) router.replace("/(auth)/change-password");
      else router.replace("/(tabs)/dashboard");
    } else if (adminExists === false) {
      router.replace("/(auth)/setup");
    } else {
      router.replace("/(auth)/login");
    }
  }, [loading, user, adminExists]);

  return (
    <View style={styles.container} testID="splash-container">
      <ActivityIndicator size="large" color={theme.colors.brandPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
  },
});
