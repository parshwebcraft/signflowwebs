"""End-to-end backend API tests for DocuSign MVP."""
import os
import io
import base64
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://signature-hub-23.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Tiny 1x1 transparent PNG data URL for signature
SIG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

# Minimal valid PDF bytes
MIN_PDF = (
    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<<>>>>endobj\n"
    b"4 0 obj<</Length 44>>stream\nBT /F1 24 Tf 100 700 Td (Hello) Tj ET\nendstream\nendobj\n"
    b"xref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000100 00000 n \n0000000180 00000 n \n"
    b"trailer<</Size 5/Root 1 0 R>>\nstartxref\n260\n%%EOF\n"
)


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    r = requests.post(f"{API}/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return data["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------------- Health ----------------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------------- Auth ----------------
class TestAuth:
    def test_register_new_user(self):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={"name": "TEST User", "email": email, "password": "secret123"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert data["user"]["email"] == email
        assert data["user"]["name"] == "TEST User"
        assert "id" in data["user"]

    def test_register_duplicate_email(self):
        email = f"dup_{uuid.uuid4().hex[:8]}@example.com"
        r1 = requests.post(f"{API}/auth/register", json={"name": "A", "email": email, "password": "secret123"})
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/auth/register", json={"name": "B", "email": email, "password": "secret123"})
        assert r2.status_code == 400

    def test_login_admin_success(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 0

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@example.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "admin@example.com"
        assert "id" in data


# ---------------- Documents ----------------
class TestDocuments:
    doc_id = None

    def test_upload_non_pdf_rejected(self, admin_headers):
        files = {"file": ("test.txt", b"hello", "text/plain")}
        data = {"title": "Bad"}
        r = requests.post(f"{API}/documents/upload", headers=admin_headers, files=files, data=data)
        assert r.status_code == 400

    def test_upload_pdf_success(self, admin_headers):
        files = {"file": ("TEST_doc.pdf", MIN_PDF, "application/pdf")}
        data = {"title": "TEST Document"}
        r = requests.post(f"{API}/documents/upload", headers=admin_headers, files=files, data=data)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["status"] == "draft"
        assert doc["title"] == "TEST Document"
        assert "id" in doc
        assert "_id" not in doc
        TestDocuments.doc_id = doc["id"]

    def test_list_documents(self, admin_headers):
        r = requests.get(f"{API}/documents", headers=admin_headers)
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list)
        assert any(d["id"] == TestDocuments.doc_id for d in docs)

    def test_list_documents_isolated_per_user(self):
        # Create new user and verify they don't see admin's docs
        email = f"isol_{uuid.uuid4().hex[:8]}@example.com"
        reg = requests.post(f"{API}/auth/register", json={"name": "Iso", "email": email, "password": "secret123"})
        assert reg.status_code == 200
        tok = reg.json()["token"]
        r = requests.get(f"{API}/documents", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200
        docs = r.json()
        assert all(d["id"] != TestDocuments.doc_id for d in docs)

    def test_get_document_details(self, admin_headers):
        assert TestDocuments.doc_id
        r = requests.get(f"{API}/documents/{TestDocuments.doc_id}", headers=admin_headers)
        assert r.status_code == 200
        doc = r.json()
        assert doc["id"] == TestDocuments.doc_id
        assert "signature_requests" in doc
        assert isinstance(doc["signature_requests"], list)

    def test_download_original(self, admin_headers):
        r = requests.get(f"{API}/documents/{TestDocuments.doc_id}/file?kind=original", headers=admin_headers)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF")


# ---------------- Signature Requests & Public Signing ----------------
class TestSigning:
    sign_token = None
    doc_id = None

    def test_create_signature_request(self, admin_headers):
        # Upload fresh doc
        files = {"file": ("TEST_sign.pdf", MIN_PDF, "application/pdf")}
        up = requests.post(f"{API}/documents/upload", headers=admin_headers, files=files, data={"title": "TEST Sign"})
        assert up.status_code == 200
        doc_id = up.json()["id"]
        TestSigning.doc_id = doc_id

        r = requests.post(
            f"{API}/documents/{doc_id}/signature-requests",
            headers={**admin_headers, "Content-Type": "application/json"},
            json={"signer_name": "Test Signer", "signer_email": "signer@test.com"},
        )
        assert r.status_code == 200, r.text
        req = r.json()
        assert "token" in req
        assert req["status"] == "pending"
        TestSigning.sign_token = req["token"]

        # Verify doc status flipped to pending
        d = requests.get(f"{API}/documents/{doc_id}", headers=admin_headers).json()
        assert d["status"] == "pending"

    def test_public_get_request_no_auth(self):
        assert TestSigning.sign_token
        r = requests.get(f"{API}/public/sign/{TestSigning.sign_token}")
        assert r.status_code == 200
        data = r.json()
        assert "request" in data
        assert "document" in data
        assert data["request"]["status"] == "pending"

    def test_public_get_file_no_auth(self):
        r = requests.get(f"{API}/public/sign/{TestSigning.sign_token}/file")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF")

    def test_public_submit_signature(self, admin_headers):
        r = requests.post(
            f"{API}/public/sign/{TestSigning.sign_token}",
            json={"signature_data_url": SIG_DATA_URL},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Verify document status now signed
        d = requests.get(f"{API}/documents/{TestSigning.doc_id}", headers=admin_headers).json()
        assert d["status"] == "signed"
        # Signed file downloadable
        sd = requests.get(f"{API}/documents/{TestSigning.doc_id}/file?kind=signed", headers=admin_headers)
        assert sd.status_code == 200
        assert sd.content.startswith(b"%PDF")

    def test_public_submit_already_signed(self):
        r = requests.post(
            f"{API}/public/sign/{TestSigning.sign_token}",
            json={"signature_data_url": SIG_DATA_URL},
        )
        assert r.status_code == 400


# ---------------- Dashboard ----------------
class TestDashboard:
    def test_stats(self, admin_headers):
        r = requests.get(f"{API}/dashboard/stats", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "totals" in data and "activity" in data
        for k in ("total", "pending", "signed", "drafts"):
            assert k in data["totals"]
            assert isinstance(data["totals"][k], int)
        assert isinstance(data["activity"], list)
