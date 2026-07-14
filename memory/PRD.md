# Medan (ميدان) — Field Work Management App — PRD

## Overview
Arabic RTL mobile app for managing HQs, employees, vehicles, maintenance, violations, fuel, accidents, and shift schedules with charts, statistics, PDF/Excel export, notifications, phone-based auth with admin approval, and role-based access.

## Tech Stack
- **Frontend**: Expo SDK 54, expo-router, react-native-gifted-charts, expo-linear-gradient, Ionicons, expo-image-picker, expo-print, expo-sharing, expo-notifications, expo-file-system
- **Backend**: FastAPI, MongoDB (motor), JWT (python-jose), bcrypt
- **RTL**: I18nManager.forceRTL(true), row-reverse layouts throughout

## Auth Flow (phone-based, WhatsApp OTP delivery)
1. First-time: `/(auth)/setup` — admin registers with name + phone + password. Automatically becomes مدير عمليات.
2. New users: `/(auth)/register` submit only name + phone (no password). Status = pending.
3. Admin at `/users` sees pending list → taps "قبول وإرسال كلمة المرور" → server generates temp password → modal shows password + "إرسال عبر واتساب" button.
4. User logs in with phone + temp password → forced to `/(auth)/change-password`.
5. Password reset: admin can regenerate temp password anytime and resend via WhatsApp.

## Users & Roles
- **admin** (مدير عمليات): full CRUD on all resources
- **supervisor** (مشرف أمن): read-only
- **guard** (رجل أمن): read-only

## Shift Schedule
- 8-day repeating cycle anchored at **Thursday 16/7/2026**:
  - Days 0-3: Group A (day, 06-18) + Group B (night, 18-06)
  - Days 4-7: Group C (day, 06-18) + Group D (night, 18-06)
- Endpoints: `/schedule/on-date`, `/schedule/week`
- UI at `/schedule` shows 4 group cards + 14-day rotation

## 5 Real Locations (auto-seeded on admin setup)
1. المبنى الرئيسي — حي الزايدي، مكة
2. المركز العام للنقل — حي الخالدية، مكة
3. المجلس التنسيقي — المشاعر المقدسة، مكة
4. مبنى منى — المشاعر المقدسة، مكة
5. المنطقة المركزية — بجوار الحرم، مكة

## Employees
- Fields: name, employee_number, national_id, phone, position (رجل أمن / مشرف أمن / مدير عمليات), group (A/B/C/D/none), location_id
- **No salary field**
- Search bar, call/WhatsApp quick buttons on every card

## Leaves
- Only type: **إجازة سنوية**
- Auto-reject when another approved leave overlaps for an employee in the **same location + same group**

## Vehicles
- CRUD + photo, tap → detailed history at `/vehicle/[id]`
- Full history: maintenance + violations + fuel + accidents + assignments + totals + PDF export

## Violations
- Employee search picker (no separate driver field)
- After save, WhatsApp share sheet auto-offered — Arabic message includes: type, amount, date, vehicle, deduction notice

## Fuel
- **Removed liters** — only cost, odometer before/after (with photos), notes
- Fuel-alert endpoint flags vehicles > 20% above their 6-month average

## Accidents
- Multi-photo, fault %, cost, status open/closed

## Dashboard
- 4 clickable KPIs → navigate to matching screens
- Today's shift schedule
- Fuel alerts banner
- Pending users banner (admin only)
- 4 stat cards → linked to Reports

## Reports (new tab)
- 4 categories (violations, maintenance, fuel, accidents)
- Bar chart + monthly summary + fuel-alert list
- **PDF export** (expo-print + expo-sharing) with Arabic RTL template
- **Excel export** as UTF-8 BOM CSV (opens directly in Excel)

## About Page (`/about`)
- Developer: **بسام الحربي** — **0556728911**
- Call / WhatsApp / SMS actions
- "تمنياتي لكم بالتوفيق"

## Test Credentials
See `/app/memory/test_credentials.md` — phone 0556728911 / password Bassam123

## Backend Notes
- Phone normalization: `05x…` / `+9665x…` → `9665x…`
- `require_admin` dependency on all mutating endpoints
- MongoDB responses always exclude `_id` via `{_id: 0}`
- 41 automated pytest tests, all passing.
