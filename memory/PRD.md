# Inksign — Document Signature Web App

## Original Problem Statement
Production-ready Document Signature web app. React frontend, FastAPI backend, MongoDB, JWT custom auth (email + password), local file storage for PDFs. Features: register/login, protected dashboard, upload PDFs, list/view/download documents, create signature requests with unique public signing links, public signing page with draw-signature canvas, finalize signature into a new signed PDF (signature embedded at bottom of last page), dashboard with totals + recent activity.

## Architecture
- Frontend: React 19 + React Router + TailwindCSS + shadcn/ui + sonner toasts + react-signature-canvas. Axios with `Authorization: Bearer` from localStorage. AuthContext + ProtectedRoute.
- Backend: FastAPI single-file `server.py` with `/api` prefix. PyJWT + bcrypt auth. Motor (async MongoDB). pypdf + reportlab to embed signature image into PDF last page.
- Storage: `/app/backend/uploads/{original,signed}` for PDFs.
- Auth: JWT in JSON body + httpOnly cookie; client uses Bearer header.

## User Personas
1. **Document Owner** — uploads PDFs, generates signing requests, monitors status, downloads signed copies.
2. **External Signer** — receives a public link, reviews the PDF, draws a signature, submits.

## Core Requirements (Static)
- JWT-protected dashboard routes.
- Public signing flow with unguessable token (URL-safe 32 bytes).
- Signed PDF generated server-side via overlay merge — no client-side trust.
- All API routes under `/api`, env-driven Mongo + JWT secret.

## Implemented (2026-02)
- Auth: register / login / logout / me (`/api/auth/*`), bcrypt hashing, JWT with 7-day expiry.
- Documents: upload (multipart, 20MB cap, PDF only), list, get details, file download (`kind=original|signed`), delete.
- Signature requests: create (`POST /api/documents/{id}/signature-requests`) — generates token, flips document to `pending`.
- Public signing: `GET /api/public/sign/{token}`, `GET /api/public/sign/{token}/file`, `POST /api/public/sign/{token}` — embeds signature PNG + "Signed by / Date" caption at bottom of last page, saves signed PDF, flips request + document status to `signed`.
- Dashboard stats: totals + recent activity feed.
- UI: Split-screen auth, sidebar app shell, KPI dashboard, Linear-style document list, two-column document details with PDF iframe preview, public sign page with react-signature-canvas pad.
- Seeded admin: `admin@example.com / admin123`.
- 19/19 backend pytest cases passing.

## Backlog
- **P1**: Signed-PDF audit trail (signer IP/UA), email delivery of signing links (SendGrid/Resend), drag & drop signature placement.
- **P2**: Multi-signer workflow, sequential signing, signed-PDF cryptographic hash (proof), object storage (S3/Emergent) for deployment persistence.
- **P3**: Role-based teams, subscription billing, branded signing portal.

## Known Limitations
- Local file storage — does not persist across container redeploys. Migrate to object storage for production.
- No rate limiting on auth endpoints (MVP).
- Public sign endpoint returns full request doc including owner_id — minor info leak, acceptable for MVP.

## Next Actions
1. Wire email delivery (Resend / SendGrid) for signing links.
2. Migrate uploads → Emergent Object Storage for production durability.
3. Add an audit log + cryptographic hash on signed PDFs.
