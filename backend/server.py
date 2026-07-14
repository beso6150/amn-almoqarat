from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, secrets, string, re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta, date
from passlib.context import CryptContext
from jose import jwt, JWTError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

SECRET_KEY = os.environ.get("JWT_SECRET", "medan-field-work-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

app = FastAPI()
api_router = APIRouter(prefix="/api")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    return pwd_context.verify(pw, hashed)


def normalize_phone(phone: str) -> str:
    """Normalize Saudi phone number to E.164-ish digits: 05x... => 9665x..., +9665x => 9665x"""
    if not phone:
        return ""
    digits = re.sub(r"[^0-9]", "", phone)
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("966"):
        return digits
    if digits.startswith("0"):
        digits = digits[1:]
        return "966" + digits
    if digits.startswith("5") and len(digits) == 9:
        return "966" + digits
    return digits


def gen_temp_password(length: int = 8) -> str:
    """Generate a memorable temp password: 4 letters + 4 digits."""
    letters = string.ascii_uppercase.replace("O", "").replace("I", "").replace("L", "")
    digits = string.digits.replace("0", "").replace("1", "")
    return "".join(secrets.choice(letters) for _ in range(4)) + "".join(secrets.choice(digits) for _ in range(4))


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)):
    if creds is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0, "temp_password_plain": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("status") != "approved":
        raise HTTPException(status_code=403, detail="حسابك بانتظار موافقة المدير")
    return user


def require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="هذه العملية مسموحة للمدير فقط")
    return user


# ============ SCHEDULE ============
# Cycle: 8 days. Anchor = Thursday 2026-07-16 (day 0)
# Days 0..3: A day-shift (06-18), B night-shift (18-06)
# Days 4..7: C day-shift (06-18), D night-shift (18-06)
SCHEDULE_ANCHOR = date(2026, 7, 16)

def groups_for_date(d: date) -> dict:
    diff = (d - SCHEDULE_ANCHOR).days
    pos = diff % 8
    if pos < 0:
        pos += 8
    if pos < 4:
        return {"day": "A", "night": "B", "cycle_pos": pos, "cycle_of": "AB"}
    return {"day": "C", "night": "D", "cycle_pos": pos - 4, "cycle_of": "CD"}


# ============ MODELS ============
class UserRegister(BaseModel):
    full_name: str
    phone: str

class UserLoginPhone(BaseModel):
    phone: str
    password: str

class ChangePassword(BaseModel):
    new_password: str

class AdminSetup(BaseModel):
    """First-time admin setup with custom password"""
    full_name: str
    phone: str
    password: str


class Location(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    region: Optional[str] = "مكة"
    phone: Optional[str] = ""
    manager: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)

class LocationCreate(BaseModel):
    name: str
    address: str
    region: Optional[str] = "مكة"
    phone: Optional[str] = ""
    manager: Optional[str] = ""


VALID_GROUPS = ["A", "B", "C", "D", "none"]
VALID_POSITIONS = ["رجل أمن", "مشرف أمن", "مدير عمليات"]

class Employee(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    employee_number: Optional[str] = ""
    national_id: Optional[str] = ""
    phone: Optional[str] = ""
    position: Optional[str] = "رجل أمن"
    group: Optional[str] = "none"
    location_id: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)

class EmployeeCreate(BaseModel):
    name: str
    employee_number: Optional[str] = ""
    national_id: Optional[str] = ""
    phone: Optional[str] = ""
    position: Optional[str] = "رجل أمن"
    group: Optional[str] = "none"
    location_id: Optional[str] = None


class Vehicle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    plate_number: str
    model: str
    year: Optional[int] = None
    color: Optional[str] = ""
    location_id: Optional[str] = None
    driver_id: Optional[str] = None
    status: str = "active"
    photo: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)

class VehicleCreate(BaseModel):
    plate_number: str
    model: str
    year: Optional[int] = None
    color: Optional[str] = ""
    location_id: Optional[str] = None
    driver_id: Optional[str] = None
    status: str = "active"
    photo: Optional[str] = ""


class Maintenance(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_id: str
    employee_id: Optional[str] = None
    maintenance_type: str
    description: Optional[str] = ""
    cost: float = 0
    date: str
    status: str = "completed"
    next_due_date: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)

class MaintenanceCreate(BaseModel):
    vehicle_id: str
    employee_id: Optional[str] = None
    maintenance_type: str
    description: Optional[str] = ""
    cost: float = 0
    date: str
    status: str = "completed"
    next_due_date: Optional[str] = None


class Violation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_id: str
    employee_id: Optional[str] = None
    violation_type: str
    amount: float
    date: str
    location: Optional[str] = ""
    status: str = "unpaid"
    photo: Optional[str] = ""
    notes: Optional[str] = ""
    notified: bool = False
    created_at: str = Field(default_factory=now_iso)

class ViolationCreate(BaseModel):
    vehicle_id: str
    employee_id: Optional[str] = None
    violation_type: str
    amount: float
    date: str
    location: Optional[str] = ""
    status: str = "unpaid"
    photo: Optional[str] = ""
    notes: Optional[str] = ""


class Leave(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    leave_type: str = "سنوية"
    start_date: str
    end_date: str
    reason: Optional[str] = ""
    status: str = "approved"
    created_at: str = Field(default_factory=now_iso)

class LeaveCreate(BaseModel):
    employee_id: str
    leave_type: str = "سنوية"
    start_date: str
    end_date: str
    reason: Optional[str] = ""
    status: str = "approved"


class FuelRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_id: str
    employee_id: Optional[str] = None
    date: str
    cost: float = 0
    odometer_before: Optional[float] = 0
    odometer_after: Optional[float] = 0
    photo_before: Optional[str] = ""
    photo_after: Optional[str] = ""
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)

class FuelRecordCreate(BaseModel):
    vehicle_id: str
    employee_id: Optional[str] = None
    date: str
    cost: float = 0
    odometer_before: Optional[float] = 0
    odometer_after: Optional[float] = 0
    photo_before: Optional[str] = ""
    photo_after: Optional[str] = ""
    notes: Optional[str] = ""


class Accident(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_id: str
    employee_id: Optional[str] = None
    date: str
    description: str
    fault_percentage: float = 0
    cost: float = 0
    status: str = "open"
    location: Optional[str] = ""
    photos: List[str] = Field(default_factory=list)
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)

class AccidentCreate(BaseModel):
    vehicle_id: str
    employee_id: Optional[str] = None
    date: str
    description: str
    fault_percentage: float = 0
    cost: float = 0
    status: str = "open"
    location: Optional[str] = ""
    photos: List[str] = Field(default_factory=list)
    notes: Optional[str] = ""


class Assignment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_id: str
    employee_id: str
    start_date: str
    end_date: Optional[str] = None
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)

class AssignmentCreate(BaseModel):
    vehicle_id: str
    employee_id: str
    start_date: str
    end_date: Optional[str] = None
    notes: Optional[str] = ""


# ============ SEED LOCATIONS (idempotent, real data only) ============
REAL_LOCATIONS = [
    {"name": "المبنى الرئيسي", "address": "المنطقة مكة، حي الزايدي"},
    {"name": "المركز العام للنقل", "address": "المنطقة مكة، حي الخالدية"},
    {"name": "المجلس التنسيقي", "address": "المنطقة مكة، المشاعر المقدسة"},
    {"name": "مبنى منى", "address": "المنطقة مكة، المشاعر المقدسة"},
    {"name": "المنطقة المركزية", "address": "المنطقة مكة المكرمة، بجوار الحرم"},
]

async def ensure_real_locations():
    for loc in REAL_LOCATIONS:
        existing = await db.locations.find_one({"name": loc["name"]})
        if not existing:
            item = Location(name=loc["name"], address=loc["address"])
            await db.locations.insert_one(item.dict())


# ============ AUTH ============
@api_router.post("/auth/admin-setup")
async def admin_setup(body: AdminSetup):
    """First-time setup: creates the initial admin. Only works if no user exists."""
    if await db.users.count_documents({}) > 0:
        raise HTTPException(status_code=400, detail="تم إعداد المدير مسبقاً")
    phone = normalize_phone(body.phone)
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="رقم الجوال غير صحيح")
    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id,
        "full_name": body.full_name,
        "phone": phone,
        "hashed_password": hash_password(body.password),
        "role": "admin",
        "status": "approved",
        "must_change_password": False,
        "created_at": now_iso(),
    })
    await ensure_real_locations()
    token = create_access_token(user_id)
    return {"access_token": token, "user": {"id": user_id, "full_name": body.full_name, "phone": phone, "role": "admin", "status": "approved", "must_change_password": False}}


@api_router.post("/auth/register")
async def register(body: UserRegister):
    """Request an account: only phone + name. Admin will approve and issue temp password."""
    phone = normalize_phone(body.phone)
    if len(phone) < 10:
        raise HTTPException(status_code=400, detail="رقم الجوال غير صحيح")
    existing = await db.users.find_one({"phone": phone})
    if existing:
        raise HTTPException(status_code=400, detail="رقم الجوال مسجل مسبقاً")

    is_first = (await db.users.count_documents({}) == 0)
    if is_first:
        # Bootstrap: first ever user becomes admin without password (they must call /auth/admin-setup)
        raise HTTPException(status_code=400, detail="يجب إعداد حساب المدير أولاً")

    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id,
        "full_name": body.full_name,
        "phone": phone,
        "hashed_password": "",
        "role": "guard",
        "status": "pending",
        "must_change_password": True,
        "created_at": now_iso(),
    })
    return {"pending": True, "message": "تم استلام طلبك. سيتم إشعار المدير للموافقة وإرسال كلمة المرور عبر واتساب."}


@api_router.post("/auth/login")
async def login(body: UserLoginPhone):
    phone = normalize_phone(body.phone)
    user = await db.users.find_one({"phone": phone})
    if not user or not user.get("hashed_password") or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة")
    if user.get("status") == "pending":
        raise HTTPException(status_code=403, detail="حسابك بانتظار موافقة المدير")
    if user.get("status") == "rejected":
        raise HTTPException(status_code=403, detail="تم رفض حسابك. تواصل مع المدير")
    token = create_access_token(user["id"])
    return {
        "access_token": token,
        "user": {
            "id": user["id"], "phone": user["phone"], "full_name": user["full_name"],
            "role": user.get("role", "guard"), "status": user.get("status", "approved"),
            "must_change_password": user.get("must_change_password", False),
        },
    }


@api_router.get("/auth/status")
async def auth_status():
    """Check if admin exists — used by frontend to decide onboarding vs login."""
    count = await db.users.count_documents({})
    return {"admin_exists": count > 0}


@api_router.get("/auth/me")
async def me(current_user: dict = Depends(get_current_user)):
    return current_user


@api_router.post("/auth/change-password")
async def change_password(body: ChangePassword, current_user: dict = Depends(get_current_user)):
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="كلمة المرور يجب ألا تقل عن 6 أحرف")
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"hashed_password": hash_password(body.new_password), "must_change_password": False}}
    )
    return {"ok": True}


# ============ USER MGMT (admin only) ============
@api_router.get("/users")
async def list_users(current_user: dict = Depends(require_admin)):
    return await db.users.find({}, {"_id": 0, "hashed_password": 0, "temp_password_plain": 0}).to_list(1000)

@api_router.get("/users/pending")
async def pending_users(current_user: dict = Depends(require_admin)):
    return await db.users.find({"status": "pending"}, {"_id": 0, "hashed_password": 0, "temp_password_plain": 0}).to_list(1000)


@api_router.post("/users/{uid}/approve")
async def approve_user(uid: str, current_user: dict = Depends(require_admin)):
    """Approves user + issues a one-time password. Returns the plaintext password (once) so admin can share via WhatsApp."""
    u = await db.users.find_one({"id": uid})
    if not u:
        raise HTTPException(404, "المستخدم غير موجود")
    temp = gen_temp_password()
    await db.users.update_one({"id": uid}, {"$set": {
        "hashed_password": hash_password(temp),
        "status": "approved",
        "must_change_password": True,
    }})
    return {"ok": True, "temp_password": temp, "phone": u["phone"], "full_name": u["full_name"]}


@api_router.post("/users/{uid}/reset-password")
async def reset_password(uid: str, current_user: dict = Depends(require_admin)):
    u = await db.users.find_one({"id": uid})
    if not u:
        raise HTTPException(404, "المستخدم غير موجود")
    temp = gen_temp_password()
    await db.users.update_one({"id": uid}, {"$set": {
        "hashed_password": hash_password(temp),
        "must_change_password": True,
    }})
    return {"ok": True, "temp_password": temp, "phone": u["phone"], "full_name": u["full_name"]}


class UserPatch(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None

@api_router.put("/users/{uid}")
async def update_user(uid: str, body: UserPatch, current_user: dict = Depends(require_admin)):
    if uid == current_user["id"] and body.role and body.role != "admin":
        raise HTTPException(status_code=400, detail="لا يمكنك تغيير دورك كمدير")
    update = {}
    if body.role and body.role in ("admin", "supervisor", "guard"):
        update["role"] = body.role
    if body.status and body.status in ("pending", "approved", "rejected"):
        update["status"] = body.status
    if not update:
        raise HTTPException(status_code=400, detail="لا يوجد تغيير")
    await db.users.update_one({"id": uid}, {"$set": update})
    return await db.users.find_one({"id": uid}, {"_id": 0, "hashed_password": 0, "temp_password_plain": 0})

@api_router.delete("/users/{uid}")
async def delete_user(uid: str, current_user: dict = Depends(require_admin)):
    if uid == current_user["id"]:
        raise HTTPException(status_code=400, detail="لا يمكنك حذف نفسك")
    await db.users.delete_one({"id": uid})
    return {"ok": True}


# ============ CRUD helper ============
def _crud(coll_name: str, model, model_create):
    async def list_all(current_user: dict = Depends(get_current_user)):
        sort_field = "created_at"
        if coll_name in ("maintenance", "violations", "fuel_records", "accidents"):
            sort_field = "date"
        return await db[coll_name].find({}, {"_id": 0}).sort(sort_field, -1).to_list(2000)

    async def create_one(body: model_create, current_user: dict = Depends(require_admin)):  # type: ignore
        item = model(**body.dict())
        await db[coll_name].insert_one(item.dict())
        return item

    async def update_one(item_id: str, body: model_create, current_user: dict = Depends(require_admin)):  # type: ignore
        await db[coll_name].update_one({"id": item_id}, {"$set": body.dict()})
        doc = await db[coll_name].find_one({"id": item_id}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "غير موجود")
        return doc

    async def delete_one(item_id: str, current_user: dict = Depends(require_admin)):
        await db[coll_name].delete_one({"id": item_id})
        return {"ok": True}

    return list_all, create_one, update_one, delete_one


# Note: we don't auto-register leaves through the helper because it needs conflict-check.
for _name, _model, _mc in [
    ("locations", Location, LocationCreate),
    ("employees", Employee, EmployeeCreate),
    ("vehicles", Vehicle, VehicleCreate),
    ("maintenance", Maintenance, MaintenanceCreate),
    ("violations", Violation, ViolationCreate),
    ("fuel_records", FuelRecord, FuelRecordCreate),
    ("accidents", Accident, AccidentCreate),
    ("assignments", Assignment, AssignmentCreate),
]:
    _list, _create, _update, _delete = _crud(_name, _model, _mc)
    api_router.add_api_route(f"/{_name}", _list, methods=["GET"])
    api_router.add_api_route(f"/{_name}", _create, methods=["POST"])
    api_router.add_api_route(f"/{_name}/{{item_id}}", _update, methods=["PUT"])
    api_router.add_api_route(f"/{_name}/{{item_id}}", _delete, methods=["DELETE"])


# ============ LEAVES with conflict check ============
@api_router.get("/leaves", response_model=List[Leave])
async def list_leaves(current_user: dict = Depends(get_current_user)):
    return await db.leaves.find({}, {"_id": 0}).sort("start_date", -1).to_list(2000)

def _dates_overlap(a_start: str, a_end: str, b_start: str, b_end: str) -> bool:
    return not (a_end < b_start or a_start > b_end)

async def _check_leave_conflict(employee_id: str, start_date: str, end_date: str, exclude_id: Optional[str] = None):
    emp = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    if not emp:
        raise HTTPException(400, "الموظف غير موجود")
    if not emp.get("location_id") or not emp.get("group") or emp.get("group") == "none":
        return  # employee not tied to a group/location — no conflict check
    same_peers = await db.employees.find({
        "location_id": emp["location_id"],
        "group": emp["group"],
        "id": {"$ne": employee_id},
    }, {"_id": 0, "id": 1, "name": 1}).to_list(500)
    peer_ids = [p["id"] for p in same_peers]
    if not peer_ids:
        return
    query = {"employee_id": {"$in": peer_ids}, "status": "approved"}
    if exclude_id:
        query["id"] = {"$ne": exclude_id}
    async for lv in db.leaves.find(query, {"_id": 0}):
        if _dates_overlap(start_date, end_date, lv["start_date"], lv["end_date"]):
            conflict_emp = next((p["name"] for p in same_peers if p["id"] == lv["employee_id"]), "زميل")
            raise HTTPException(400, detail=f"يوجد تعارض: الموظف {conflict_emp} في نفس المجموعة والمقر لديه إجازة معتمدة تتقاطع مع هذه الفترة")

@api_router.post("/leaves", response_model=Leave)
async def create_leave(body: LeaveCreate, current_user: dict = Depends(require_admin)):
    if body.status == "approved":
        await _check_leave_conflict(body.employee_id, body.start_date, body.end_date)
    lv = Leave(**body.dict())
    await db.leaves.insert_one(lv.dict())
    return lv

@api_router.put("/leaves/{lv_id}", response_model=Leave)
async def update_leave(lv_id: str, body: LeaveCreate, current_user: dict = Depends(require_admin)):
    if body.status == "approved":
        await _check_leave_conflict(body.employee_id, body.start_date, body.end_date, exclude_id=lv_id)
    await db.leaves.update_one({"id": lv_id}, {"$set": body.dict()})
    doc = await db.leaves.find_one({"id": lv_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "غير موجود")
    return doc

@api_router.delete("/leaves/{lv_id}")
async def delete_leave(lv_id: str, current_user: dict = Depends(require_admin)):
    await db.leaves.delete_one({"id": lv_id})
    return {"ok": True}


# ============ STATS ============
def year_month_prefix(y, m):
    return f"{y:04d}-{m:02d}"

def last_6_months():
    now = datetime.now(timezone.utc)
    months = []
    for i in range(5, -1, -1):
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        months.append((year, month))
    return months

AR_MONTHS = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]

@api_router.get("/stats/dashboard")
async def dashboard_stats(current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    total_vehicles = await db.vehicles.count_documents({})
    active_vehicles = await db.vehicles.count_documents({"status": "active"})
    in_maintenance = await db.vehicles.count_documents({"status": "maintenance"})
    total_employees = await db.employees.count_documents({})
    total_locations = await db.locations.count_documents({})
    unpaid_violations = await db.violations.count_documents({"status": "unpaid"})
    open_accidents = await db.accidents.count_documents({"status": "open"})
    pending_users = await db.users.count_documents({"status": "pending"})

    unpaid_amount = 0
    async for v in db.violations.find({"status": "unpaid"}, {"_id": 0, "amount": 1}):
        unpaid_amount += v.get("amount", 0)

    active_leaves = 0
    async for lv in db.leaves.find({"status": "approved"}, {"_id": 0, "start_date": 1, "end_date": 1}):
        if lv["start_date"] <= today <= lv["end_date"]:
            active_leaves += 1

    upcoming_maint = 0
    thirty = (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()
    async for m in db.maintenance.find({}, {"_id": 0, "next_due_date": 1}):
        if m.get("next_due_date") and today <= m["next_due_date"] <= thirty:
            upcoming_maint += 1

    year_prefix = str(datetime.now(timezone.utc).year)
    maint_cost = 0
    async for m in db.maintenance.find({}, {"_id": 0, "date": 1, "cost": 1}):
        if m.get("date", "").startswith(year_prefix):
            maint_cost += m.get("cost", 0)

    fuel_cost = 0
    fuel_count = 0
    async for f in db.fuel_records.find({}, {"_id": 0, "date": 1, "cost": 1}):
        if f.get("date", "").startswith(year_prefix):
            fuel_cost += f.get("cost", 0)
            fuel_count += 1

    accident_cost = 0
    async for a in db.accidents.find({}, {"_id": 0, "date": 1, "cost": 1}):
        if a.get("date", "").startswith(year_prefix):
            accident_cost += a.get("cost", 0)

    return {
        "total_vehicles": total_vehicles, "active_vehicles": active_vehicles, "in_maintenance": in_maintenance,
        "total_employees": total_employees, "total_locations": total_locations,
        "unpaid_violations": unpaid_violations, "unpaid_amount": unpaid_amount,
        "active_leaves": active_leaves, "upcoming_maintenance": upcoming_maint,
        "maintenance_cost_year": maint_cost, "open_accidents": open_accidents,
        "pending_users": pending_users, "fuel_cost_year": fuel_cost,
        "fuel_count_year": fuel_count, "accident_cost_year": accident_cost,
    }


async def _monthly_agg(coll: str, amount_field: str = "cost"):
    result = []
    for (y, m) in last_6_months():
        prefix = year_month_prefix(y, m)
        total = 0
        count = 0
        async for d in db[coll].find({}, {"_id": 0, "date": 1, amount_field: 1}):
            if d.get("date", "").startswith(prefix):
                total += d.get(amount_field, 0) or 0
                count += 1
        result.append({"label": AR_MONTHS[m], "count": count, "amount": round(total, 2)})
    return result

@api_router.get("/stats/violations-monthly")
async def violations_monthly(current_user: dict = Depends(get_current_user)):
    return await _monthly_agg("violations", "amount")

@api_router.get("/stats/maintenance-monthly")
async def maintenance_monthly(current_user: dict = Depends(get_current_user)):
    return await _monthly_agg("maintenance", "cost")

@api_router.get("/stats/fuel-monthly")
async def fuel_monthly(current_user: dict = Depends(get_current_user)):
    return await _monthly_agg("fuel_records", "cost")

@api_router.get("/stats/accidents-monthly")
async def accidents_monthly(current_user: dict = Depends(get_current_user)):
    return await _monthly_agg("accidents", "cost")


@api_router.get("/stats/violations-by-vehicle")
async def violations_by_vehicle(current_user: dict = Depends(get_current_user)):
    vehicles = {v["id"]: v for v in await db.vehicles.find({}, {"_id": 0}).to_list(1000)}
    counts = {}
    async for v in db.violations.find({}, {"_id": 0, "vehicle_id": 1, "amount": 1}):
        vid = v["vehicle_id"]
        counts[vid] = counts.get(vid, {"count": 0, "amount": 0})
        counts[vid]["count"] += 1
        counts[vid]["amount"] += v.get("amount", 0)
    result = []
    for vid, data in counts.items():
        veh = vehicles.get(vid, {})
        result.append({"vehicle_id": vid, "plate": veh.get("plate_number", "غير معروف"), "count": data["count"], "amount": data["amount"]})
    result.sort(key=lambda x: x["count"], reverse=True)
    return result[:10]

@api_router.get("/stats/maintenance-status")
async def maintenance_status(current_user: dict = Depends(get_current_user)):
    return {
        "completed": await db.maintenance.count_documents({"status": "completed"}),
        "pending": await db.maintenance.count_documents({"status": "pending"}),
        "upcoming": await db.maintenance.count_documents({"status": "upcoming"}),
    }

@api_router.get("/stats/fuel-by-vehicle")
async def fuel_by_vehicle(current_user: dict = Depends(get_current_user)):
    vehicles = {v["id"]: v for v in await db.vehicles.find({}, {"_id": 0}).to_list(1000)}
    by_v = {}
    async for f in db.fuel_records.find({}, {"_id": 0}).sort("date", 1):
        vid = f["vehicle_id"]
        if vid not in by_v:
            by_v[vid] = {"count": 0, "cost": 0, "distance": 0}
        by_v[vid]["count"] += 1
        by_v[vid]["cost"] += f.get("cost", 0)
        if f.get("odometer_after") and f.get("odometer_before"):
            d = f["odometer_after"] - f["odometer_before"]
            if d > 0:
                by_v[vid]["distance"] += d
    result = []
    for vid, data in by_v.items():
        veh = vehicles.get(vid, {})
        result.append({
            "vehicle_id": vid, "plate": veh.get("plate_number", "غير معروف"),
            "count": data["count"], "cost": data["cost"],
            "distance": round(data["distance"], 1),
        })
    result.sort(key=lambda x: x["cost"], reverse=True)
    return result

@api_router.get("/stats/fuel-alerts")
async def fuel_alerts(current_user: dict = Depends(get_current_user)):
    """Returns vehicles whose monthly fuel cost this month exceeds their average of the last 6 months."""
    now = datetime.now(timezone.utc)
    cur_prefix = f"{now.year:04d}-{now.month:02d}"
    # Get all fuel records
    by_v_current = {}
    by_v_history = {}
    async for f in db.fuel_records.find({}, {"_id": 0}):
        vid = f["vehicle_id"]
        d = f.get("date", "")
        cost = f.get("cost", 0) or 0
        if d.startswith(cur_prefix):
            by_v_current[vid] = by_v_current.get(vid, 0) + cost
        else:
            month = d[:7]  # yyyy-mm
            if not month:
                continue
            by_v_history.setdefault(vid, {}).setdefault(month, 0)
            by_v_history[vid][month] += cost
    vehicles = {v["id"]: v for v in await db.vehicles.find({}, {"_id": 0}).to_list(1000)}
    alerts = []
    for vid, cur in by_v_current.items():
        hist = by_v_history.get(vid, {})
        if not hist:
            continue
        avg = sum(hist.values()) / len(hist)
        if cur > avg * 1.2 and avg > 0:  # 20% above average
            veh = vehicles.get(vid, {})
            alerts.append({
                "vehicle_id": vid, "plate": veh.get("plate_number", "غير معروف"),
                "current_month_cost": round(cur, 2), "average": round(avg, 2),
                "increase_percent": round((cur - avg) / avg * 100, 1),
            })
    alerts.sort(key=lambda x: x["increase_percent"], reverse=True)
    return alerts

@api_router.get("/stats/accidents-summary")
async def accidents_summary(current_user: dict = Depends(get_current_user)):
    total = await db.accidents.count_documents({})
    open_ = await db.accidents.count_documents({"status": "open"})
    closed = await db.accidents.count_documents({"status": "closed"})
    total_cost = 0
    fault_sum = 0
    fault_n = 0
    async for a in db.accidents.find({}, {"_id": 0, "cost": 1, "fault_percentage": 1}):
        total_cost += a.get("cost", 0)
        fault_sum += a.get("fault_percentage", 0)
        fault_n += 1
    return {"total": total, "open": open_, "closed": closed, "total_cost": total_cost, "average_fault": round((fault_sum/fault_n) if fault_n else 0, 1)}


# ============ VEHICLE HISTORY ============
@api_router.get("/vehicles/{vid}/history")
async def vehicle_history(vid: str, current_user: dict = Depends(get_current_user)):
    vehicle = await db.vehicles.find_one({"id": vid}, {"_id": 0})
    if not vehicle:
        raise HTTPException(404, "السيارة غير موجودة")
    maint = await db.maintenance.find({"vehicle_id": vid}, {"_id": 0}).sort("date", -1).to_list(500)
    viols = await db.violations.find({"vehicle_id": vid}, {"_id": 0}).sort("date", -1).to_list(500)
    fuel = await db.fuel_records.find({"vehicle_id": vid}, {"_id": 0}).sort("date", -1).to_list(500)
    accs = await db.accidents.find({"vehicle_id": vid}, {"_id": 0}).sort("date", -1).to_list(500)
    assigns = await db.assignments.find({"vehicle_id": vid}, {"_id": 0}).sort("start_date", -1).to_list(500)
    total_maint = sum(m.get("cost", 0) for m in maint)
    total_viol = sum(v.get("amount", 0) for v in viols)
    total_fuel = sum(f.get("cost", 0) for f in fuel)
    total_acc = sum(a.get("cost", 0) for a in accs)
    return {
        "vehicle": vehicle, "maintenance": maint, "violations": viols,
        "fuel_records": fuel, "accidents": accs, "assignments": assigns,
        "totals": {
            "maintenance_cost": total_maint, "violations_amount": total_viol,
            "fuel_cost": total_fuel, "accident_cost": total_acc,
            "grand_total": total_maint + total_viol + total_fuel + total_acc,
        }
    }


# ============ LOCATION DETAILS ============
@api_router.get("/locations/{lid}/details")
async def location_details(lid: str, current_user: dict = Depends(get_current_user)):
    loc = await db.locations.find_one({"id": lid}, {"_id": 0})
    if not loc:
        raise HTTPException(404, "المقر غير موجود")
    emps = await db.employees.find({"location_id": lid}, {"_id": 0}).to_list(500)
    vehs = await db.vehicles.find({"location_id": lid}, {"_id": 0}).to_list(500)
    return {"location": loc, "employees": emps, "vehicles": vehs}


# ============ SCHEDULE ============
@api_router.get("/schedule/on-date")
async def schedule_on_date(date_str: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Returns the groups working on a given date (default: today)."""
    if date_str:
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(400, "صيغة التاريخ يجب YYYY-MM-DD")
    else:
        d = datetime.now(timezone.utc).date()
    info = groups_for_date(d)
    return {
        "date": d.isoformat(),
        **info,
        "day_shift": {"group": info["day"], "hours": "06:00 - 18:00"},
        "night_shift": {"group": info["night"], "hours": "18:00 - 06:00"},
    }

@api_router.get("/schedule/week")
async def schedule_week(current_user: dict = Depends(get_current_user)):
    """Returns 14-day schedule starting today."""
    today = datetime.now(timezone.utc).date()
    result = []
    for i in range(14):
        d = today + timedelta(days=i)
        info = groups_for_date(d)
        result.append({"date": d.isoformat(), **info})
    return result


# ============ WHATSAPP MESSAGE HELPERS ============
class ViolationNotifyReq(BaseModel):
    violation_id: str

@api_router.get("/violations/{vid}/notify-info")
async def violation_notify_info(vid: str, current_user: dict = Depends(get_current_user)):
    v = await db.violations.find_one({"id": vid}, {"_id": 0})
    if not v:
        raise HTTPException(404, "المخالفة غير موجودة")
    emp = None
    if v.get("employee_id"):
        emp = await db.employees.find_one({"id": v["employee_id"]}, {"_id": 0})
    veh = await db.vehicles.find_one({"id": v["vehicle_id"]}, {"_id": 0}) if v.get("vehicle_id") else None
    if not emp or not emp.get("phone"):
        raise HTTPException(400, "لا يوجد رقم هاتف للموظف المرتبط بالمخالفة")
    phone = normalize_phone(emp["phone"])
    msg = (
        f"السلام عليكم {emp['name']}\n"
        f"تم تسجيل مخالفة مرورية بحقك:\n"
        f"• النوع: {v['violation_type']}\n"
        f"• المبلغ: {v['amount']} ر.س\n"
        f"• التاريخ: {v['date']}\n"
    )
    if veh:
        msg += f"• السيارة: {veh['plate_number']}\n"
    if v.get("location"):
        msg += f"• الموقع: {v['location']}\n"
    msg += "\nسيتم خصم قيمة المخالفة من الراتب."
    await db.violations.update_one({"id": vid}, {"$set": {"notified": True}})
    return {"phone": phone, "message": msg}


class ApproveNotifyReq(BaseModel):
    temp_password: str
    phone: str
    full_name: str

@api_router.post("/users/notify-message")
async def notify_message(body: ApproveNotifyReq, current_user: dict = Depends(require_admin)):
    """Formats a WhatsApp message with the temp password for admin to share."""
    phone = normalize_phone(body.phone)
    msg = (
        f"مرحباً {body.full_name}\n"
        f"تمت الموافقة على حسابك في تطبيق ميدان.\n\n"
        f"• رقم الجوال (اسم المستخدم): {phone}\n"
        f"• كلمة المرور المؤقتة: {body.temp_password}\n\n"
        f"يرجى تسجيل الدخول وتغيير كلمة المرور فوراً."
    )
    return {"phone": phone, "message": msg}


# ============ STARTUP ============
@app.on_event("startup")
async def _on_startup():
    if await db.locations.count_documents({}) == 0 and await db.users.count_documents({}) > 0:
        await ensure_real_locations()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
