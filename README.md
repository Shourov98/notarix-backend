# notarix-backend

## Deployment target

The final production target is **AWS** (ECS / Fargate / EC2 behind an ALB, or Elastic Beanstalk). **Render is only a temporary stand-in** for development, demos, and pre-launch validation while the AWS infrastructure is being provisioned.

When migrating from Render to AWS:

- The application is platform-agnostic — it only needs a Node.js 20+ runtime, persistent disk for `tmp/uploads` (or switch `STORAGE_PROVIDER=cloudinary`), and a public HTTPS endpoint.
- All required env vars below map 1:1 to AWS Secrets Manager / Parameter Store / ECS task definition env.
- WebSocket support is native on Render, ALB, and CloudFront — no extra config needed. (Socket.IO falls back to long polling if WS is unavailable.)
- File uploads use `multer` to a local `tmp/` directory by default; for AWS, mount an EFS volume at `tmp/uploads` or set `STORAGE_PROVIDER=cloudinary` (recommended) so files go straight to S3-backed Cloudinary.

## Render deployment (temporary)

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

## AWS migration checklist (when ready)

- [ ] Provision ECS Fargate service (or EB environment) with Node.js 20 runtime, 512MB+ RAM, port 5191.
- [ ] Move secrets to AWS Secrets Manager (`JWT_*`, `BANK_INFO_*`, `SMTP_*`, `CLOUDINARY_*`, super admin creds).
- [ ] Move `MONGODB_URI` to a managed MongoDB Atlas cluster (private peering preferred) or Amazon DocumentDB-compatible setup.
- [ ] Front the service with an ALB (HTTPS via ACM cert) — enables native WebSocket upgrade for Socket.IO.
- [ ] Replace `tmp/uploads` local disk with EFS mount, or (recommended) set `STORAGE_PROVIDER=cloudinary` to keep files in Cloudinary's S3-backed storage.
- [ ] Update `APP_URL` to the ALB / CloudFront origin and `CORS_ORIGIN` / `SOCKET_CORS_ORIGIN` to the real Vercel / CloudFront URLs.
- [ ] Add CloudWatch log group for the container, plus a basic alarm on 5xx rate.
- [ ] Tear down the Render service once AWS is serving production traffic.

