import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const API = `${BASE}/api`;
console.log("BASE =", BASE);
console.log("API =", API);
const TOKEN_KEY = "medan_token";

export const setToken = async (t: string | null) => {
  if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
  else await AsyncStorage.removeItem(TOKEN_KEY);
};
export const getToken = async () => AsyncStorage.getItem(TOKEN_KEY);

async function req(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  console.log("BASE =", BASE);
  console.log("API =", API);
  console.log("URL =", `${API}${path}`);
  console.log("BODY =", opts.body);

  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.detail || "حدث خطأ";
    throw new Error(typeof msg === "string" ? msg : "حدث خطأ");
  }
  return data;
}

const crud = (name: string) => ({
  list: () => req(`/${name}`),
  create: (b: any) => req(`/${name}`, { method: "POST", body: JSON.stringify(b) }),
  update: (id: string, b: any) => req(`/${name}/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  delete: (id: string) => req(`/${name}/${id}`, { method: "DELETE" }),
});

export const api = {
  authStatus: () => req("/auth/status"),
  adminSetup: (full_name: string, phone: string, password: string) =>
    req("/auth/admin-setup", { method: "POST", body: JSON.stringify({ full_name, phone, password }) }),
  register: (full_name: string, phone: string) =>
    req("/auth/register", { method: "POST", body: JSON.stringify({ full_name, phone }) }),
  login: (phone: string, password: string) =>
    req("/auth/login", { method: "POST", body: JSON.stringify({ phone, password }) }),
  me: () => req("/auth/me"),
  changePassword: (new_password: string) =>
    req("/auth/change-password", { method: "POST", body: JSON.stringify({ new_password }) }),

  users: {
    list: () => req("/users"),
    pending: () => req("/users/pending"),
    update: (id: string, b: any) => req(`/users/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    delete: (id: string) => req(`/users/${id}`, { method: "DELETE" }),
    approve: (id: string) => req(`/users/${id}/approve`, { method: "POST" }),
    resetPassword: (id: string) => req(`/users/${id}/reset-password`, { method: "POST" }),
    notifyMessage: (data: { temp_password: string; phone: string; full_name: string }) =>
      req("/users/notify-message", { method: "POST", body: JSON.stringify(data) }),
  },

  dashboard: () => req("/stats/dashboard"),
  violationsMonthly: () => req("/stats/violations-monthly"),
  maintenanceMonthly: () => req("/stats/maintenance-monthly"),
  fuelMonthly: () => req("/stats/fuel-monthly"),
  accidentsMonthly: () => req("/stats/accidents-monthly"),
  violationsByVehicle: () => req("/stats/violations-by-vehicle"),
  maintenanceStatus: () => req("/stats/maintenance-status"),
  fuelByVehicle: () => req("/stats/fuel-by-vehicle"),
  fuelAlerts: () => req("/stats/fuel-alerts"),
  accidentsSummary: () => req("/stats/accidents-summary"),

  vehicleHistory: (id: string) => req(`/vehicles/${id}/history`),
  locationDetails: (id: string) => req(`/locations/${id}/details`),

  scheduleOnDate: (dateStr?: string) => req(`/schedule/on-date${dateStr ? `?date_str=${dateStr}` : ""}`),
  scheduleWeek: () => req("/schedule/week"),

  violationNotifyInfo: (id: string) => req(`/violations/${id}/notify-info`),

  locations: crud("locations"),
  employees: crud("employees"),
  vehicles: crud("vehicles"),
  maintenance: crud("maintenance"),
  violations: crud("violations"),
  leaves: crud("leaves"),
  fuel: crud("fuel_records"),
  accidents: crud("accidents"),
  assignments: crud("assignments"),
};
