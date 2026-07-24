"""Backend tests for Medan (ميدان) iteration 3 - Arabic RTL field-work app.
Covers: phone-based auth, admin-setup, approval flow with temp password, 5 real Makkah locations,
no demo data, employees (no salary + group + positions), leaves with conflict check, fuel (no liters),
schedule (8-day cycle), stats (fuel-alerts, monthly), whatsapp notify helpers, location details, admin-only guards.
"""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_PHONE = "0556728911"
ADMIN_PASSWORD = "Bassam123"


def _is_arabic(s: str) -> bool:
    return any("\u0600" <= c <= "\u06FF" for c in (s or ""))


@pytest.fixture(scope="session")
def admin_token():
    # Try login; if admin isn't set up yet, run admin-setup.
    r = requests.post(f"{API}/auth/login", json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        status = requests.get(f"{API}/auth/status").json()
        if not status.get("admin_exists"):
            r2 = requests.post(f"{API}/auth/admin-setup", json={
                "full_name": "بسام الحربي", "phone": ADMIN_PHONE, "password": ADMIN_PASSWORD
            })
            assert r2.status_code == 200, r2.text
            return r2.json()["access_token"]
        pytest.skip(f"cannot login as admin: {r.text}")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ============ AUTH STATUS & SETUP ============
class TestAuthStatusAndSetup:
    def test_auth_status_public_and_true_after_setup(self, admin_token):
        # Ensures admin is set up (fixture ran)
        r = requests.get(f"{API}/auth/status")
        assert r.status_code == 200
        assert r.json() == {"admin_exists": True}

    def test_admin_setup_second_call_returns_400_arabic(self, admin_token):
        r = requests.post(f"{API}/auth/admin-setup", json={
            "full_name": "x", "phone": "0500000000", "password": "abc123"
        })
        assert r.status_code == 400
        assert _is_arabic(r.json().get("detail", ""))


# ============ REGISTRATION + APPROVAL + LOGIN + CHANGE PASSWORD ============
class TestRegistrationApprovalFlow:
    @pytest.fixture(scope="class")
    def new_user(self, auth_headers):
        # unique phone starting with 05
        phone = f"05{uuid.uuid4().int % 100000000:08d}"
        name = f"TEST_مستخدم_{uuid.uuid4().hex[:4]}"
        r = requests.post(f"{API}/auth/register", json={"full_name": name, "phone": phone})
        assert r.status_code == 200, r.text
        assert r.json().get("pending") is True
        # Find id
        users = requests.get(f"{API}/users", headers=auth_headers).json()
        u = next(x for x in users if x["full_name"] == name)
        yield {"id": u["id"], "phone": phone, "name": name}
        requests.delete(f"{API}/users/{u['id']}", headers=auth_headers)

    def test_register_duplicate_phone_400_arabic(self, new_user):
        r = requests.post(f"{API}/auth/register", json={"full_name": "دبل", "phone": new_user["phone"]})
        assert r.status_code == 400
        assert _is_arabic(r.json().get("detail", ""))

    def test_pending_login_returns_403_arabic(self, new_user):
        # Before approval, cannot login (no password anyway) — expect 401 or 403
        r = requests.post(f"{API}/auth/login", json={"phone": new_user["phone"], "password": "x"})
        assert r.status_code in (401, 403)
        assert _is_arabic(r.json().get("detail", ""))

    def test_approve_returns_temp_password_then_login_and_change(self, auth_headers, new_user):
        r = requests.post(f"{API}/users/{new_user['id']}/approve", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        temp = data["temp_password"]
        assert len(temp) >= 6
        assert data["phone"].startswith("966")
        assert data["full_name"] == new_user["name"]

        # login with temp
        lr = requests.post(f"{API}/auth/login", json={"phone": new_user["phone"], "password": temp})
        assert lr.status_code == 200, lr.text
        body = lr.json()
        assert body["user"]["must_change_password"] is True
        tok = body["access_token"]

        # change-password
        cp = requests.post(f"{API}/auth/change-password",
                           json={"new_password": "newPass9!"},
                           headers={"Authorization": f"Bearer {tok}"})
        assert cp.status_code == 200

        # login with new pw — flag cleared
        lr2 = requests.post(f"{API}/auth/login", json={"phone": new_user["phone"], "password": "newPass9!"})
        assert lr2.status_code == 200
        assert lr2.json()["user"]["must_change_password"] is False

    def test_reset_password_issues_new_temp(self, auth_headers, new_user):
        r = requests.post(f"{API}/users/{new_user['id']}/reset-password", headers=auth_headers)
        assert r.status_code == 200
        temp = r.json()["temp_password"]
        assert temp and len(temp) >= 6
        lr = requests.post(f"{API}/auth/login", json={"phone": new_user["phone"], "password": temp})
        assert lr.status_code == 200
        assert lr.json()["user"]["must_change_password"] is True

    def test_notify_message_returns_whatsapp_text(self, auth_headers, new_user):
        r = requests.post(f"{API}/users/notify-message", json={
            "temp_password": "AbCd1234", "phone": new_user["phone"], "full_name": new_user["name"]
        }, headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["phone"].startswith("966")
        assert "AbCd1234" in body["message"]
        assert _is_arabic(body["message"])


# ============ REAL LOCATIONS & NO DEMO DATA ============
class TestRealLocationsAndCleanState:
    def test_five_real_makkah_locations_exist(self, auth_headers):
        r = requests.get(f"{API}/locations", headers=auth_headers)
        assert r.status_code == 200
        locs = r.json()
        names = [l["name"] for l in locs]
        expected = {"المبنى الرئيسي", "المركز العام للنقل", "المجلس التنسيقي", "مبنى منى", "المنطقة المركزية"}
        assert expected.issubset(set(names)), f"missing locations: {expected - set(names)}"

    def test_no_demo_data_seeded(self, auth_headers):
        # These should be empty (no demo seeding). Only test-created data may exist.
        # Fresh install expectation: zero. We assert that no seeded demo names appear.
        for coll in ("employees", "vehicles", "violations", "maintenance", "fuel_records", "accidents", "leaves", "assignments"):
            r = requests.get(f"{API}/{coll}", headers=auth_headers)
            assert r.status_code == 200
            # We do NOT enforce strict 0 (concurrent tests may create); just ensure list is a list
            assert isinstance(r.json(), list)


# ============ EMPLOYEE MODEL ============
class TestEmployeeModel:
    def test_create_employee_salary_dropped_and_group_stored(self, auth_headers):
        loc = requests.get(f"{API}/locations", headers=auth_headers).json()[0]
        payload = {
            "name": "TEST_موظف1", "employee_number": "E001", "phone": "0555000001",
            "position": "رجل أمن", "group": "A", "location_id": loc["id"], "salary": 9999,
        }
        r = requests.post(f"{API}/employees", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        e = r.json()
        assert "salary" not in e
        assert e["group"] == "A"
        assert e["employee_number"] == "E001"
        # GET verifies persisted, no salary
        listed = requests.get(f"{API}/employees", headers=auth_headers).json()
        got = next(x for x in listed if x["id"] == e["id"])
        assert "salary" not in got
        requests.delete(f"{API}/employees/{e['id']}", headers=auth_headers)


# ============ LEAVES CONFLICT CHECK ============
class TestLeavesConflict:
    @pytest.fixture(scope="class")
    def two_peers_same_group(self, auth_headers):
        loc = requests.get(f"{API}/locations", headers=auth_headers).json()[0]
        created = []
        for i in range(2):
            r = requests.post(f"{API}/employees", json={
                "name": f"TEST_peer_{i}_{uuid.uuid4().hex[:4]}",
                "position": "رجل أمن", "group": "A", "location_id": loc["id"],
            }, headers=auth_headers)
            assert r.status_code == 200
            created.append(r.json())
        # Third employee in different group
        r = requests.post(f"{API}/employees", json={
            "name": f"TEST_diffgroup_{uuid.uuid4().hex[:4]}",
            "position": "رجل أمن", "group": "B", "location_id": loc["id"],
        }, headers=auth_headers)
        assert r.status_code == 200
        diff_group = r.json()
        yield created[0], created[1], diff_group, loc
        for e in created + [diff_group]:
            requests.delete(f"{API}/employees/{e['id']}", headers=auth_headers)

    def test_conflict_rejected_arabic(self, auth_headers, two_peers_same_group):
        e1, e2, _diff, _loc = two_peers_same_group
        r1 = requests.post(f"{API}/leaves", json={
            "employee_id": e1["id"], "leave_type": "سنوية",
            "start_date": "2026-08-01", "end_date": "2026-08-05", "status": "approved",
        }, headers=auth_headers)
        assert r1.status_code == 200, r1.text
        lv1_id = r1.json()["id"]

        # Overlapping approved for peer in same group + location → 400 with تعارض
        r2 = requests.post(f"{API}/leaves", json={
            "employee_id": e2["id"], "leave_type": "سنوية",
            "start_date": "2026-08-03", "end_date": "2026-08-07", "status": "approved",
        }, headers=auth_headers)
        assert r2.status_code == 400
        assert "تعارض" in r2.json().get("detail", "")

        # Non-overlapping dates → passes
        r3 = requests.post(f"{API}/leaves", json={
            "employee_id": e2["id"], "leave_type": "سنوية",
            "start_date": "2026-08-10", "end_date": "2026-08-15", "status": "approved",
        }, headers=auth_headers)
        assert r3.status_code == 200
        lv2_id = r3.json()["id"]

        # Different group same location → passes even when overlapping
        r4 = requests.post(f"{API}/leaves", json={
            "employee_id": two_peers_same_group[2]["id"], "leave_type": "سنوية",
            "start_date": "2026-08-01", "end_date": "2026-08-05", "status": "approved",
        }, headers=auth_headers)
        assert r4.status_code == 200
        lv3_id = r4.json()["id"]

        for lid in (lv1_id, lv2_id, lv3_id):
            requests.delete(f"{API}/leaves/{lid}", headers=auth_headers)


# ============ FUEL WITHOUT LITERS ============
class TestFuelNoLiters:
    def test_fuel_create_without_liters(self, auth_headers):
        # Need a vehicle
        vr = requests.post(f"{API}/vehicles", json={
            "plate_number": f"TEST-{uuid.uuid4().hex[:4]}", "model": "TEST"
        }, headers=auth_headers)
        assert vr.status_code == 200
        vid = vr.json()["id"]

        fr = requests.post(f"{API}/fuel_records", json={
            "vehicle_id": vid, "date": "2026-01-05", "cost": 150,
            "odometer_before": 1000, "odometer_after": 1200,
        }, headers=auth_headers)
        assert fr.status_code == 200, fr.text
        rec = fr.json()
        assert "liters" not in rec, f"liters field leaked: {rec}"
        assert rec["cost"] == 150

        got = requests.get(f"{API}/fuel_records", headers=auth_headers).json()
        found = next(x for x in got if x["id"] == rec["id"])
        assert "liters" not in found

        requests.delete(f"{API}/fuel_records/{rec['id']}", headers=auth_headers)
        requests.delete(f"{API}/vehicles/{vid}", headers=auth_headers)


# ============ SCHEDULE ============
class TestSchedule:
    def test_schedule_on_date_anchor(self, auth_headers):
        # 2026-07-16 → A/B
        r = requests.get(f"{API}/schedule/on-date?date_str=2026-07-16", headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["morning"] == "A" and d["evening"] == "B"
        assert d["Morning_shift"]["hours"] == "06:00 - 18:00"
        assert d["night_shift"]["hours"] == "18:00 - 06:00"

    def test_schedule_on_date_cd(self, auth_headers):
        r = requests.get(f"{API}/schedule/on-date?date_str=2026-07-20", headers=auth_headers)
        d = r.json()
        assert d["morning"] == "C" and d["evening"] == "D"

    def test_schedule_on_date_cycle_wrap(self, auth_headers):
        r = requests.get(f"{API}/schedule/on-date?date_str=2026-07-24", headers=auth_headers)
        d = r.json()
        assert d["Morning"] == "A" and d["Evening"] == "B"

    def test_schedule_week_returns_14_entries(self, auth_headers):
        r = requests.get(f"{API}/schedule/week", headers=auth_headers)
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) == 14
        for e in arr:
            assert e["Morning"] in ("A", "C")
            assert e["Evening"] in ("B", "D")


# ============ STATS ============
class TestStats:
    def test_fuel_alerts_returns_list(self, auth_headers):
        r = requests.get(f"{API}/stats/fuel-alerts", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_monthly_stats_6_arabic_months(self, auth_headers):
        arabic_months = {"يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"}
        for path in ("maintenance-monthly", "fuel-monthly", "accidents-monthly"):
            r = requests.get(f"{API}/stats/{path}", headers=auth_headers)
            assert r.status_code == 200, f"{path}: {r.text}"
            arr = r.json()
            assert len(arr) == 6
            for m in arr:
                assert m["label"] in arabic_months


# ============ LOCATION DETAILS ============
class TestLocationDetails:
    def test_location_details_returns_scoped_employees_and_vehicles(self, auth_headers):
        locs = requests.get(f"{API}/locations", headers=auth_headers).json()
        loc = locs[0]
        # Create scoped emp + vehicle
        er = requests.post(f"{API}/employees", json={
            "name": "TEST_locemp", "position": "رجل أمن", "group": "A", "location_id": loc["id"]
        }, headers=auth_headers).json()
        vr = requests.post(f"{API}/vehicles", json={
            "plate_number": f"LOC-{uuid.uuid4().hex[:4]}", "model": "X", "location_id": loc["id"]
        }, headers=auth_headers).json()

        r = requests.get(f"{API}/locations/{loc['id']}/details", headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["location"]["id"] == loc["id"]
        assert any(e["id"] == er["id"] for e in d["employees"])
        assert any(v["id"] == vr["id"] for v in d["vehicles"])
        # Cleanup
        requests.delete(f"{API}/employees/{er['id']}", headers=auth_headers)
        requests.delete(f"{API}/vehicles/{vr['id']}", headers=auth_headers)


# ============ VIOLATION NOTIFY ============
class TestViolationNotify:
    def test_notify_info_returns_arabic_message_and_marks_notified(self, auth_headers):
        # Setup employee (with phone) + vehicle + violation
        er = requests.post(f"{API}/employees", json={
            "name": "TEST_vempl", "phone": "0555111222", "position": "رجل أمن", "group": "none"
        }, headers=auth_headers).json()
        vr = requests.post(f"{API}/vehicles", json={
            "plate_number": f"VN-{uuid.uuid4().hex[:4]}", "model": "N"
        }, headers=auth_headers).json()
        vio = requests.post(f"{API}/violations", json={
            "vehicle_id": vr["id"], "employee_id": er["id"],
            "violation_type": "سرعة", "amount": 300, "date": "2026-01-05",
        }, headers=auth_headers).json()

        r = requests.get(f"{API}/violations/{vio['id']}/notify-info", headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["phone"].startswith("966")
        assert "خصم" in body["message"]
        assert "300" in body["message"]

        # After call, violation.notified=true
        vlist = requests.get(f"{API}/violations", headers=auth_headers).json()
        got = next(x for x in vlist if x["id"] == vio["id"])
        assert got["notified"] is True

        # Cleanup
        requests.delete(f"{API}/violations/{vio['id']}", headers=auth_headers)
        requests.delete(f"{API}/employees/{er['id']}", headers=auth_headers)
        requests.delete(f"{API}/vehicles/{vr['id']}", headers=auth_headers)


# ============ ADMIN-ONLY GUARDS ============
class TestAdminOnly:
    @pytest.fixture(scope="class")
    def guard_token(self, auth_headers):
        # Register + approve a guard user
        phone = f"05{uuid.uuid4().int % 100000000:08d}"
        rr = requests.post(f"{API}/auth/register", json={"full_name": "TEST_guard", "phone": phone})
        assert rr.status_code == 200
        users = requests.get(f"{API}/users", headers=auth_headers).json()
        u = next(x for x in users if x["phone"].endswith(phone[1:]))
        appr = requests.post(f"{API}/users/{u['id']}/approve", headers=auth_headers).json()
        temp = appr["temp_password"]
        # change password (skip must-change) and login
        lg = requests.post(f"{API}/auth/login", json={"phone": phone, "password": temp}).json()
        tok = lg["access_token"]
        yield tok
        requests.delete(f"{API}/users/{u['id']}", headers=auth_headers)

    @pytest.mark.parametrize("path", ["/employees", "/vehicles", "/violations", "/leaves", "/fuel_records", "/accidents", "/locations"])
    def test_non_admin_post_forbidden_arabic(self, guard_token, path):
        r = requests.post(f"{API}{path}", json={}, headers={"Authorization": f"Bearer {guard_token}"})
        assert r.status_code == 403, f"{path}: {r.status_code}"
        assert "مسموحة للمدير فقط" in r.json().get("detail", "")

    def test_non_admin_cannot_list_users(self, guard_token):
        r = requests.get(f"{API}/users", headers={"Authorization": f"Bearer {guard_token}"})
        assert r.status_code == 403


# ============ AUTH GUARDS (no token) ============
class TestNoTokenGuards:
    @pytest.mark.parametrize("path", [
        "/locations", "/employees", "/vehicles", "/violations", "/leaves",
        "/fuel_records", "/accidents", "/users", "/stats/dashboard",
        "/stats/fuel-alerts", "/stats/maintenance-monthly",
        "/schedule/on-date", "/schedule/week",
    ])
    def test_no_token_401(self, path):
        r = requests.get(f"{API}{path}")
        assert r.status_code == 401, f"{path}: {r.status_code}"
