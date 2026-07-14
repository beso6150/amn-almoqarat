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

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
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
    return user


# ============ MODELS ============
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    user: dict

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
    national_id: Optional[str] = ""
    phone: Optional[str] = ""
    position: Optional[str] = ""
    location_id: Optional[str] = None
    salary: Optional[float] = 0
    created_at: str = Field(default_factory=now_iso)

class EmployeeCreate(BaseModel):
    name: str
    national_id: Optional[str] = ""
    phone: Optional[str] = ""
    position: Optional[str] = ""
    location_id: Optional[str] = None
    salary: Optional[float] = 0

class Vehicle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    plate_number: str
    model: str
    year: Optional[int] = None
    color: Optional[str] = ""
    location_id: Optional[str] = None
    driver_id: Optional[str] = None
    status: str = "active"  # active, maintenance, out_of_service
    photo: Optional[str] = ""  # base64
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
    maintenance_type: str  # زيت، فرامل، إطارات، etc
    description: Optional[str] = ""
    cost: float = 0
    date: str  # ISO date
    status: str = "completed"  # completed, pending, upcoming
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
    status: str = "unpaid"  # paid, unpaid
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
    leave_type: str  # اعتيادية، مرضية، عارضة
    start_date: str
    end_date: str
    reason: Optional[str] = ""
    status: str = "approved"  # approved, pending, rejected
    created_at: str = Field(default_factory=now_iso)

class LeaveCreate(BaseModel):
    employee_id: str
    leave_type: str
    start_date: str
    end_date: str
    reason: Optional[str] = ""
    status: str = "approved"


# ============ AUTH ROUTES ============
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(body: UserRegister):
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="البريد الإلكتروني مسجل مسبقاً")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": body.email,
        "full_name": body.full_name,
        "hashed_password": hash_password(body.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token({"sub": user_id, "email": body.email})
    return TokenResponse(access_token=token, user={"id": user_id, "email": body.email, "full_name": body.full_name})


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(body: UserLogin):
    user = await db.users.find_one({"email": body.email})
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة")
    token = create_access_token({"sub": user["id"], "email": user["email"]})
    return TokenResponse(access_token=token, user={"id": user["id"], "email": user["email"], "full_name": user["full_name"]})


@api_router.get("/auth/me")
async def me(current_user: dict = Depends(get_current_user)):
    return current_user


# ============ LOCATIONS CRUD ============
@api_router.get("/locations", response_model=List[Location])
async def list_locations(current_user: dict = Depends(get_current_user)):
    docs = await db.locations.find({}, {"_id": 0}).to_list(1000)
    return docs

@api_router.post("/locations", response_model=Location)
async def create_location(body: LocationCreate, current_user: dict = Depends(get_current_user)):
    loc = Location(**body.dict())
    await db.locations.insert_one(loc.dict())
    return loc

@api_router.put("/locations/{loc_id}", response_model=Location)
async def update_location(loc_id: str, body: LocationCreate, current_user: dict = Depends(get_current_user)):
    await db.locations.update_one({"id": loc_id}, {"$set": body.dict()})
    doc = await db.locations.find_one({"id": loc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "غير موجود")
    return doc

@api_router.delete("/locations/{loc_id}")
async def delete_location(loc_id: str, current_user: dict = Depends(get_current_user)):
    await db.locations.delete_one({"id": loc_id})
    return {"ok": True}


# ============ EMPLOYEES CRUD ============
@api_router.get("/employees", response_model=List[Employee])
async def list_employees(current_user: dict = Depends(get_current_user)):
    docs = await db.employees.find({}, {"_id": 0}).to_list(1000)
    return docs

@api_router.post("/employees", response_model=Employee)
async def create_employee(body: EmployeeCreate, current_user: dict = Depends(get_current_user)):
    emp = Employee(**body.dict())
    await db.employees.insert_one(emp.dict())
    return emp

@api_router.put("/employees/{emp_id}", response_model=Employee)
async def update_employee(emp_id: str, body: EmployeeCreate, current_user: dict = Depends(get_current_user)):
    await db.employees.update_one({"id": emp_id}, {"$set": body.dict()})
    doc = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "غير موجود")
    return doc

@api_router.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str, current_user: dict = Depends(get_current_user)):
    await db.employees.delete_one({"id": emp_id})
    return {"ok": True}


# ============ VEHICLES CRUD ============
@api_router.get("/vehicles", response_model=List[Vehicle])
async def list_vehicles(current_user: dict = Depends(get_current_user)):
    docs = await db.vehicles.find({}, {"_id": 0}).to_list(1000)
    return docs

@api_router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(body: VehicleCreate, current_user: dict = Depends(get_current_user)):
    v = Vehicle(**body.dict())
    await db.vehicles.insert_one(v.dict())
    return v

@api_router.put("/vehicles/{v_id}", response_model=Vehicle)
async def update_vehicle(v_id: str, body: VehicleCreate, current_user: dict = Depends(get_current_user)):
    await db.vehicles.update_one({"id": v_id}, {"$set": body.dict()})
    doc = await db.vehicles.find_one({"id": v_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "غير موجود")
    return doc

@api_router.delete("/vehicles/{v_id}")
async def delete_vehicle(v_id: str, current_user: dict = Depends(get_current_user)):
    await db.vehicles.delete_one({"id": v_id})
    return {"ok": True}


# ============ MAINTENANCE CRUD ============
@api_router.get("/maintenance", response_model=List[Maintenance])
async def list_maintenance(current_user: dict = Depends(get_current_user)):
    docs = await db.maintenance.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    return docs

@api_router.post("/maintenance", response_model=Maintenance)
async def create_maintenance(body: MaintenanceCreate, current_user: dict = Depends(get_current_user)):
    m = Maintenance(**body.dict())
    await db.maintenance.insert_one(m.dict())
    return m

@api_router.put("/maintenance/{m_id}", response_model=Maintenance)
async def update_maintenance(m_id: str, body: MaintenanceCreate, current_user: dict = Depends(get_current_user)):
    await db.maintenance.update_one({"id": m_id}, {"$set": body.dict()})
    doc = await db.maintenance.find_one({"id": m_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "غير موجود")
    return doc

@api_router.delete("/maintenance/{m_id}")
async def delete_maintenance(m_id: str, current_user: dict = Depends(get_current_user)):
    await db.maintenance.delete_one({"id": m_id})
    return {"ok": True}


# ============ VIOLATIONS CRUD ============
@api_router.get("/violations", response_model=List[Violation])
async def list_violations(current_user: dict = Depends(get_current_user)):
    docs = await db.violations.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    return docs

@api_router.post("/violations", response_model=Violation)
async def create_violation(body: ViolationCreate, current_user: dict = Depends(get_current_user)):
    v = Violation(**body.dict())
    await db.violations.insert_one(v.dict())
    return v

@api_router.put("/violations/{v_id}", response_model=Violation)
async def update_violation(v_id: str, body: ViolationCreate, current_user: dict = Depends(get_current_user)):
    await db.violations.update_one({"id": v_id}, {"$set": body.dict()})
    doc = await db.violations.find_one({"id": v_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "غير موجود")
    return doc

@api_router.delete("/violations/{v_id}")
async def delete_violation(v_id: str, current_user: dict = Depends(get_current_user)):
    await db.violations.delete_one({"id": v_id})
    return {"ok": True}


# ============ LEAVES CRUD ============
@api_router.get("/leaves", response_model=List[Leave])
async def list_leaves(current_user: dict = Depends(get_current_user)):
    docs = await db.leaves.find({}, {"_id": 0}).sort("start_date", -1).to_list(1000)
    return docs

@api_router.post("/leaves", response_model=Leave)
async def create_leave(body: LeaveCreate, current_user: dict = Depends(get_current_user)):
    lv = Leave(**body.dict())
    await db.leaves.insert_one(lv.dict())
    return lv

@api_router.put("/leaves/{lv_id}", response_model=Leave)
async def update_leave(lv_id: str, body: LeaveCreate, current_user: dict = Depends(get_current_user)):
    await db.leaves.update_one({"id": lv_id}, {"$set": body.dict()})
    doc = await db.leaves.find_one({"id": lv_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "غير موجود")
    return doc

@api_router.delete("/leaves/{lv_id}")
async def delete_leave(lv_id: str, current_user: dict = Depends(get_current_user)):
    await db.leaves.delete_one({"id": lv_id})
    return {"ok": True}


# ============ STATS / DASHBOARD ============
@api_router.get("/stats/dashboard")
async def dashboard_stats(current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    total_vehicles = await db.vehicles.count_documents({})
    active_vehicles = await db.vehicles.count_documents({"status": "active"})
    in_maintenance = await db.vehicles.count_documents({"status": "maintenance"})
    total_employees = await db.employees.count_documents({})
    total_locations = await db.locations.count_documents({})
    unpaid_violations = await db.violations.count_documents({"status": "unpaid"})

    # Sum unpaid violation amount
    unpaid_amount = 0
    async for v in db.violations.find({"status": "unpaid"}, {"_id": 0, "amount": 1}):
        unpaid_amount += v.get("amount", 0)

    # Active leaves
    active_leaves = 0
    async for lv in db.leaves.find({"status": "approved"}, {"_id": 0, "start_date": 1, "end_date": 1}):
        if lv["start_date"] <= today <= lv["end_date"]:
            active_leaves += 1

    # Upcoming maintenance (next_due_date within 30 days)
    upcoming_maint = 0
    thirty_days = (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()
    async for m in db.maintenance.find({}, {"_id": 0, "next_due_date": 1}):
        if m.get("next_due_date") and today <= m["next_due_date"] <= thirty_days:
            upcoming_maint += 1

    # Total maintenance cost this year
    year_prefix = str(datetime.now(timezone.utc).year)
    maint_cost = 0
    async for m in db.maintenance.find({}, {"_id": 0, "date": 1, "cost": 1}):
        if m.get("date", "").startswith(year_prefix):
            maint_cost += m.get("cost", 0)

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
    }


@api_router.get("/stats/violations-monthly")
async def violations_monthly(current_user: dict = Depends(get_current_user)):
    """Return count and amount of violations per month for last 6 months"""
    now = datetime.now(timezone.utc)
    months = []
    for i in range(5, -1, -1):
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        months.append((year, month))

    result = []
    ar_months = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
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
    """Count violations per vehicle"""
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
        result.append({
            "vehicle_id": vid,
            "plate": veh.get("plate_number", "غير معروف"),
            "count": data["count"],
            "amount": data["amount"],
        })
    result.sort(key=lambda x: x["count"], reverse=True)
    return result[:10]


@api_router.get("/stats/maintenance-status")
async def maintenance_status(current_user: dict = Depends(get_current_user)):
    completed = await db.maintenance.count_documents({"status": "completed"})
    pending = await db.maintenance.count_documents({"status": "pending"})
    upcoming = await db.maintenance.count_documents({"status": "upcoming"})
    return {"completed": completed, "pending": pending, "upcoming": upcoming}


# ============ SEED ============
@api_router.post("/seed")
async def seed_demo(current_user: dict = Depends(get_current_user)):
    """Seed demo data if collections are empty"""
    if await db.locations.count_documents({}) > 0:
        return {"seeded": False, "message": "البيانات موجودة بالفعل"}

    loc1 = Location(name="المقر الرئيسي - الرياض", address="الرياض، حي العليا", phone="0112345678", manager="أحمد العتيبي")
    loc2 = Location(name="فرع جدة", address="جدة، حي الروضة", phone="0123456789", manager="خالد الحربي")
    loc3 = Location(name="فرع الدمام", address="الدمام، الشاطئ", phone="0134567890", manager="محمد الشمري")
    await db.locations.insert_many([loc1.dict(), loc2.dict(), loc3.dict()])

    emp1 = Employee(name="سعد المطيري", national_id="1234567890", phone="0501111111", position="سائق", location_id=loc1.id, salary=5000)
    emp2 = Employee(name="فهد القحطاني", national_id="1234567891", phone="0502222222", position="سائق", location_id=loc1.id, salary=5500)
    emp3 = Employee(name="عبدالله الغامدي", national_id="1234567892", phone="0503333333", position="مشرف ميداني", location_id=loc2.id, salary=8000)
    emp4 = Employee(name="ناصر الدوسري", national_id="1234567893", phone="0504444444", position="سائق", location_id=loc3.id, salary=5000)
    await db.employees.insert_many([emp1.dict(), emp2.dict(), emp3.dict(), emp4.dict()])

    today = datetime.now(timezone.utc)
    v1 = Vehicle(plate_number="أ ب ج 1234", model="تويوتا هايلوكس", year=2022, color="أبيض", location_id=loc1.id, driver_id=emp1.id, status="active")
    v2 = Vehicle(plate_number="د هـ و 5678", model="نيسان باترول", year=2021, color="فضي", location_id=loc1.id, driver_id=emp2.id, status="active")
    v3 = Vehicle(plate_number="ز ح ط 9012", model="فورد رينجر", year=2020, color="أسود", location_id=loc2.id, driver_id=emp3.id, status="maintenance")
    v4 = Vehicle(plate_number="ي ك ل 3456", model="ايسوزو دي ماكس", year=2023, color="أزرق", location_id=loc3.id, driver_id=emp4.id, status="active")
    await db.vehicles.insert_many([v1.dict(), v2.dict(), v3.dict(), v4.dict()])

    # Maintenance
    def days_ago(n):
        return (today - timedelta(days=n)).date().isoformat()
    def days_from_now(n):
        return (today + timedelta(days=n)).date().isoformat()

    maints = [
        Maintenance(vehicle_id=v1.id, maintenance_type="تغيير زيت", description="زيت محرك 5W-30", cost=350, date=days_ago(30), status="completed", next_due_date=days_from_now(60)),
        Maintenance(vehicle_id=v1.id, maintenance_type="فرامل", description="تغيير قماش الفرامل الأمامي", cost=800, date=days_ago(90), status="completed"),
        Maintenance(vehicle_id=v2.id, maintenance_type="إطارات", description="4 إطارات جديدة", cost=2400, date=days_ago(60), status="completed", next_due_date=days_from_now(20)),
        Maintenance(vehicle_id=v3.id, maintenance_type="صيانة شاملة", description="صيانة دورية 20 ألف كم", cost=1500, date=days_ago(5), status="pending"),
        Maintenance(vehicle_id=v4.id, maintenance_type="تغيير زيت", description="زيت + فلاتر", cost=450, date=days_ago(15), status="completed", next_due_date=days_from_now(75)),
        Maintenance(vehicle_id=v2.id, maintenance_type="بطارية", description="بطارية جديدة 100 أمبير", cost=650, date=days_ago(45), status="completed"),
    ]
    await db.maintenance.insert_many([m.dict() for m in maints])

    # Violations
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

    # Leaves
    leaves = [
        Leave(employee_id=emp1.id, leave_type="اعتيادية", start_date=days_ago(-2), end_date=days_from_now(5), reason="إجازة سنوية", status="approved"),
        Leave(employee_id=emp2.id, leave_type="مرضية", start_date=days_ago(15), end_date=days_ago(10), reason="نزلة برد", status="approved"),
        Leave(employee_id=emp3.id, leave_type="اعتيادية", start_date=days_from_now(10), end_date=days_from_now(20), reason="سفر عائلي", status="pending"),
    ]
    await db.leaves.insert_many([lv.dict() for lv in leaves])

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
