import * as ImagePicker from "expo-image-picker";
import { Alert, Linking, Platform } from "react-native";

/** Pick from gallery. Returns base64 data URL or null. */
export const pickImage = async (aspect: [number, number] = [4, 3]): Promise<string | null> => {
  const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
  let can = perm.granted;
  if (!can && perm.canAskAgain) {
    const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
    can = r.granted;
  }
  if (!can) {
    Alert.alert("لا يوجد صلاحية", "يرجى منح التطبيق صلاحية الوصول إلى الصور من الإعدادات", [
      { text: "إلغاء", style: "cancel" },
      { text: "فتح الإعدادات", onPress: () => Linking.openSettings() },
    ]);
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect,
    quality: 0.5,
    base64: true,
  });
  if (res.canceled || !res.assets?.[0]?.base64) return null;
  return `data:image/jpeg;base64,${res.assets[0].base64}`;
};

/** Take a photo with the camera. */
export const takePhoto = async (aspect: [number, number] = [4, 3]): Promise<string | null> => {
  const perm = await ImagePicker.getCameraPermissionsAsync();
  let can = perm.granted;
  if (!can && perm.canAskAgain) {
    const r = await ImagePicker.requestCameraPermissionsAsync();
    can = r.granted;
  }
  if (!can) {
    Alert.alert("لا يوجد صلاحية", "يرجى منح التطبيق صلاحية الكاميرا من الإعدادات", [
      { text: "إلغاء", style: "cancel" },
      { text: "فتح الإعدادات", onPress: () => Linking.openSettings() },
    ]);
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect,
    quality: 0.5,
    base64: true,
  });
  if (res.canceled || !res.assets?.[0]?.base64) return null;
  return `data:image/jpeg;base64,${res.assets[0].base64}`;
};

/** Prompt: camera or gallery */
export const chooseImage = (onPick: (data: string) => void, aspect: [number, number] = [4, 3]) => {
  Alert.alert("اختر مصدر الصورة", "", [
    { text: "الكاميرا", onPress: async () => { const d = await takePhoto(aspect); if (d) onPick(d); } },
    { text: "المعرض", onPress: async () => { const d = await pickImage(aspect); if (d) onPick(d); } },
    { text: "إلغاء", style: "cancel" },
  ]);
};

/** Open WhatsApp with a phone number */
export const openWhatsApp = async (phone: string) => {
  const num = phone.replace(/[^0-9]/g, "");
  const url = `whatsapp://send?phone=${num}`;
  const can = await Linking.canOpenURL(url);
  if (can) return Linking.openURL(url);
  // Fallback to wa.me
  return Linking.openURL(`https://wa.me/${num}`);
};

export const openDialer = (phone: string) => {
  const num = phone.replace(/[^0-9+]/g, "");
  return Linking.openURL(`tel:${num}`);
};
