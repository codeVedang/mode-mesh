# ModeMesh AI — Render Deployment

This repository is configured to deploy as one Render Blueprint containing:

- one static Vite frontend;
- one public API gateway;
- four token-protected backend web services (auth, chat, agent, and billing);
- one free Render Key Value instance for Redis-compatible sessions and rate limits.

The blueprint is defined in `render.yaml`. Secret values are intentionally excluded from Git.

## 1. Create a dedicated Git repository

The project folder must be its own repository. Run these commands from
`D:\cortexAI\1.cortexAI`, not from `D:\`:

```powershell
git init
git branch -M main
git add .
git status
git commit -m "Prepare ModeMesh AI for deployment"
```

Before committing, confirm that none of these appear in the staged-file list:

- `deployment-secrets.local.env`
- any `.env` file
- `serviceAccountKey.json`

Create an empty GitHub repository named `modemesh-ai`, then connect and push it:

```powershell
git remote add origin https://github.com/codeVedang/modemesh-ai.git
git push -u origin main
```

## 2. Create the Render Blueprint

1. Open the Render Dashboard.
2. Select **New > Blueprint**.
3. Connect the `modemesh-ai` GitHub repository.
4. Keep the Blueprint path as `render.yaml`.
5. Render will display fields for every variable marked `sync: false`.

Use `deployment-secrets.local.env` as the private source for the prompted values.

### Prompted-value mapping

| Render variable | Copy from local secret file |
| --- | --- |
| `MONGODB_URI` | `MONGODB_URI` (same value wherever prompted) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `FIREBASE_SERVICE_ACCOUNT_JSON` |
| `GROQ_API_KEY` | `GROQ_API_KEY` |
| `GOOGLE_API_KEY` | `GOOGLE_API_KEY` |
| `TAVILY_API_KEY` | `TAVILY_API_KEY` |
| `OPENROUTER_API_KEY` | `OPENROUTER_API_KEY` |
| `QDRANT_URL` | `QDRANT_URL` |
| `QDRANT_API_KEY` | `QDRANT_API_KEY` |
| `AWS_ACCESS_KEY_ID` | `AWS_ACCESS_KEY_ID` |
| `AWS_SECRET_KEY` | `AWS_SECRET_KEY` |
| `RAZORPAY_KEY_ID` | `RAZORPAY_KEY_ID` |
| `RAZORPAY_KEY_SECRET` | `RAZORPAY_KEY_SECRET` |
| `VITE_FIREBASE_API_KEY` | `VITE_FIREBASE_API_KEY` |
| `VITE_RAZORPAY_KEY_ID` | `RAZORPAY_KEY_ID` |

Do not enter or override `INTERNAL_SERVICE_TOKEN`. Render generates it on the gateway and shares it with the four internal services.
Render also creates and wires `REDIS_URL` automatically, so the local private Redis URL is not entered during Blueprint creation.

## 3. Provider configuration after deployment

The Blueprint expects these public addresses:

```text
Frontend: https://modemesh-vedang.onrender.com
Gateway:  https://modemesh-vedang-api.onrender.com
Auth:     https://modemesh-vedang-auth.onrender.com
Chat:     https://modemesh-vedang-chat.onrender.com
Agent:    https://modemesh-vedang-agent.onrender.com
Billing:  https://modemesh-vedang-billing.onrender.com
```

If Render reports that a service name is unavailable, change every matching service name and URL in `render.yaml` before retrying.

After the frontend deploys:

1. Add `modemesh-vedang.onrender.com` to Firebase Authentication's authorized domains.
2. Ensure Google is enabled under Firebase Authentication providers.
3. Ensure MongoDB Atlas permits connections from Render. For a same-day demo, `0.0.0.0/0` works but should later be replaced with restricted networking.
4. Keep the S3 bucket private.
5. Keep Razorpay in Test Mode until the complete payment flow is verified.

## 4. Smoke tests

Open each health endpoint first:

```text
https://modemesh-vedang-auth.onrender.com/
https://modemesh-vedang-chat.onrender.com/
https://modemesh-vedang-agent.onrender.com/
https://modemesh-vedang-billing.onrender.com/
https://modemesh-vedang-api.onrender.com/
```

Then test in this order:

1. Firebase Google login.
2. Text chat.
3. Voice recognition and spoken response.
4. Web-search agent.
5. Coding agent.
6. PDF upload and RAG.
7. Image analysis.
8. Razorpay Test Mode checkout.

Render free web services sleep after inactivity. The first request after sleeping can take about a minute, and a gateway request might need to wake an internal service too.
