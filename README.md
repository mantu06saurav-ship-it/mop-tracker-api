# MOP Tracker

This repository contains the MOP Tracker frontend and backend as separate projects:

- [`backend/`](backend/): FastAPI API and its Python dependencies. See [backend setup](backend/README.md).
- [`frontend/`](frontend/): Next.js user interface. See [frontend setup](frontend/README.md).
- [`render.yaml`](render.yaml): Render configuration for deploying the API and frontend as separate services.

The frontend calls the backend over HTTP. Configure the backend's `CORS_ORIGINS` with the deployed frontend URL after both services are live.
