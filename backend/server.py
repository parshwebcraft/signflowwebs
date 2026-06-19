from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import base64
import logging
import secrets
from io import BytesIO
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.utils import ImageReader

# ---------------------- Config ----------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

UPLOAD_DIR = ROOT_DIR / "uploads"
ORIGINAL_DIR = UPLOAD_DIR / "original"
SIGNED_DIR = UPLOAD_DIR / "signed"
for d in (ORIGINAL_DIR, SIGNED_DIR):
    d.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="DocuSign MVP")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------------------- Helpers: Auth ----------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    token = None
    if creds and creds.scheme.lower() == "bearer":
        token = creds.credentials
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ---------------------- Pydantic Models ----------------------
class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    created_at: str

class AuthResponse(BaseModel):
    token: str
    user: UserOut

class SignatureRequestCreate(BaseModel):
    signer_name: str = Field(min_length=1, max_length=120)
    signer_email: EmailStr

class SignSubmit(BaseModel):
    signature_data_url: str  # base64 data URL of PNG

# ---------------------- Auth Endpoints ----------------------
@api_router.post("/auth/register", response_model=AuthResponse)
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": user_id,
        "name": payload.name.strip(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "created_at": created_at,
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email)
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=ACCESS_TOKEN_EXPIRE_HOURS * 3600, path="/")
    return AuthResponse(token=token, user=UserOut(id=user_id, name=doc["name"], email=email, created_at=created_at))

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email)
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=ACCESS_TOKEN_EXPIRE_HOURS * 3600, path="/")
    return AuthResponse(
        token=token,
        user=UserOut(id=user["id"], name=user["name"], email=user["email"], created_at=user["created_at"]),
    )

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(id=user["id"], name=user["name"], email=user["email"], created_at=user["created_at"])

# ---------------------- Document Endpoints ----------------------
@api_router.post("/documents/upload")
async def upload_document(
    title: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 20MB limit")
    doc_id = str(uuid.uuid4())
    safe_name = f"{doc_id}.pdf"
    original_path = ORIGINAL_DIR / safe_name
    with open(original_path, "wb") as f:
        f.write(contents)
    doc = {
        "id": doc_id,
        "owner_id": user["id"],
        "title": title.strip() or file.filename,
        "original_filename": file.filename,
        "original_file": str(safe_name),
        "signed_file": None,
        "status": "draft",  # draft | pending | signed
        "size_bytes": len(contents),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.documents.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/documents")
async def list_documents(user: dict = Depends(get_current_user)):
    docs = await db.documents.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs

@api_router.get("/documents/{doc_id}")
async def get_document(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id, "owner_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # attach signature requests
    reqs = await db.signature_requests.find({"document_id": doc_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    doc["signature_requests"] = reqs
    return doc

@api_router.get("/documents/{doc_id}/file")
async def download_document(doc_id: str, kind: str = "original", user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id, "owner_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if kind == "signed":
        if not doc.get("signed_file"):
            raise HTTPException(status_code=404, detail="Signed file not available")
        path = SIGNED_DIR / doc["signed_file"]
    else:
        path = ORIGINAL_DIR / doc["original_file"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="File missing on server")
    return FileResponse(str(path), media_type="application/pdf", filename=f"{doc['title']}.pdf")

@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id, "owner_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    for fn in (doc.get("original_file"), doc.get("signed_file")):
        if not fn:
            continue
        for d in (ORIGINAL_DIR, SIGNED_DIR):
            p = d / fn
            if p.exists():
                try:
                    p.unlink()
                except Exception:
                    pass
    await db.documents.delete_one({"id": doc_id})
    await db.signature_requests.delete_many({"document_id": doc_id})
    return {"ok": True}

# ---------------------- Signature Requests ----------------------
@api_router.post("/documents/{doc_id}/signature-requests")
async def create_signature_request(
    doc_id: str,
    payload: SignatureRequestCreate,
    user: dict = Depends(get_current_user),
):
    doc = await db.documents.find_one({"id": doc_id, "owner_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc["status"] == "signed":
        raise HTTPException(status_code=400, detail="Document is already signed")
    req_id = str(uuid.uuid4())
    token = secrets.token_urlsafe(32)
    req = {
        "id": req_id,
        "document_id": doc_id,
        "owner_id": user["id"],
        "signer_name": payload.signer_name.strip(),
        "signer_email": payload.signer_email.lower().strip(),
        "token": token,
        "status": "pending",  # pending | signed
        "created_at": datetime.now(timezone.utc).isoformat(),
        "signed_at": None,
    }
    await db.signature_requests.insert_one(req)
    await db.documents.update_one({"id": doc_id}, {"$set": {"status": "pending"}})
    req.pop("_id", None)
    return req

# ---------------------- Public Signing ----------------------
@api_router.get("/public/sign/{token}")
async def public_get_request(token: str):
    req = await db.signature_requests.find_one({"token": token}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Invalid signing link")
    doc = await db.documents.find_one({"id": req["document_id"]}, {"_id": 0, "owner_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"request": req, "document": {"id": doc["id"], "title": doc["title"], "status": doc["status"]}}

@api_router.get("/public/sign/{token}/file")
async def public_get_file(token: str):
    req = await db.signature_requests.find_one({"token": token})
    if not req:
        raise HTTPException(status_code=404, detail="Invalid signing link")
    doc = await db.documents.find_one({"id": req["document_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # serve signed if exists else original
    if doc.get("signed_file"):
        path = SIGNED_DIR / doc["signed_file"]
    else:
        path = ORIGINAL_DIR / doc["original_file"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="File missing")
    return FileResponse(str(path), media_type="application/pdf", filename=f"{doc['title']}.pdf")

def embed_signature_into_pdf(orig_path: Path, signed_path: Path, sig_data_url: str, signer_name: str) -> None:
    if "," in sig_data_url:
        _, encoded = sig_data_url.split(",", 1)
    else:
        encoded = sig_data_url
    img_bytes = base64.b64decode(encoded)

    reader = PdfReader(str(orig_path))
    writer = PdfWriter()
    last_idx = len(reader.pages) - 1
    for i, page in enumerate(reader.pages):
        if i == last_idx:
            mb = page.mediabox
            width = float(mb.width)
            height = float(mb.height)
            overlay_io = BytesIO()
            c = rl_canvas.Canvas(overlay_io, pagesize=(width, height))
            sig_w = min(220.0, width * 0.4)
            sig_h = sig_w * 0.4
            x = 40
            y = 60
            try:
                img_reader = ImageReader(BytesIO(img_bytes))
                c.drawImage(img_reader, x, y + 20, width=sig_w, height=sig_h, mask='auto', preserveAspectRatio=True)
            except Exception as e:
                logger.warning(f"Failed to draw signature image: {e}")
            c.setFont("Helvetica", 9)
            c.setFillColorRGB(0.25, 0.25, 0.28)
            c.line(x, y + 18, x + sig_w, y + 18)
            c.drawString(x, y + 8, f"Signed by: {signer_name}")
            c.drawString(x, y - 4, f"Date: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
            c.save()
            overlay_io.seek(0)
            overlay_reader = PdfReader(overlay_io)
            page.merge_page(overlay_reader.pages[0])
        writer.add_page(page)
    with open(signed_path, "wb") as f:
        writer.write(f)

@api_router.post("/public/sign/{token}")
async def public_submit_signature(token: str, payload: SignSubmit):
    req = await db.signature_requests.find_one({"token": token})
    if not req:
        raise HTTPException(status_code=404, detail="Invalid signing link")
    if req["status"] == "signed":
        raise HTTPException(status_code=400, detail="Already signed")
    doc = await db.documents.find_one({"id": req["document_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    orig_path = ORIGINAL_DIR / doc["original_file"]
    if not orig_path.exists():
        raise HTTPException(status_code=404, detail="Original file missing")
    signed_filename = f"{doc['id']}_signed.pdf"
    signed_path = SIGNED_DIR / signed_filename
    try:
        embed_signature_into_pdf(orig_path, signed_path, payload.signature_data_url, req["signer_name"])
    except Exception as e:
        logger.exception("Failed to embed signature")
        raise HTTPException(status_code=500, detail=f"Failed to embed signature: {e}")

    signed_at = datetime.now(timezone.utc).isoformat()
    await db.signature_requests.update_one(
        {"token": token},
        {"$set": {"status": "signed", "signed_at": signed_at}},
    )
    await db.documents.update_one(
        {"id": doc["id"]},
        {"$set": {"status": "signed", "signed_file": signed_filename, "signed_at": signed_at}},
    )
    return {"ok": True, "signed_at": signed_at}

# ---------------------- Dashboard ----------------------
@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    owner_id = user["id"]
    total = await db.documents.count_documents({"owner_id": owner_id})
    pending = await db.documents.count_documents({"owner_id": owner_id, "status": "pending"})
    signed = await db.documents.count_documents({"owner_id": owner_id, "status": "signed"})
    drafts = await db.documents.count_documents({"owner_id": owner_id, "status": "draft"})
    recent_docs = await db.documents.find({"owner_id": owner_id}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)
    recent_reqs = await db.signature_requests.find({"owner_id": owner_id}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)
    activity = []
    for d in recent_docs:
        activity.append({
            "type": "document",
            "title": d["title"],
            "status": d["status"],
            "at": d["created_at"],
            "doc_id": d["id"],
        })
    for r in recent_reqs:
        activity.append({
            "type": "signature_request",
            "title": f"Request for {r['signer_name']}",
            "status": r["status"],
            "at": r.get("signed_at") or r["created_at"],
            "doc_id": r["document_id"],
        })
    activity.sort(key=lambda x: x["at"], reverse=True)
    return {
        "totals": {"total": total, "pending": pending, "signed": signed, "drafts": drafts},
        "activity": activity[:10],
    }

# ---------------------- Health ----------------------
@api_router.get("/")
async def root():
    return {"service": "DocuSign MVP", "status": "ok"}

# ---------------------- App wiring ----------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.documents.create_index("id", unique=True)
    await db.documents.create_index("owner_id")
    await db.signature_requests.create_index("token", unique=True)
    await db.signature_requests.create_index("document_id")
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Admin",
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded admin user: %s", admin_email)
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )

@app.on_event("shutdown")
async def on_shutdown():
    client.close()
