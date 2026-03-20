# Digital Newspaper

A full-stack digital newspaper platform built with **FastAPI, Next.js, MongoDB, and Redis**.

The system allows newspapers to upload daily PDF editions, automatically converts them into optimized page images, and serves them through a responsive epaper viewer.

---

# Features

• Upload daily newspaper PDFs
• Automatic PDF → page image conversion using `pdftoppm`
• Responsive epaper viewer with zoom
• Article publishing system
• Advertisement management
• Admin dashboard
• Redis caching for faster page loading
• Dockerized deployment
• Nginx reverse proxy for static assets

---

# Architecture

Frontend
Next.js (React + TypeScript)

Backend
FastAPI (Python)

Database
MongoDB

Cache
Redis

Infrastructure
Docker + Nginx

```
Browser
   ↓
Nginx
   ↓
Next.js Frontend
   ↓
FastAPI Backend
   ↓
MongoDB + Redis
```

---

# Project Structure

```
backend/      FastAPI backend
frontend/     Next.js frontend
nginx/        Reverse proxy configuration
uploads/      Generated epaper images
docker-compose.yml
```

---

# PDF Processing Pipeline

1. Admin uploads a PDF newspaper.
2. Backend processes the PDF using `pdftoppm`.
3. Each page is converted into high-resolution images.
4. Image URLs are stored in MongoDB.
5. Frontend loads the images dynamically in the epaper viewer.

```
PDF Upload
     ↓
pdftoppm Conversion
     ↓
Page Images
     ↓
Database Storage
     ↓
Viewer
```

---

# Running Locally

Requirements

- Docker
- Docker Compose

Start the system

```
docker-compose up --build
```

Services

Frontend
http://localhost:3000

Backend API
http://localhost:8000

---

# Environment Variables

Create a `.env` file inside `backend`.

Example:

```
MONGO_URI=mongodb://mongodb:27017
DB_NAME=newspaper
SECRET_KEY=change_this_secret
BASE_URL=http://localhost
```

---

# Deployment

The platform is designed to run on a VPS using Docker.

Recommended server:

- 4 GB RAM
- Ubuntu 22.04
- Docker
- Nginx

Example deployment:

```
git clone https://github.com/AbduhHub/Digital-Newspaper
cd Digital-Newspaper
docker-compose up -d --build
```

---

# Future Improvements

• CDN for epaper images
• Multi-newspaper SaaS support
• Full-text search
• Analytics dashboard

---

# License

MIT License
