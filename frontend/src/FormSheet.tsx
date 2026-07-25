import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
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

export const FormSheet: React.FC<Props> = ({
  visible,
  title,
  onClose,
  onSubmit,
  submitLabel = "حفظ",
  children,
  testID,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay} testID={testID}>
        {/* الضغط على الخلفية يغلق النافذة */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.sheet}>
            {/* الرأس ثابت دائمًا */}
            <View style={styles.header}>
              <Pressable
                onPress={onClose}
                testID="form-close"
                style={styles.headerButton}
                accessibilityLabel="إغلاق"
              >
                <Ionicons
                  name="close"
                  size={25}
                  color={theme.colors.onSurface}
                />
              </Pressable>

              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>

              <Pressable
                onPress={onSubmit}
                testID="form-submit"
                style={styles.headerButton}
                accessibilityLabel={submitLabel}
              >
                <Text style={styles.submit}>{submitLabel}</Text>
              </Pressable>
            </View>

            {/* الحقول فقط هي التي تتحرك */}
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export const Field: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <View style={styles.field}>
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
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },

  keyboardView: {
    width: "100%",
    maxHeight: "92%",
    justifyContent: "flex-end",
  },

  sheet: {
    width: "100%",
    maxWidth: 760,
    maxHeight: "100%",
    alignSelf: "center",
    backgroundColor: theme.colors.surfaceSecondary,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    overflow: "hidden",
  },

  header: {
    minHeight: 64,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSecondary,
  },

  headerButton: {
    width: 64,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 17,
    fontWeight: "700",
    color: theme.colors.onSurface,
    textAlign: "center",
  },

  submit: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.brandPrimary,
  },

  body: {
    flexShrink: 1,
  },

  bodyContent: {
    padding: theme.spacing.lg,
    paddingBottom: 48,
  },

  field: {
    marginBottom: theme.spacing.md,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.onSurfaceSecondary,
    marginBottom: 6,
    textAlign: "right",
  },
});