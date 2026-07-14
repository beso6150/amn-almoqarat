# Medan (ميدان) - Field Work Management App - PRD

## Overview
Arabic RTL mobile app for managing headquarters (المقرات), employees (الموظفين), vehicles (السيارات), maintenance (الصيانة), price lists, employee leaves (إجازات), and traffic violations (المخالفات المرورية) with charts and statistics.

## Tech Stack
- **Frontend**: Expo React Native (SDK 54), expo-router, react-native-gifted-charts, expo-linear-gradient, Ionicons
- **Backend**: FastAPI, MongoDB (motor), JWT (python-jose), bcrypt password hashing
- **RTL**: I18nManager.forceRTL(true), row-reverse flex layouts

## Features
1. **Auth (JWT)**: Register / Login / persistent session via AsyncStorage
2. **Dashboard (الرئيسية)**: KPIs, monthly violations bar chart, maintenance status pie chart, upcoming maintenance alerts, yearly cost
3. **Vehicles (السيارات)**: CRUD, search, filter by status (active/maintenance/out_of_service), assign to location & driver
4. **Violations (المخالفات)**: CRUD, monthly trend line chart, filter paid/unpaid, mark paid toggle, total unpaid amount
5. **Management (Employees tab)**: 4 sub-tabs — Employees, Locations, Leaves, Maintenance — full CRUD each
6. **Demo Seed**: One-tap seed with 3 locations, 4 employees, 4 vehicles, 6 maintenance records, 7 violations, 3 leaves

## Test Credentials
See `/app/memory/test_credentials.md`

## Design
- Palette: Moss Green (#3A4F2C) primary, Rust (#B85C38) secondary — NO blues/purples
- Font: system Arabic (React Native default supports Arabic natively)
- Icons: Ionicons via @expo/vector-icons
- Layout: RTL throughout, row-reverse flex direction
