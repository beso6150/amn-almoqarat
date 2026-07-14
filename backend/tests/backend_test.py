"""Backend tests for Medan (Arabic field-work management) API."""
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
    if r.status_code != 200:
        # register instead
        r = requests.post(f"{API}/auth/register", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "full_name": "مسؤول ميدان"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ============ AUTH ============
class TestAuth:
    def test_register_new_user(self):
        email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "full_name": "TEST User"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == email
        assert data["user"]["full_name"] == "TEST User"

    def test_login_success(self, admin_token):
        assert admin_token and len(admin_token) > 20

    def test_login_wrong_password_returns_401_arabic(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401
        detail = r.json().get("detail", "")
        # Should contain Arabic characters
        assert any("\u0600" <= c <= "\u06FF" for c in detail), f"Not Arabic: {detail}"

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)

    def test_me_returns_user(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == ADMIN_EMAIL
        assert "_id" not in u
        assert "hashed_password" not in u


# ============ PROTECTED ROUTES ============
class TestProtected:
    @pytest.mark.parametrize("path", [
        "/locations", "/employees", "/vehicles",
        "/maintenance", "/violations", "/leaves",
        "/stats/dashboard", "/stats/violations-monthly",
        "/stats/violations-by-vehicle", "/stats/maintenance-status",
    ])
    def test_endpoint_requires_auth(self, path):
        r = requests.get(f"{API}{path}")
        assert r.status_code == 401, f"{path} returned {r.status_code}"


# ============ SEED ============
class TestSeed:
    def test_seed_idempotent(self, auth_headers):
        r = requests.post(f"{API}/seed", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert "seeded" in body
        # Either seeded now or already seeded before
        # Second call must return seeded=false
        r2 = requests.post(f"{API}/seed", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["seeded"] is False

    def test_seed_produced_expected_counts(self, auth_headers):
        locs = requests.get(f"{API}/locations", headers=auth_headers).json()
        emps = requests.get(f"{API}/employees", headers=auth_headers).json()
        vehs = requests.get(f"{API}/vehicles", headers=auth_headers).json()
        maints = requests.get(f"{API}/maintenance", headers=auth_headers).json()
        viols = requests.get(f"{API}/violations", headers=auth_headers).json()
        leaves = requests.get(f"{API}/leaves", headers=auth_headers).json()
        assert len(locs) >= 3
        assert len(emps) >= 4
        assert len(vehs) >= 4
        assert len(maints) >= 6
        assert len(viols) >= 7
        assert len(leaves) >= 3
        # No _id fields
        for arr in (locs, emps, vehs, maints, viols, leaves):
            for doc in arr:
                assert "_id" not in doc


# ============ CRUD (locations as representative) ============
class TestLocationsCRUD:
    def test_full_crud_cycle(self, auth_headers):
        create_payload = {"name": "TEST_موقع اختبار", "address": "TEST address", "phone": "0500000000", "manager": "TEST manager"}
        r = requests.post(f"{API}/locations", json=create_payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["name"] == create_payload["name"]
        assert "id" in created
        assert "_id" not in created
        loc_id = created["id"]

        # GET verify persistence
        r = requests.get(f"{API}/locations", headers=auth_headers)
        assert any(l["id"] == loc_id for l in r.json())

        # UPDATE
        upd = {**create_payload, "name": "TEST_موقع محدث"}
        r = requests.put(f"{API}/locations/{loc_id}", json=upd, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_موقع محدث"

        # DELETE
        r = requests.delete(f"{API}/locations/{loc_id}", headers=auth_headers)
        assert r.status_code == 200
        # verify not present
        r = requests.get(f"{API}/locations", headers=auth_headers)
        assert not any(l["id"] == loc_id for l in r.json())


class TestVehiclesCRUD:
    def test_create_and_delete(self, auth_headers):
        payload = {"plate_number": "TEST 0001", "model": "TEST model", "year": 2024, "color": "أحمر", "status": "active"}
        r = requests.post(f"{API}/vehicles", json=payload, headers=auth_headers)
        assert r.status_code == 200
        vid = r.json()["id"]
        r = requests.delete(f"{API}/vehicles/{vid}", headers=auth_headers)
        assert r.status_code == 200


# ============ STATS ============
class TestStats:
    def test_dashboard_shape(self, auth_headers):
        r = requests.get(f"{API}/stats/dashboard", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for key in ["total_vehicles", "active_vehicles", "in_maintenance",
                    "total_employees", "total_locations", "unpaid_violations",
                    "unpaid_amount", "active_leaves", "upcoming_maintenance",
                    "maintenance_cost_year"]:
            assert key in d, f"missing {key}"
            assert isinstance(d[key], (int, float))

    def test_violations_monthly_returns_6_months(self, auth_headers):
        r = requests.get(f"{API}/stats/violations-monthly", headers=auth_headers)
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) == 6
        arabic_months = {"يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"}
        for m in arr:
            assert m["label"] in arabic_months, f"Non-Arabic: {m['label']}"
            assert "count" in m and "amount" in m

    def test_violations_by_vehicle(self, auth_headers):
        r = requests.get(f"{API}/stats/violations-by-vehicle", headers=auth_headers)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        if arr:
            assert "plate" in arr[0]
            assert "count" in arr[0]
            assert "amount" in arr[0]

    def test_maintenance_status(self, auth_headers):
        r = requests.get(f"{API}/stats/maintenance-status", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("completed", "pending", "upcoming"):
            assert k in d
