# DocuSign MVP - Document Signing Platform

A lightweight and secure document signing web application. This project features a FastAPI backend backed by MongoDB and a React frontend built with Tailwind CSS.

Developed by **Gauransh Jaroli**.

---

## Project Structure

```text
├── backend/            # FastAPI Python server
│   ├── server.py       # Main server code
│   └── requirements.txt# Backend python dependencies
├── frontend/           # React frontend application
│   ├── src/            # Frontend components, pages, and context
│   └── package.json    # Frontend node dependencies
└── README.md           # Deployment and setup documentation
```

---

## Local Development Setup

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- MongoDB running locally on port `27017`

### 1. Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend/` directory:
   ```env
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=docusign_mvp
   JWT_SECRET=your_jwt_secret_here
   CORS_ORIGINS=http://localhost:3004
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=admin123
   ```
5. Start the backend server:
   ```bash
   python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
   ```

### 2. Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd ../frontend
   ```
2. Install the dependencies:
   ```bash
   npm install --legacy-peer-deps
   npm install ajv@8 --legacy-peer-deps
   ```
3. Create a `.env` file in the `frontend/` directory:
   ```env
   REACT_APP_BACKEND_URL=http://localhost:8000
   ```
4. Start the frontend server:
   ```bash
   PORT=3004 BROWSER=none npm start
   ```
   Open [http://localhost:3004](http://localhost:3004) to access the application.

---

## Production Deployment Steps

### Database Setup (MongoDB Atlas)
Since Render doesn't offer a built-in MongoDB service, it is recommended to use **MongoDB Atlas** (Free Tier):
1. Sign up/log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free shared cluster.
3. In **Database Access**, add a new database user with read/write access.
4. In **Network Access**, allow access from anywhere (`0.0.0.0/0`) since Render IP addresses change dynamically.
5. Copy your connection string (e.g., `mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority`).

---

### Backend Deployment (Render)

Deploy the Python FastAPI server as a **Web Service** on Render:

1. Log in to [Render](https://render.com/).
2. Click **New** -> **Web Service**.
3. Connect your GitHub repository.
4. Set the following configuration parameters:
   - **Name**: `docusign-backend`
   - **Root Directory**: `backend`
   - **Language**: `Python 3`
   - **Branch**: `main`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python -m uvicorn server:app --host 0.0.0.0 --port $PORT`
5. In the **Environment Variables** section, add the following key-value pairs:
   - `MONGO_URL`: *Your MongoDB Atlas Connection String*
   - `DB_NAME`: `docusign_mvp`
   - `JWT_SECRET`: *A secure random string (e.g. `openssl rand -hex 32`)*
   - `CORS_ORIGINS`: *Your Vercel deployment URL (e.g. `https://your-app.vercel.app`)*
   - `ADMIN_EMAIL`: *Your admin email*
   - `ADMIN_PASSWORD`: *Your admin password*
6. Click **Deploy Web Service**.
7. Note down the deployed service URL (e.g., `https://docusign-backend.onrender.com`).

---

### Frontend Deployment (Vercel)

Deploy the React frontend application to Vercel:

1. Log in to [Vercel](https://vercel.com/).
2. Click **Add New** -> **Project**.
3. Import your GitHub repository.
4. In the configuration settings, modify the following:
   - **Project Name**: `docusign-frontend`
   - **Framework Preset**: `Create React App`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
5. Under **Environment Variables**, add:
   - **Key**: `REACT_APP_BACKEND_URL`
   - **Value**: *Your Render backend URL (e.g. `https://docusign-backend.onrender.com`)*
6. Click **Deploy**.
7. Once deployed, copy your frontend production URL.
8. **Crucial Step**: Go back to your **Render Web Service Settings** and update the `CORS_ORIGINS` environment variable to include your new Vercel frontend URL. This allows the frontend to communicate with the backend.
