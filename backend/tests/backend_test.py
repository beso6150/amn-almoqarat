"""Backend tests for Medan (Arabic field-work management) API - iteration 2.
Covers new features: roles, approval flow, new resources (fuel, accidents, assignments), vehicle history, new stats.
"""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@medan.sa"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    body = r.json()
    assert body.get("user", {}).get("role") == "admin"
    assert body.get("user", {}).get("status") == "approved"
    return body["access_token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# Register + login for a pending guard user (used across role tests)
@pytest.fixture(scope="session")
def pending_user():
    email = f"TEST_pending_{uuid.uuid4().hex[:6]}@example.com"
    pw = "pass1234"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": pw, "full_name": "TEST Pending"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "password": pw, "register_response": data}


# ============ AUTH & APPROVAL FLOW ============
class TestAuthApprovalFlow:
    def test_admin_login_still_works(self, admin_token):
        assert admin_token and len(admin_token) > 20

    def test_new_registration_is_pending_no_token(self, pending_user):
        data = pending_user["register_response"]
        assert data.get("pending") is True
        assert "access_token" not in data
        # Arabic message
        assert any("\u0600" <= c <= "\u06FF" for c in data.get("message", ""))

    def test_pending_user_login_blocked_403_arabic(self, pending_user):
        r = requests.post(f"{API}/auth/login", json={"email": pending_user["email"], "password": pending_user["password"]})
        assert r.status_code == 403, r.text
        assert any("\u0600" <= c <= "\u06FF" for c in r.json().get("detail", ""))

    def test_wrong_password_returns_401_arabic(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401
        assert any("\u0600" <= c <= "\u06FF" for c in r.json().get("detail", ""))

    def test_me_returns_admin_role(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == ADMIN_EMAIL
        assert u.get("role") == "admin"
        assert u.get("status") == "approved"
        assert "_id" not in u and "hashed_password" not in u


# ============ USER MANAGEMENT ============
class TestUserManagement:
    def test_admin_lists_users(self, auth_headers):
        r = requests.get(f"{API}/users", headers=auth_headers)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 1
        for u in users:
            assert "_id" not in u
            assert "hashed_password" not in u

    def test_admin_lists_pending_users(self, auth_headers, pending_user):
        r = requests.get(f"{API}/users/pending", headers=auth_headers)
        assert r.status_code == 200
        pend = r.json()
        assert any(u["email"] == pending_user["email"] for u in pend)

    def test_non_admin_cannot_list_users(self, auth_headers, pending_user):
        # Approve pending user first, then login, then try
        users = requests.get(f"{API}/users", headers=auth_headers).json()
        target = next(u for u in users if u["email"] == pending_user["email"])
        # Approve as guard
        r = requests.put(f"{API}/users/{target['id']}", json={"status": "approved", "role": "guard"}, headers=auth_headers)
        assert r.status_code == 200
        # Login guard
        lg = requests.post(f"{API}/auth/login", json={"email": pending_user["email"], "password": pending_user["password"]})
        assert lg.status_code == 200
        guard_token = lg.json()["access_token"]
        gh = {"Authorization": f"Bearer {guard_token}", "Content-Type": "application/json"}

        # Non-admin GET /users → 403
        r = requests.get(f"{API}/users", headers=gh)
        assert r.status_code == 403
        r = requests.get(f"{API}/users/pending", headers=gh)
        assert r.status_code == 403

        # Non-admin cannot POST/PUT/DELETE CRUD collections
        for path in ("/locations", "/employees", "/vehicles", "/maintenance",
                     "/violations", "/leaves", "/fuel_records", "/accidents", "/assignments"):
            # POST forbidden
            r = requests.post(f"{API}{path}", json={}, headers=gh)
            assert r.status_code == 403, f"non-admin POST {path} = {r.status_code}"
            # GET allowed
            r = requests.get(f"{API}{path}", headers=gh)
            assert r.status_code == 200, f"non-admin GET {path} = {r.status_code}"

        # Save token/id for later
        pytest.guard_token = guard_token
        pytest.guard_id = target["id"]

    def test_admin_cannot_demote_self(self, auth_headers):
        me = requests.get(f"{API}/auth/me", headers=auth_headers).json()
        r = requests.put(f"{API}/users/{me['id']}", json={"role": "guard"}, headers=auth_headers)
        assert r.status_code == 400

    def test_admin_cannot_delete_self(self, auth_headers):
        me = requests.get(f"{API}/auth/me", headers=auth_headers).json()
        r = requests.delete(f"{API}/users/{me['id']}", headers=auth_headers)
        assert r.status_code == 400

    def test_admin_deletes_other_user(self, auth_headers):
        # Delete the guard from earlier
        gid = getattr(pytest, "guard_id", None)
        if not gid:
            pytest.skip("no guard user to delete")
        r = requests.delete(f"{API}/users/{gid}", headers=auth_headers)
        assert r.status_code == 200


# ============ SEED / EMPLOYEE MODEL ============
class TestSeedAndModels:
    def test_seed_idempotent(self, auth_headers):
        r = requests.post(f"{API}/seed", headers=auth_headers)
        assert r.status_code == 200
        r2 = requests.post(f"{API}/seed", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["seeded"] is False

    def test_employees_have_no_salary_field(self, auth_headers):
        r = requests.get(f"{API}/employees", headers=auth_headers)
        assert r.status_code == 200
        emps = r.json()
        assert len(emps) >= 4
        for e in emps:
            assert "salary" not in e, f"employee still has salary field: {e}"
            assert "employee_number" in e, "missing employee_number"
            assert "_id" not in e


# ============ NEW RESOURCES CRUD ============
class TestNewResourcesCRUD:
    @pytest.fixture(scope="class")
    def a_vehicle_and_emp(self, auth_headers):
        v = requests.get(f"{API}/vehicles", headers=auth_headers).json()[0]
        e = requests.get(f"{API}/employees", headers=auth_headers).json()[0]
        return v["id"], e["id"]

    def test_fuel_records_crud(self, auth_headers, a_vehicle_and_emp):
        vid, eid = a_vehicle_and_emp
        payload = {"vehicle_id": vid, "employee_id": eid, "date": "2025-01-15",
                   "liters": 30.0, "cost": 90, "odometer_before": 1000, "odometer_after": 1300}
        r = requests.post(f"{API}/fuel_records", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        fid = r.json()["id"]
        assert "_id" not in r.json()
        # GET and verify present
        arr = requests.get(f"{API}/fuel_records", headers=auth_headers).json()
        assert any(x["id"] == fid for x in arr)
        # DELETE
        r = requests.delete(f"{API}/fuel_records/{fid}", headers=auth_headers)
        assert r.status_code == 200

    def test_accidents_crud(self, auth_headers, a_vehicle_and_emp):
        vid, eid = a_vehicle_and_emp
        payload = {"vehicle_id": vid, "employee_id": eid, "date": "2025-01-10",
                   "description": "TEST accident", "fault_percentage": 50, "cost": 500,
                   "status": "open", "photos": []}
        r = requests.post(f"{API}/accidents", json=payload, headers=auth_headers)
        assert r.status_code == 200
        aid = r.json()["id"]
        assert "_id" not in r.json()
        arr = requests.get(f"{API}/accidents", headers=auth_headers).json()
        assert any(x["id"] == aid for x in arr)
        r = requests.delete(f"{API}/accidents/{aid}", headers=auth_headers)
        assert r.status_code == 200

    def test_assignments_crud(self, auth_headers, a_vehicle_and_emp):
        vid, eid = a_vehicle_and_emp
        payload = {"vehicle_id": vid, "employee_id": eid, "start_date": "2025-01-01"}
        r = requests.post(f"{API}/assignments", json=payload, headers=auth_headers)
        assert r.status_code == 200
        aid = r.json()["id"]
        r = requests.delete(f"{API}/assignments/{aid}", headers=auth_headers)
        assert r.status_code == 200


# ============ STATS ============
class TestStats:
    def test_dashboard_new_fields(self, auth_headers):
        r = requests.get(f"{API}/stats/dashboard", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        expected = ["total_vehicles", "active_vehicles", "in_maintenance",
                    "total_employees", "total_locations", "unpaid_violations",
                    "unpaid_amount", "active_leaves", "upcoming_maintenance",
                    "maintenance_cost_year", "open_accidents", "pending_users",
                    "fuel_cost_year", "fuel_liters_year", "fuel_count_year",
                    "accident_cost_year"]
        for k in expected:
            assert k in d, f"missing key {k}"
            assert isinstance(d[k], (int, float)), f"{k} not numeric"

    def test_fuel_monthly(self, auth_headers):
        r = requests.get(f"{API}/stats/fuel-monthly", headers=auth_headers)
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) == 6
        arabic_months = {"يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"}
        for m in arr:
            assert m["label"] in arabic_months
            for k in ("liters", "cost", "count"):
                assert k in m

    def test_fuel_by_vehicle(self, auth_headers):
        r = requests.get(f"{API}/stats/fuel-by-vehicle", headers=auth_headers)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        if arr:
            for k in ("vehicle_id", "plate", "count", "liters", "cost", "distance", "consumption_l_100km"):
                assert k in arr[0]

    def test_accidents_summary(self, auth_headers):
        r = requests.get(f"{API}/stats/accidents-summary", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "open", "closed", "total_cost", "average_fault"):
            assert k in d


# ============ VEHICLE HISTORY ============
class TestVehicleHistory:
    def test_history_returns_full_shape(self, auth_headers):
        v = requests.get(f"{API}/vehicles", headers=auth_headers).json()[0]
        r = requests.get(f"{API}/vehicles/{v['id']}/history", headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("vehicle", "maintenance", "violations", "fuel_records", "accidents", "assignments", "totals"):
            assert k in d, f"missing {k}"
        for k in ("maintenance_cost", "violations_amount", "fuel_cost", "accident_cost", "grand_total"):
            assert k in d["totals"]
        # No _id leaks
        assert "_id" not in d["vehicle"]
        for arr_key in ("maintenance", "violations", "fuel_records", "accidents", "assignments"):
            for item in d[arr_key]:
                assert "_id" not in item

    def test_history_404_for_missing(self, auth_headers):
        r = requests.get(f"{API}/vehicles/nonexistent-id/history", headers=auth_headers)
        assert r.status_code == 404


# ============ AUTH GUARDS ============
class TestAuthGuards:
    @pytest.mark.parametrize("path", [
        "/locations", "/employees", "/vehicles",
        "/maintenance", "/violations", "/leaves",
        "/fuel_records", "/accidents", "/assignments",
        "/users", "/users/pending",
        "/stats/dashboard", "/stats/fuel-monthly",
        "/stats/fuel-by-vehicle", "/stats/accidents-summary",
    ])
    def test_no_token_returns_401(self, path):
        r = requests.get(f"{API}{path}")
        assert r.status_code == 401, f"{path} returned {r.status_code}"
