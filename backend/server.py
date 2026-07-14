from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

SECRET_KEY = os.environ.get("JWT_SECRET", "medan-field-work-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7
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


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


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
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("status") != "approved":
        raise HTTPException(status_code=403, detail="حسابك بانتظار موافقة المدير")
    return user


def require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="هذه العملية مسموحة للمدير فقط")
    return user


# ============ MODELS ============
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Location(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    phone: Optional[str] = ""
    manager: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)

class LocationCreate(BaseModel):
    name: str
    address: str
    phone: Optional[str] = ""
    manager: Optional[str] = ""

class Employee(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    employee_number: Optional[str] = ""
    national_id: Optional[str] = ""
    phone: Optional[str] = ""
    position: Optional[str] = ""
    location_id: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)

class EmployeeCreate(BaseModel):
    name: str
    employee_number: Optional[str] = ""
    national_id: Optional[str] = ""
    phone: Optional[str] = ""
    position: Optional[str] = ""
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
    maintenance_type: str
    description: Optional[str] = ""
    cost: float = 0
    date: str
    status: str = "completed"
    next_due_date: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)

class MaintenanceCreate(BaseModel):
    vehicle_id: str
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
    leave_type: str
    start_date: str
    end_date: str
    reason: Optional[str] = ""
    status: str = "approved"
    created_at: str = Field(default_factory=now_iso)

class LeaveCreate(BaseModel):
    employee_id: str
    leave_type: str
    start_date: str
    end_date: str
    reason: Optional[str] = ""
    status: str = "approved"

# New: fuel, accidents, assignments
class FuelRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_id: str
    employee_id: Optional[str] = None
    date: str
    liters: float = 0
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
    liters: float = 0
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
    status: str = "open"  # open, closed
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
    """يحدد اي سيارة كانت مع اي موظف في اي فترة"""
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


# ============ AUTH ============
@api_router.post("/auth/register")
async def register(body: UserRegister):
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="البريد الإلكتروني مسجل مسبقاً")

    # First user becomes admin & auto-approved; subsequent users are pending guards
    is_first = (await db.users.count_documents({}) == 0)
    role = "admin" if is_first else "guard"
    user_status = "approved" if is_first else "pending"

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": body.email,
        "full_name": body.full_name,
        "hashed_password": hash_password(body.password),
        "role": role,
        "status": user_status,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)

    if user_status != "approved":
        return {
            "pending": True,
            "message": "تم تسجيل حسابك. بانتظار موافقة المدير للدخول."
        }

    token = create_access_token({"sub": user_id, "email": body.email})
    return {
        "pending": False,
        "access_token": token,
        "user": {"id": user_id, "email": body.email, "full_name": body.full_name, "role": role, "status": user_status},
    }


@api_router.post("/auth/login")
async def login(body: UserLogin):
    user = await db.users.find_one({"email": body.email})
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة")
    if user.get("status") == "pending":
        raise HTTPException(status_code=403, detail="حسابك بانتظار موافقة المدير")
    if user.get("status") == "rejected":
        raise HTTPException(status_code=403, detail="تم رفض حسابك. تواصل مع المدير")
    token = create_access_token({"sub": user["id"], "email": user["email"]})
    return {
        "pending": False,
        "access_token": token,
        "user": {"id": user["id"], "email": user["email"], "full_name": user["full_name"], "role": user.get("role", "guard"), "status": user.get("status", "approved")},
    }


@api_router.get("/auth/me")
async def me(current_user: dict = Depends(get_current_user)):
    return current_user


# ============ USER MANAGEMENT (admin only) ============
@api_router.get("/users")
async def list_users(current_user: dict = Depends(require_admin)):
    docs = await db.users.find({}, {"_id": 0, "hashed_password": 0}).to_list(1000)
    return docs

@api_router.get("/users/pending")
async def pending_users(current_user: dict = Depends(require_admin)):
    docs = await db.users.find({"status": "pending"}, {"_id": 0, "hashed_password": 0}).to_list(1000)
    return docs

class UserApproval(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None

@api_router.put("/users/{uid}")
async def update_user(uid: str, body: UserApproval, current_user: dict = Depends(require_admin)):
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
    doc = await db.users.find_one({"id": uid}, {"_id": 0, "hashed_password": 0})
    return doc

@api_router.delete("/users/{uid}")
async def delete_user(uid: str, current_user: dict = Depends(require_admin)):
    if uid == current_user["id"]:
        raise HTTPException(status_code=400, detail="لا يمكنك حذف نفسك")
    await db.users.delete_one({"id": uid})
    return {"ok": True}


# ============ CRUD helper builder ============
def _crud(coll_name: str, model, model_create):
    """Register standard CRUD routes for a collection.
    - GET list: any authenticated user
    - POST/PUT/DELETE: admin only
    """
    async def list_all(current_user: dict = Depends(get_current_user)):
        sort_field = "created_at"
        if coll_name in ("maintenance", "violations", "fuel_records", "accidents"):
            sort_field = "date"
        docs = await db[coll_name].find({}, {"_id": 0}).sort(sort_field, -1).to_list(2000)
        return docs

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


# Register CRUD for all resources
for _name, _model, _mc in [
    ("locations", Location, LocationCreate),
    ("employees", Employee, EmployeeCreate),
    ("vehicles", Vehicle, VehicleCreate),
    ("maintenance", Maintenance, MaintenanceCreate),
    ("violations", Violation, ViolationCreate),
    ("leaves", Leave, LeaveCreate),
    ("fuel_records", FuelRecord, FuelRecordCreate),
    ("accidents", Accident, AccidentCreate),
    ("assignments", Assignment, AssignmentCreate),
]:
    _list, _create, _update, _delete = _crud(_name, _model, _mc)
    api_router.add_api_route(f"/{_name}", _list, methods=["GET"])
    api_router.add_api_route(f"/{_name}", _create, methods=["POST"])
    api_router.add_api_route(f"/{_name}/{{item_id}}", _update, methods=["PUT"])
    api_router.add_api_route(f"/{_name}/{{item_id}}", _delete, methods=["DELETE"])


# ============ STATS ============
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
    thirty_days = (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()
    async for m in db.maintenance.find({}, {"_id": 0, "next_due_date": 1}):
        if m.get("next_due_date") and today <= m["next_due_date"] <= thirty_days:
            upcoming_maint += 1

    year_prefix = str(datetime.now(timezone.utc).year)
    maint_cost = 0
    async for m in db.maintenance.find({}, {"_id": 0, "date": 1, "cost": 1}):
        if m.get("date", "").startswith(year_prefix):
            maint_cost += m.get("cost", 0)

    fuel_cost = 0
    fuel_liters = 0
    fuel_count = 0
    async for f in db.fuel_records.find({}, {"_id": 0, "date": 1, "cost": 1, "liters": 1}):
        if f.get("date", "").startswith(year_prefix):
            fuel_cost += f.get("cost", 0)
            fuel_liters += f.get("liters", 0)
            fuel_count += 1

    accident_cost = 0
    async for a in db.accidents.find({}, {"_id": 0, "date": 1, "cost": 1}):
        if a.get("date", "").startswith(year_prefix):
            accident_cost += a.get("cost", 0)

    return {
        "total_vehicles": total_vehicles,
        "active_vehicles": active_vehicles,
        "in_maintenance": in_maintenance,
        "total_employees": total_employees,
        "total_locations": total_locations,
        "unpaid_violations": unpaid_violations,
        "unpaid_amount": unpaid_amount,
        "active_leaves": active_leaves,
        "upcoming_maintenance": upcoming_maint,
        "maintenance_cost_year": maint_cost,
        "open_accidents": open_accidents,
        "pending_users": pending_users,
        "fuel_cost_year": fuel_cost,
        "fuel_liters_year": fuel_liters,
        "fuel_count_year": fuel_count,
        "accident_cost_year": accident_cost,
    }


@api_router.get("/stats/violations-monthly")
async def violations_monthly(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    months = []
    for i in range(5, -1, -1):
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        months.append((year, month))

    ar_months = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
    result = []
    for (y, m) in months:
        prefix = f"{y:04d}-{m:02d}"
        count = 0
        amount = 0
        async for v in db.violations.find({}, {"_id": 0, "date": 1, "amount": 1}):
            if v.get("date", "").startswith(prefix):
                count += 1
                amount += v.get("amount", 0)
        result.append({"label": ar_months[m], "count": count, "amount": amount})
    return result


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
    completed = await db.maintenance.count_documents({"status": "completed"})
    pending = await db.maintenance.count_documents({"status": "pending"})
    upcoming = await db.maintenance.count_documents({"status": "upcoming"})
    return {"completed": completed, "pending": pending, "upcoming": upcoming}


@api_router.get("/stats/fuel-monthly")
async def fuel_monthly(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    months = []
    for i in range(5, -1, -1):
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        months.append((year, month))
    ar_months = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
    result = []
    for (y, m) in months:
        prefix = f"{y:04d}-{m:02d}"
        liters = 0
        cost = 0
        count = 0
        async for f in db.fuel_records.find({}, {"_id": 0, "date": 1, "liters": 1, "cost": 1}):
            if f.get("date", "").startswith(prefix):
                liters += f.get("liters", 0)
                cost += f.get("cost", 0)
                count += 1
        result.append({"label": ar_months[m], "liters": round(liters, 1), "cost": cost, "count": count})
    return result


@api_router.get("/stats/fuel-by-vehicle")
async def fuel_by_vehicle(current_user: dict = Depends(get_current_user)):
    """يحسب استهلاك الوقود لكل سيارة"""
    vehicles = {v["id"]: v for v in await db.vehicles.find({}, {"_id": 0}).to_list(1000)}
    by_v = {}
    async for f in db.fuel_records.find({}, {"_id": 0}).sort("date", 1):
        vid = f["vehicle_id"]
        if vid not in by_v:
            by_v[vid] = {"count": 0, "liters": 0, "cost": 0, "distance": 0}
        by_v[vid]["count"] += 1
        by_v[vid]["liters"] += f.get("liters", 0)
        by_v[vid]["cost"] += f.get("cost", 0)
        if f.get("odometer_after") and f.get("odometer_before"):
            d = f["odometer_after"] - f["odometer_before"]
            if d > 0:
                by_v[vid]["distance"] += d
    result = []
    for vid, data in by_v.items():
        veh = vehicles.get(vid, {})
        consumption = (data["liters"] / data["distance"] * 100) if data["distance"] > 0 else 0
        result.append({
            "vehicle_id": vid,
            "plate": veh.get("plate_number", "غير معروف"),
            "count": data["count"],
            "liters": round(data["liters"], 1),
            "cost": data["cost"],
            "distance": round(data["distance"], 1),
            "consumption_l_100km": round(consumption, 2),
        })
    result.sort(key=lambda x: x["count"], reverse=True)
    return result


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
    avg_fault = (fault_sum / fault_n) if fault_n else 0
    return {"total": total, "open": open_, "closed": closed, "total_cost": total_cost, "average_fault": round(avg_fault, 1)}


@api_router.get("/vehicles/{vid}/history")
async def vehicle_history(vid: str, current_user: dict = Depends(get_current_user)):
    """يرجع تاريخ سيارة كامل: صيانة، مخالفات، وقود، حوادث، أصحاب سابقون"""
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
        "vehicle": vehicle,
        "maintenance": maint,
        "violations": viols,
        "fuel_records": fuel,
        "accidents": accs,
        "assignments": assigns,
        "totals": {
            "maintenance_cost": total_maint,
            "violations_amount": total_viol,
            "fuel_cost": total_fuel,
            "accident_cost": total_acc,
            "grand_total": total_maint + total_viol + total_fuel + total_acc,
        }
    }


# ============ SEED ============
@api_router.post("/seed")
async def seed_demo(current_user: dict = Depends(require_admin)):
    if await db.locations.count_documents({}) > 0:
        return {"seeded": False, "message": "البيانات موجودة بالفعل"}

    loc1 = Location(name="المقر الرئيسي - الرياض", address="الرياض، حي العليا", phone="0112345678", manager="أحمد العتيبي")
    loc2 = Location(name="فرع جدة", address="جدة، حي الروضة", phone="0123456789", manager="خالد الحربي")
    loc3 = Location(name="فرع الدمام", address="الدمام، الشاطئ", phone="0134567890", manager="محمد الشمري")
    await db.locations.insert_many([loc1.dict(), loc2.dict(), loc3.dict()])

    emp1 = Employee(name="سعد المطيري", employee_number="EMP-001", national_id="1234567890", phone="966501111111", position="رجل أمن", location_id=loc1.id)
    emp2 = Employee(name="فهد القحطاني", employee_number="EMP-002", national_id="1234567891", phone="966502222222", position="رجل أمن", location_id=loc1.id)
    emp3 = Employee(name="عبدالله الغامدي", employee_number="EMP-003", national_id="1234567892", phone="966503333333", position="مشرف أمن", location_id=loc2.id)
    emp4 = Employee(name="ناصر الدوسري", employee_number="EMP-004", national_id="1234567893", phone="966504444444", position="رجل أمن", location_id=loc3.id)
    await db.employees.insert_many([emp1.dict(), emp2.dict(), emp3.dict(), emp4.dict()])

    today = datetime.now(timezone.utc)
    def days_ago(n): return (today - timedelta(days=n)).date().isoformat()
    def days_from_now(n): return (today + timedelta(days=n)).date().isoformat()

    v1 = Vehicle(plate_number="أ ب ج 1234", model="تويوتا هايلوكس", year=2022, color="أبيض", location_id=loc1.id, driver_id=emp1.id, status="active")
    v2 = Vehicle(plate_number="د هـ و 5678", model="نيسان باترول", year=2021, color="فضي", location_id=loc1.id, driver_id=emp2.id, status="active")
    v3 = Vehicle(plate_number="ز ح ط 9012", model="فورد رينجر", year=2020, color="أسود", location_id=loc2.id, driver_id=emp3.id, status="maintenance")
    v4 = Vehicle(plate_number="ي ك ل 3456", model="ايسوزو دي ماكس", year=2023, color="أزرق", location_id=loc3.id, driver_id=emp4.id, status="active")
    await db.vehicles.insert_many([v1.dict(), v2.dict(), v3.dict(), v4.dict()])

    maints = [
        Maintenance(vehicle_id=v1.id, maintenance_type="تغيير زيت", description="زيت محرك 5W-30", cost=350, date=days_ago(30), status="completed", next_due_date=days_from_now(60)),
        Maintenance(vehicle_id=v1.id, maintenance_type="فرامل", description="تغيير قماش الفرامل الأمامي", cost=800, date=days_ago(90), status="completed"),
        Maintenance(vehicle_id=v2.id, maintenance_type="إطارات", description="4 إطارات جديدة", cost=2400, date=days_ago(60), status="completed", next_due_date=days_from_now(20)),
        Maintenance(vehicle_id=v3.id, maintenance_type="صيانة شاملة", description="صيانة دورية 20 ألف كم", cost=1500, date=days_ago(5), status="pending"),
        Maintenance(vehicle_id=v4.id, maintenance_type="تغيير زيت", description="زيت + فلاتر", cost=450, date=days_ago(15), status="completed", next_due_date=days_from_now(75)),
        Maintenance(vehicle_id=v2.id, maintenance_type="بطارية", description="بطارية جديدة 100 أمبير", cost=650, date=days_ago(45), status="completed"),
    ]
    await db.maintenance.insert_many([m.dict() for m in maints])

    viols = [
        Violation(vehicle_id=v1.id, employee_id=emp1.id, violation_type="تجاوز السرعة", amount=300, date=days_ago(10), location="طريق الملك فهد", status="unpaid"),
        Violation(vehicle_id=v2.id, employee_id=emp2.id, violation_type="قطع إشارة حمراء", amount=500, date=days_ago(25), location="تقاطع العليا", status="paid"),
        Violation(vehicle_id=v1.id, employee_id=emp1.id, violation_type="ركن خاطئ", amount=100, date=days_ago(45), location="شارع التحلية", status="unpaid"),
        Violation(vehicle_id=v3.id, employee_id=emp3.id, violation_type="عدم ربط الحزام", amount=150, date=days_ago(70), location="طريق المدينة", status="paid"),
        Violation(vehicle_id=v4.id, employee_id=emp4.id, violation_type="استخدام الجوال", amount=200, date=days_ago(90), location="طريق الدمام السريع", status="unpaid"),
        Violation(vehicle_id=v2.id, employee_id=emp2.id, violation_type="تجاوز السرعة", amount=300, date=days_ago(120), location="طريق الرياض جدة", status="paid"),
        Violation(vehicle_id=v1.id, employee_id=emp1.id, violation_type="تجاوز السرعة", amount=300, date=days_ago(150), location="طريق الجنوب", status="paid"),
    ]
    await db.violations.insert_many([v.dict() for v in viols])

    leaves_ = [
        Leave(employee_id=emp1.id, leave_type="اعتيادية", start_date=days_ago(-2), end_date=days_from_now(5), reason="إجازة سنوية", status="approved"),
        Leave(employee_id=emp2.id, leave_type="مرضية", start_date=days_ago(15), end_date=days_ago(10), reason="نزلة برد", status="approved"),
        Leave(employee_id=emp3.id, leave_type="اعتيادية", start_date=days_from_now(10), end_date=days_from_now(20), reason="سفر عائلي", status="pending"),
    ]
    await db.leaves.insert_many([lv.dict() for lv in leaves_])

    # Fuel records
    fuel_data = [
        FuelRecord(vehicle_id=v1.id, employee_id=emp1.id, date=days_ago(5), liters=45.5, cost=105, odometer_before=45000, odometer_after=45400),
        FuelRecord(vehicle_id=v1.id, employee_id=emp1.id, date=days_ago(20), liters=48.2, cost=110, odometer_before=44560, odometer_after=45000),
        FuelRecord(vehicle_id=v2.id, employee_id=emp2.id, date=days_ago(7), liters=52.0, cost=120, odometer_before=32000, odometer_after=32380),
        FuelRecord(vehicle_id=v4.id, employee_id=emp4.id, date=days_ago(3), liters=40.0, cost=92, odometer_before=15000, odometer_after=15350),
    ]
    await db.fuel_records.insert_many([f.dict() for f in fuel_data])

    # Accidents
    acc_data = [
        Accident(vehicle_id=v3.id, employee_id=emp3.id, date=days_ago(35), description="اصطدام خفيف بالبمبر الخلفي", fault_percentage=25, cost=1200, status="closed", location="موقف مركز تجاري"),
        Accident(vehicle_id=v2.id, employee_id=emp2.id, date=days_ago(80), description="خدش جانبي", fault_percentage=0, cost=450, status="closed", location="شارع فرعي"),
    ]
    await db.accidents.insert_many([a.dict() for a in acc_data])

    # Assignments (history of who had which vehicle)
    assigns = [
        Assignment(vehicle_id=v1.id, employee_id=emp1.id, start_date=days_ago(180)),
        Assignment(vehicle_id=v2.id, employee_id=emp2.id, start_date=days_ago(200)),
        Assignment(vehicle_id=v3.id, employee_id=emp3.id, start_date=days_ago(150)),
        Assignment(vehicle_id=v4.id, employee_id=emp4.id, start_date=days_ago(90)),
    ]
    await db.assignments.insert_many([a.dict() for a in assigns])

    return {"seeded": True, "message": "تمت إضافة البيانات التجريبية"}


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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
