import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert, Linking, Platform, Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

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
  const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect, quality: 0.5, base64: true });
  if (res.canceled || !res.assets?.[0]?.base64) return null;
  return `data:image/jpeg;base64,${res.assets[0].base64}`;
};

export const chooseImage = (onPick: (data: string) => void, aspect: [number, number] = [4, 3]) => {
  Alert.alert("اختر مصدر الصورة", "", [
    { text: "الكاميرا", onPress: async () => { const d = await takePhoto(aspect); if (d) onPick(d); } },
    { text: "المعرض", onPress: async () => { const d = await pickImage(aspect); if (d) onPick(d); } },
    { text: "إلغاء", style: "cancel" },
  ]);
};

/** WhatsApp URL builders + openers */
export const buildWhatsAppUrl = (phone: string, message?: string) => {
  const num = phone.replace(/[^0-9]/g, "");
  const encoded = message ? encodeURIComponent(message) : "";
  return `whatsapp://send?phone=${num}${message ? `&text=${encoded}` : ""}`;
};
export const buildWebWhatsAppUrl = (phone: string, message?: string) => {
  const num = phone.replace(/[^0-9]/g, "");
  const encoded = message ? encodeURIComponent(message) : "";
  return `https://wa.me/${num}${message ? `?text=${encoded}` : ""}`;
};

export const openWhatsApp = async (phone: string, message?: string) => {
  const app = buildWhatsAppUrl(phone, message);
  try {
    const can = await Linking.canOpenURL(app);
    if (can) return Linking.openURL(app);
  } catch {}
  return Linking.openURL(buildWebWhatsAppUrl(phone, message));
};

export const openDialer = (phone: string) => {
  const num = phone.replace(/[^0-9+]/g, "");
  return Linking.openURL(`tel:${num}`);
};

/** PDF export from HTML. */
export const exportPdf = async (title: string, html: string) => {
  try {
    const { uri } = await Print.printToFileAsync({ html });
    const can = await Sharing.isAvailableAsync();
    if (can) await Sharing.shareAsync(uri, { dialogTitle: title, mimeType: "application/pdf" });
    else await Share.share({ url: uri, title });
  } catch (e: any) {
    Alert.alert("خطأ", e.message || "فشل تصدير PDF");
  }
};

/** CSV/Excel export: writes a UTF-8 BOM CSV file (Excel-compatible) and shares it. */
export const exportCsv = async (filename: string, rows: string[][]) => {
  try {
    const csv = rows
      .map((r) => r.map((c) => {
        const s = String(c ?? "");
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      }).join(","))
      .join("\r\n");
    const withBom = "\ufeff" + csv;
    const path = `${FileSystem.cacheDirectory}${filename}.csv`;
    await FileSystem.writeAsStringAsync(path, withBom, { encoding: FileSystem.EncodingType.UTF8 });
    const can = await Sharing.isAvailableAsync();
    if (can) await Sharing.shareAsync(path, { dialogTitle: filename, mimeType: "text/csv" });
    else await Share.share({ url: path, title: filename });
  } catch (e: any) {
    Alert.alert("خطأ", e.message || "فشل تصدير Excel");
  }
};

/** Standard Arabic PDF wrapper. */
export const arabicPdfShell = (title: string, bodyHtml: string) => `
<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, sans-serif; padding: 20px; direction: rtl; }
  h1 { color: #3A4F2C; border-bottom: 3px solid #3A4F2C; padding-bottom: 8px; }
  h2 { color: #3A4F2C; margin-top: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
  th { background: #D6DDD2; padding: 8px; text-align: right; color: #25341C; }
  td { text-align: right; padding: 6px; border-bottom: 1px solid #ddd; }
  .kpi { display: flex; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
  .kpi > div { background: #F7F7F5; padding: 12px 16px; border-radius: 8px; flex: 1; text-align: center; min-width: 100px; }
  .kpi .lbl { font-size: 12px; color: #4A4A46; }
  .kpi .val { font-size: 18px; font-weight: 700; color: #3A4F2C; margin-top: 4px; }
</style></head><body>
<h1>${title}</h1>
${bodyHtml}
<p style="margin-top:32px;text-align:center;color:#999;font-size:11px">
تقرير تم إنشاؤه من تطبيق إدارة أمن مقرات الهيئة — ${new Date().toLocaleDateString("ar-SA")}
</p></body></html>`;
