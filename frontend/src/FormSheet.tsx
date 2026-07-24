import React from "react";
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  children: React.ReactNode;
  testID?: string;
};

export const FormSheet: React.FC<Props> = ({ visible, title, onClose, onSubmit, submitLabel = "حفظ", children, testID }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay} testID={testID}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Pressable onPress={onClose} testID="form-close">
                <Ionicons name="close" size={24} color={theme.colors.onSurface} />
              </Pressable>
              <Text style={styles.title}>{title}</Text>
              <Pressable onPress={onSubmit} testID="form-submit">
                <Text style={styles.submit}>{submitLabel}</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View style={{ marginBottom: theme.spacing.md }}>
    <Text style={styles.label}>{label}</Text>
    {children}
  </View>
);

export const inputStyle = {
  backgroundColor: theme.colors.surface,
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: theme.radius.md,
  paddingHorizontal: theme.spacing.md,
  paddingVertical: 12,
  fontSize: 15,
  color: theme.colors.onSurface,
  textAlign: "right" as const,
  writingDirection: "rtl" as const,
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    height: "80%",
  },
  header: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    padding: theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  title: { fontSize: 17, fontWeight: "700", color: theme.colors.onSurface },
  submit: { fontSize: 15, fontWeight: "700", color: theme.colors.brandPrimary },
  body: { padding: theme.spacing.lg },
  label: { fontSize: 13, fontWeight: "600", color: theme.colors.onSurfaceSecondary, marginBottom: 6, textAlign: "right" },
});
