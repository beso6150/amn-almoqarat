import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const API = `${BASE}/api`;

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
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.detail || "حدث خطأ";
    throw new Error(msg);
  }
  return data;
}

export const api = {
  register: (email: string, password: string, full_name: string) =>
    req("/auth/register", { method: "POST", body: JSON.stringify({ email, password, full_name }) }),
  login: (email: string, password: string) =>
    req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => req("/auth/me"),

  seed: () => req("/seed", { method: "POST" }),

  dashboard: () => req("/stats/dashboard"),
  violationsMonthly: () => req("/stats/violations-monthly"),
  violationsByVehicle: () => req("/stats/violations-by-vehicle"),
  maintenanceStatus: () => req("/stats/maintenance-status"),

  listLocations: () => req("/locations"),
  createLocation: (b: any) => req("/locations", { method: "POST", body: JSON.stringify(b) }),
  updateLocation: (id: string, b: any) => req(`/locations/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  deleteLocation: (id: string) => req(`/locations/${id}`, { method: "DELETE" }),

  listEmployees: () => req("/employees"),
  createEmployee: (b: any) => req("/employees", { method: "POST", body: JSON.stringify(b) }),
  updateEmployee: (id: string, b: any) => req(`/employees/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  deleteEmployee: (id: string) => req(`/employees/${id}`, { method: "DELETE" }),

  listVehicles: () => req("/vehicles"),
  createVehicle: (b: any) => req("/vehicles", { method: "POST", body: JSON.stringify(b) }),
  updateVehicle: (id: string, b: any) => req(`/vehicles/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  deleteVehicle: (id: string) => req(`/vehicles/${id}`, { method: "DELETE" }),

  listMaintenance: () => req("/maintenance"),
  createMaintenance: (b: any) => req("/maintenance", { method: "POST", body: JSON.stringify(b) }),
  updateMaintenance: (id: string, b: any) => req(`/maintenance/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  deleteMaintenance: (id: string) => req(`/maintenance/${id}`, { method: "DELETE" }),

  listViolations: () => req("/violations"),
  createViolation: (b: any) => req("/violations", { method: "POST", body: JSON.stringify(b) }),
  updateViolation: (id: string, b: any) => req(`/violations/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  deleteViolation: (id: string) => req(`/violations/${id}`, { method: "DELETE" }),

  listLeaves: () => req("/leaves"),
  createLeave: (b: any) => req("/leaves", { method: "POST", body: JSON.stringify(b) }),
  updateLeave: (id: string, b: any) => req(`/leaves/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  deleteLeave: (id: string) => req(`/leaves/${id}`, { method: "DELETE" }),
};
