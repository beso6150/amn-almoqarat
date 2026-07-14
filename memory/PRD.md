# Medan (ميدان) - Field Work Management App - PRD

## Overview
Arabic RTL mobile app for managing headquarters, employees, vehicles, maintenance, violations, fuel, accidents, and leaves with charts, statistics, PDF export, notifications, and role-based access control.

## Tech Stack
- **Frontend**: Expo SDK 54, expo-router, react-native-gifted-charts, expo-linear-gradient, Ionicons, expo-image-picker, expo-print, expo-sharing, expo-notifications
- **Backend**: FastAPI, MongoDB (motor), JWT (python-jose), bcrypt
- **RTL**: I18nManager.forceRTL(true), row-reverse layouts

## Features

### Auth & Roles
- JWT-based auth
- **First user auto-becomes admin** (مدير عمليات) with status=approved
- **Subsequent registrations start pending** → notified admin must approve
- Roles: `admin` (مدير عمليات), `supervisor` (مشرف أمن), `guard` (رجل أمن)
- **Only admin** can create/update/delete data; others read-only
- Admin can approve/reject/change role/delete users at `/users`
- Pending screen shown to newly registered users

### Dashboard
- 4 KPIs: vehicles, maintenance, unpaid violations, active leaves
- Summary cards: locations, employees, unpaid amount, fuel cost, open accidents, accident cost
- Monthly violations bar chart, maintenance status pie chart
- Alerts: upcoming maintenance, pending user approvals

### Vehicles
- CRUD (admin), search, filter by status
- Photo upload (base64)
- **Tap → detailed history page** with 6 tabs:
  - Summary (photo + KPIs + grand total)
  - Maintenance history
  - Violations history
  - Fuel records with distances
  - Accidents with photos & fault %
  - Assignments (عهدة - who had it when)
- **PDF export** of full vehicle report (Arabic RTL)

### Violations
- CRUD (admin), photos, monthly trend line chart
- Total unpaid amount summary
- Toggle paid/unpaid, filter chips

### Management Tab (6 sub-tabs)
- **Employees** - CRUD; fields: name, employee_number (رقم وظيفي), national_id, phone, position (from picker), location. NO salary. Cards have call + WhatsApp buttons
- **Locations** - CRUD
- **Leaves** - active/upcoming/past status
- **Maintenance** - price list with cost & due dates
- **Fuel** - before/after odometer + photos, liters, cost
- **Accidents** - description, fault %, cost, multi-photo, open/closed

### Notifications
- Local reminders (expo-notifications) scheduled automatically:
  - 3 days before maintenance next_due_date
  - 1 day before leave end_date

### Demo Seed
- One-tap seeds: 3 locations, 4 employees, 4 vehicles, 6 maintenance, 7 violations, 3 leaves, 4 fuel records, 2 accidents, 4 assignments

## Test Credentials
See `/app/memory/test_credentials.md`

## Design
- Palette: Moss Green (#3A4F2C) primary, Rust (#B85C38) secondary — professional, no purple/blue
- Icons: Ionicons via @expo/vector-icons
- Full RTL throughout
- Contact buttons: green primary for call, WhatsApp brand green (#25D366)

## Backend Notes
- All CRUD registered via `_crud` helper in server.py
- `require_admin` dependency guards mutations
- Password hashing via passlib bcrypt
- MongoDB responses always exclude `_id` via `{_id: 0}` projection
