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

const crud = (name: string) => ({
  list: () => req(`/${name}`),
  create: (b: any) => req(`/${name}`, { method: "POST", body: JSON.stringify(b) }),
  update: (id: string, b: any) => req(`/${name}/${id}`, { method: "PUT", body: JSON.stringify(b) }),
  delete: (id: string) => req(`/${name}/${id}`, { method: "DELETE" }),
});

export const api = {
  register: (email: string, password: string, full_name: string) =>
    req("/auth/register", { method: "POST", body: JSON.stringify({ email, password, full_name }) }),
  login: (email: string, password: string) =>
    req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => req("/auth/me"),
  seed: () => req("/seed", { method: "POST" }),

  users: {
    list: () => req("/users"),
    pending: () => req("/users/pending"),
    update: (id: string, b: any) => req(`/users/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    delete: (id: string) => req(`/users/${id}`, { method: "DELETE" }),
  },

  dashboard: () => req("/stats/dashboard"),
  violationsMonthly: () => req("/stats/violations-monthly"),
  violationsByVehicle: () => req("/stats/violations-by-vehicle"),
  maintenanceStatus: () => req("/stats/maintenance-status"),
  fuelMonthly: () => req("/stats/fuel-monthly"),
  fuelByVehicle: () => req("/stats/fuel-by-vehicle"),
  accidentsSummary: () => req("/stats/accidents-summary"),
  vehicleHistory: (id: string) => req(`/vehicles/${id}/history`),

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
