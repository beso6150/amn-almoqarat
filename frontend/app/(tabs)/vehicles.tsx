import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Image as ExpoImage,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { api } from "@/src/api";
import { theme } from "@/src/theme";
import { FormSheet, Field, inputStyle } from "@/src/FormSheet";
import { SearchPicker } from "@/src/SearchPicker";
import { useAuth } from "@/src/auth";
import { chooseImage } from "@/src/helpers";

const STATUS_MAP: Record<
  string,
  {
    label: string;
    color: string;
  }
> = {
  active: {
    label: "نشطة",
    color: theme.colors.success,
  },
  maintenance: {
    label: "قيد الصيانة",
    color: theme.colors.warning,
  },
  out_of_service: {
    label: "خارج الخدمة",
    color: theme.colors.error,
  },
};

export default function VehiclesScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
      return;
    }

    Alert.alert(title, message);
  };

  const load = useCallback(async () => {
    try {
      const [vehiclesData, locationsData, employeesData] =
        await Promise.all([
          api.vehicles.list(),
          api.locations.list(),
          api.employees.list(),
        ]);

      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setLocations(Array.isArray(locationsData) ? locationsData : []);
      setEmployees(Array.isArray(employeesData) ? employeesData : []);
    } catch (error: any) {
      console.error("تعذر تحميل السيارات:", error);

      showMessage(
        "خطأ",
        error?.message || "تعذر تحميل بيانات السيارات"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const openAdd = () => {
    if (!isAdmin) return;

    setEditing(null);

    setForm({
      plate_number: "",
      model: "",
      year: "",
      color: "",
      location_id: null,
      driver_id: null,
      status: "active",
      photo: "",
    });

    setSheetOpen(true);
  };

  const openEdit = (vehicle: any) => {
    if (!isAdmin) return;

    setEditing(vehicle);

    setForm({
      ...vehicle,
      year: vehicle.year ? String(vehicle.year) : "",
    });

    setSheetOpen(true);
  };

  const submit = async () => {
    const plateNumber = String(form.plate_number || "").trim();
    const model = String(form.model || "").trim();

    if (!plateNumber || !model) {
      showMessage(
        "خطأ",
        "يرجى إدخال رقم اللوحة والموديل"
      );
      return;
    }

    const parsedYear = form.year
      ? Number.parseInt(String(form.year), 10)
      : undefined;

    if (
      parsedYear !== undefined &&
      (!Number.isFinite(parsedYear) ||
        parsedYear < 1900 ||
        parsedYear > 2100)
    ) {
      showMessage("خطأ", "يرجى إدخال سنة صنع صحيحة");
      return;
    }

    const body = {
      ...form,
      plate_number: plateNumber,
      model,
      year: parsedYear,
    };

    try {
      setSubmitting(true);

      if (editing) {
        await api.vehicles.update(editing.id, body);
      } else {
        await api.vehicles.create(body);
      }

      setSheetOpen(false);
      setEditing(null);
      setForm({});

      await load();

      showMessage(
        "تم",
        editing
          ? "تم تعديل بيانات السيارة بنجاح"
          : "تمت إضافة السيارة بنجاح"
      );
    } catch (error: any) {
      console.error("تعذر حفظ السيارة:", error);

      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "تعذر حفظ بيانات السيارة";

      showMessage("خطأ", message);
    } finally {
      setSubmitting(false);
    }
  };

  const executeDelete = async (vehicle: any) => {
    if (!vehicle?.id || deletingId) return;

    try {
      setDeletingId(vehicle.id);

      await api.vehicles.delete(vehicle.id);

      setVehicles((currentVehicles) =>
        currentVehicles.filter(
          (currentVehicle) => currentVehicle.id !== vehicle.id
        )
      );

      await load();

      showMessage("تم", "تم حذف السيارة بنجاح");
    } catch (error: any) {
      console.error("تعذر حذف السيارة:", error);

      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "تعذر حذف السيارة";

      showMessage("خطأ", message);
    } finally {
      setDeletingId(null);
    }
  };

  const remove = (vehicle: any) => {
    if (!isAdmin || !vehicle) return;

    const plateNumber =
      vehicle.plate_number || "السيارة المحددة";

    const confirmationMessage =
      `هل تريد حذف السيارة ${plateNumber}؟\n` +
      "لا يمكن التراجع عن عملية الحذف.";

    if (Platform.OS === "web") {
      const confirmed = window.confirm(confirmationMessage);

      if (confirmed) {
        void executeDelete(vehicle);
      }

      return;
    }

    Alert.alert(
      "حذف السيارة",
      confirmationMessage,
      [
        {
          text: "إلغاء",
          style: "cancel",
        },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => {
            void executeDelete(vehicle);
          },
        },
      ]
    );
  };

  const openVehicleOptions = (vehicle: any) => {
    if (!isAdmin || Platform.OS === "web") return;

    Alert.alert(
      "خيارات السيارة",
      vehicle.plate_number,
      [
        {
          text: "تعديل",
          onPress: () => openEdit(vehicle),
        },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => remove(vehicle),
        },
        {
          text: "إلغاء",
          style: "cancel",
        },
      ]
    );
  };

  const filtered = vehicles.filter((vehicle) => {
    if (
      filter !== "all" &&
      vehicle.status !== filter
    ) {
      return false;
    }

    const searchValue = search.trim().toLowerCase();

    if (!searchValue) {
      return true;
    }

    const plateNumber = String(
      vehicle.plate_number || ""
    ).toLowerCase();

    const model = String(
      vehicle.model || ""
    ).toLowerCase();

    return (
      plateNumber.includes(searchValue) ||
      model.includes(searchValue)
    );
  });

  const chips = [
    {
      key: "all",
      label: "الكل",
    },
    {
      key: "active",
      label: "نشطة",
    },
    {
      key: "maintenance",
      label: "قيد الصيانة",
    },
    {
      key: "out_of_service",
      label: "خارج الخدمة",
    },
  ];

  const locationItems = locations.map((location) => ({
    id: location.id,
    name: location.name,
    sub: location.address || "",
  }));

  const employeeItems = employees.map((employee) => ({
    id: employee.id,
    name: employee.name,
    sub: employee.employee_number || "",
  }));

  return (
    <SafeAreaView
      style={styles.root}
      edges={["top"]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>السيارات</Text>

        {isAdmin && (
          <Pressable
            testID="add-vehicle-btn"
            onPress={openAdd}
            style={({ pressed }) => [
              styles.addBtn,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="add"
              size={22}
              color="#FFFFFF"
            />
          </Pressable>
        )}
      </View>

      <View style={styles.searchRow}>
        <Ionicons
          name="search"
          size={18}
          color={theme.colors.onSurfaceTertiary}
        />

        <TextInput
          testID="vehicle-search"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="ابحث برقم اللوحة أو الموديل"
          placeholderTextColor={
            theme.colors.onSurfaceTertiary
          }
          textAlign="right"
        />
      </View>

      <View style={styles.chipRowWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={chips}
          keyExtractor={(item) => item.key}
          contentContainerStyle={
            styles.chipsContent
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`filter-${item.key}`}
              onPress={() => setFilter(item.key)}
              style={({ pressed }) => [
                styles.chip,
                filter === item.key &&
                styles.chipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  filter === item.key &&
                  styles.chipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {loading ? (
        <ActivityIndicator
          style={styles.loading}
          color={theme.colors.brandPrimary}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={
            styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="car-outline"
                size={48}
                color={
                  theme.colors.onSurfaceTertiary
                }
              />

              <Text style={styles.emptyText}>
                لا توجد سيارات
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const location = locations.find(
              (currentLocation) =>
                currentLocation.id ===
                item.location_id
            );

            const driver = employees.find(
              (employee) =>
                employee.id === item.driver_id
            );

            const status =
              STATUS_MAP[item.status] ||
              STATUS_MAP.active;

            const isDeleting =
              deletingId === item.id;

            return (
              <Pressable
                testID={`vehicle-card-${item.id}`}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.cardPressed,
                ]}
                onLongPress={() =>
                  openVehicleOptions(item)
                }
                delayLongPress={500}
                onPress={() =>
                  router.push({
                    pathname: "/vehicle/[id]",
                    params: {
                      id: item.id,
                    },
                  })
                }
              >
                <View style={styles.cardTop}>
                  <View style={styles.iconBox}>
                    <Ionicons
                      name="car-sport"
                      size={22}
                      color={
                        theme.colors.brandPrimary
                      }
                    />
                  </View>

                  <View style={styles.vehicleInfo}>
                    <Text style={styles.plate}>
                      {item.plate_number}
                    </Text>

                    <Text style={styles.model}>
                      {item.model}
                      {item.year
                        ? ` - ${item.year}`
                        : ""}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          status.color + "20",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: status.color,
                        },
                      ]}
                    >
                      {status.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardMeta}>
                  {location && (
                    <Meta
                      icon="location"
                      text={location.name}
                    />
                  )}

                  {driver && (
                    <Meta
                      icon="person"
                      text={driver.name}
                    />
                  )}

                  {item.color && (
                    <Meta
                      icon="color-palette"
                      text={item.color}
                    />
                  )}
                </View>

                {isAdmin && (
                  <View style={styles.actionsRow}>
                    <Pressable
                      testID={`edit-vehicle-${item.id}`}
                      onPress={(event) => {
                        event.stopPropagation();
                        openEdit(item);
                      }}
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.editButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color={
                          theme.colors.brandPrimary
                        }
                      />

                      <Text
                        style={styles.editButtonText}
                      >
                        تعديل
                      </Text>
                    </Pressable>

                    <Pressable
                      testID={`delete-vehicle-${item.id}`}
                      disabled={isDeleting}
                      onPress={(event) => {
                        event.stopPropagation();
                        remove(item);
                      }}
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.deleteButton,
                        isDeleting &&
                        styles.disabledButton,
                        pressed &&
                        !isDeleting &&
                        styles.pressed,
                      ]}
                    >
                      {isDeleting ? (
                        <ActivityIndicator
                          size="small"
                          color={theme.colors.error}
                        />
                      ) : (
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={theme.colors.error}
                        />
                      )}

                      <Text
                        style={styles.deleteButtonText}
                      >
                        {isDeleting
                          ? "جارٍ الحذف"
                          : "حذف"}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}

      <FormSheet
        visible={sheetOpen}
        title={
          editing
            ? "تعديل سيارة"
            : "إضافة سيارة"
        }
        onClose={() => {
          if (!submitting) {
            setSheetOpen(false);
          }
        }}
        onSubmit={submit}
        submitLabel={
          submitting ? "جارٍ الحفظ" : "حفظ"
        }
        testID="vehicle-form-sheet"
      >
        <Field label="رقم اللوحة *">
          <TextInput
            style={inputStyle}
            value={form.plate_number || ""}
            onChangeText={(text) =>
              setForm((current: any) => ({
                ...current,
                plate_number: text,
              }))
            }
            testID="vf-plate"
          />
        </Field>

        <Field label="الموديل *">
          <TextInput
            style={inputStyle}
            value={form.model || ""}
            onChangeText={(text) =>
              setForm((current: any) => ({
                ...current,
                model: text,
              }))
            }
            testID="vf-model"
          />
        </Field>

        <Field label="سنة الصنع">
          <TextInput
            style={inputStyle}
            value={form.year || ""}
            onChangeText={(text) =>
              setForm((current: any) => ({
                ...current,
                year: text,
              }))
            }
            keyboardType="numeric"
          />
        </Field>

        <Field label="اللون">
          <TextInput
            style={inputStyle}
            value={form.color || ""}
            onChangeText={(text) =>
              setForm((current: any) => ({
                ...current,
                color: text,
              }))
            }
          />
        </Field>

        <Field label="الحالة">
          <View style={styles.statusOptions}>
            {[
              "active",
              "maintenance",
              "out_of_service",
            ].map((status) => (
              <Pressable
                key={status}
                onPress={() =>
                  setForm((current: any) => ({
                    ...current,
                    status,
                  }))
                }
                style={[
                  styles.pill,
                  form.status === status &&
                  styles.pillActive,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    form.status === status &&
                    styles.pillTextActive,
                  ]}
                >
                  {STATUS_MAP[status].label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="المقر">
          <SearchPicker
            label="اختر المقر"
            items={locationItems}
            value={form.location_id}
            onChange={(value) =>
              setForm((current: any) => ({
                ...current,
                location_id: value,
              }))
            }
            testID="veh-location-picker"
          />
        </Field>

        <Field label="السائق / المسؤول">
          <SearchPicker
            label="اختر موظف"
            items={employeeItems}
            value={form.driver_id}
            onChange={(value) =>
              setForm((current: any) => ({
                ...current,
                driver_id: value,
              }))
            }
            testID="veh-driver-picker"
          />
        </Field>

        <Field label="صورة السيارة">
          {form.photo ? (
            <View>
              <Pressable
                onPress={() =>
                  chooseImage((imageData) =>
                    setForm((current: any) => ({
                      ...current,
                      photo: imageData,
                    }))
                  )
                }
              >
                <ExpoImage
                  source={{
                    uri: form.photo,
                  }}
                  style={styles.vehicleImage}
                />
              </Pressable>

              <Pressable
                onPress={() =>
                  setForm((current: any) => ({
                    ...current,
                    photo: "",
                  }))
                }
                style={styles.removeImageButton}
              >
                <Text
                  style={styles.removeImageText}
                >
                  حذف الصورة
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() =>
                chooseImage((imageData) =>
                  setForm((current: any) => ({
                    ...current,
                    photo: imageData,
                  }))
                )
              }
              style={styles.imagePicker}
            >
              <Ionicons
                name="camera"
                size={24}
                color={
                  theme.colors.onSurfaceTertiary
                }
              />

              <Text style={styles.imagePickerText}>
                إضافة صورة
              </Text>
            </Pressable>
          )}
        </Field>
      </FormSheet>
    </SafeAreaView>
  );
}

const Meta = ({
  icon,
  text,
}: {
  icon: any;
  text: string;
}) => (
  <View style={styles.metaItem}>
    <Ionicons
      name={icon}
      size={13}
      color={theme.colors.onSurfaceTertiary}
    />

    <Text style={styles.metaText}>
      {text}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },

  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.lg,
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.onSurface,
  },

  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },

  searchRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.onSurface,
    writingDirection: "rtl",
  },

  chipRowWrap: {
    height: 56,
    justifyContent: "center",
    marginTop: 4,
  },

  chipsContent: {
    paddingHorizontal: theme.spacing.md,
    gap: 8,
    flexDirection: "row-reverse",
  },

  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  chipActive: {
    backgroundColor: theme.colors.brandPrimary,
    borderColor: theme.colors.brandPrimary,
  },

  chipText: {
    fontSize: 13,
    color: theme.colors.onSurfaceSecondary,
    fontWeight: "600",
  },

  chipTextActive: {
    color: "#FFFFFF",
  },

  loading: {
    marginTop: 40,
  },

  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 80,
  },

  card: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  cardPressed: {
    opacity: 0.94,
  },

  cardTop: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: theme.spacing.md,
  },

  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },

  vehicleInfo: {
    flex: 1,
  },

  plate: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.onSurface,
    textAlign: "right",
  },

  model: {
    fontSize: 13,
    color: theme.colors.onSurfaceTertiary,
    textAlign: "right",
    marginTop: 2,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  cardMeta: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },

  metaItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },

  metaText: {
    fontSize: 12,
    color: theme.colors.onSurfaceTertiary,
  },

  actionsRow: {
    flexDirection: "row-reverse",
    gap: 8,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },

  actionButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },

  editButton: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.brandPrimary,
  },

  deleteButton: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.error,
  },

  editButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.brandPrimary,
  },

  deleteButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.error,
  },

  disabledButton: {
    opacity: 0.5,
  },

  pressed: {
    opacity: 0.65,
  },

  empty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },

  emptyText: {
    fontSize: 14,
    color: theme.colors.onSurfaceTertiary,
  },

  statusOptions: {
    flexDirection: "row-reverse",
    gap: 6,
    flexWrap: "wrap",
  },

  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  pillActive: {
    backgroundColor: theme.colors.brandPrimary,
    borderColor: theme.colors.brandPrimary,
  },

  pillText: {
    fontSize: 13,
    color: theme.colors.onSurface,
    fontWeight: "600",
  },

  pillTextActive: {
    color: "#FFFFFF",
  },

  vehicleImage: {
    width: "100%",
    height: 160,
    borderRadius: theme.radius.md,
  },

  removeImageButton: {
    marginTop: 6,
    alignSelf: "flex-end",
  },

  removeImageText: {
    color: theme.colors.error,
    fontSize: 12,
  },

  imagePicker: {
    height: 100,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  imagePickerText: {
    color: theme.colors.onSurfaceTertiary,
    fontSize: 13,
  },
});