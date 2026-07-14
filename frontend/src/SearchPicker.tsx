import React, { useState, useMemo } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "./theme";

type Item = { id: string; name: string; sub?: string };

type Props = {
  label?: string;
  items: Item[];
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  testID?: string;
};

/** Searchable single-select picker. Opens a modal with a text input. */
export const SearchPicker: React.FC<Props> = ({ label, items, value, onChange, placeholder = "ابحث…", allowClear = true, testID }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => items.find((i) => i.id === value), [items, value]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || (i.sub || "").toLowerCase().includes(q));
  }, [items, query]);

  return (
    <>
      <Pressable testID={testID} onPress={() => setOpen(true)} style={styles.field}>
        <View style={{ flex: 1 }}>
          <Text style={selected ? styles.fieldValue : styles.fieldPlaceholder} numberOfLines={1}>
            {selected ? selected.name : (label || placeholder)}
          </Text>
          {selected?.sub ? <Text style={styles.fieldSub}>{selected.sub}</Text> : null}
        </View>
        <Ionicons name="chevron-down" size={18} color={theme.colors.onSurfaceTertiary} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setOpen(false)}>
                <Ionicons name="close" size={22} color={theme.colors.onSurface} />
              </Pressable>
              <Text style={styles.sheetTitle}>{label || "اختر"}</Text>
              {allowClear && value ? (
                <Pressable onPress={() => { onChange(null); setOpen(false); }}>
                  <Text style={{ color: theme.colors.error, fontWeight: "700" }}>مسح</Text>
                </Pressable>
              ) : <View style={{ width: 40 }} />}
            </View>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color={theme.colors.onSurfaceTertiary} />
              <TextInput
                testID="search-picker-input"
                style={styles.search}
                value={query}
                onChangeText={setQuery}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.onSurfaceTertiary}
                textAlign="right"
                autoFocus
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => {
                const sel = item.id === value;
                return (
                  <Pressable
                    testID={`picker-item-${item.id}`}
                    onPress={() => { onChange(item.id); setOpen(false); setQuery(""); }}
                    style={[styles.row, sel && { backgroundColor: theme.colors.brandTertiary }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.name}</Text>
                      {item.sub ? <Text style={styles.sub}>{item.sub}</Text> : null}
                    </View>
                    {sel && <Ionicons name="checkmark" size={20} color={theme.colors.brandPrimary} />}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={{ padding: 40, alignItems: "center" }}>
                  <Text style={{ color: theme.colors.onSurfaceTertiary }}>لا توجد نتائج</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  field: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: 12,
  },
  fieldValue: { fontSize: 15, color: theme.colors.onSurface, textAlign: "right" },
  fieldPlaceholder: { fontSize: 15, color: theme.colors.onSurfaceTertiary, textAlign: "right" },
  fieldSub: { fontSize: 11, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginTop: 2 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, maxHeight: "80%", minHeight: "50%" },
  sheetHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.onSurface },
  searchWrap: { flexDirection: "row-reverse", alignItems: "center", gap: 8, margin: theme.spacing.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md },
  search: { flex: 1, paddingVertical: 10, fontSize: 14, color: theme.colors.onSurface, writingDirection: "rtl" },
  row: { flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: theme.spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  name: { fontSize: 15, color: theme.colors.onSurface, textAlign: "right" },
  sub: { fontSize: 12, color: theme.colors.onSurfaceTertiary, textAlign: "right", marginTop: 2 },
});
