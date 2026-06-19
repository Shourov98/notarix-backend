# notarix-backend

## Render deployment

This backend no longer relies on localhost defaults in production. Render must provide real values for the required environment variables below or the service will fail at startup.

Required production environment variables:

- `APP_URL`
- `MONGODB_URI`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `BANK_INFO_ENCRYPTION_KEY`
- `STORAGE_PROVIDER=cloudinary`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CORS_ORIGIN`
- `SOCKET_CORS_ORIGIN`

Recommended Render setup:

1. Create a new Web Service from this repo or use [render.yaml](/home/shourov/Documents/work_projects/notarix-full/notarix/notarix-backend/render.yaml).
2. Set `Root Directory` to `notarix-backend` if your repo contains multiple projects.
3. Use `npm ci` as the build command and `npm start` as the start command.
4. Add a managed MongoDB connection string to `MONGODB_URI` or use an external MongoDB provider.
5. Set `APP_URL` to your Render service URL, for example `https://notarix-backend.onrender.com`.
6. Set `CORS_ORIGIN` and `SOCKET_CORS_ORIGIN` to your real frontend URLs, comma-separated if there are multiple.
7. Generate strong random values for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `BANK_INFO_ENCRYPTION_KEY`, and `SUPER_ADMIN_PASSWORD`.

Notes:

- Production startup now requires a real database connection. `MONGODB_OPTIONAL` is ignored in production.
- The service seeds the first super admin from `SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL`, and `SUPER_ADMIN_PASSWORD`.
- The local `.env` file is still supported for development only.
