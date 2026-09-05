# Artcell Edmonton Show

Phone board for the Artcell Edmonton concert team.  
GitHub: [turja5252/artcell-edmonton](https://github.com/turja5252/artcell-edmonton)

## Phone board

- **Calls** — claim a company, mark done, leave what happened, upload/download sponsor photos & PDFs
- **Money** — target, pledged, received
- **Seats** — tickets sold (with last-updated day), call list with first/last name, phone, email, team assignment, Call button, confirmed / tentative / declined + member count. Add people manually, from Android phone contacts (Chrome), or by importing a .vcf / .csv (iPhone & Android).
- **List** — shared show tasks with due dates
- **Team** — roster + workload. Tanzim and everyone else stay regular users.
- **Media** — shared promo photos, videos, and PDFs. Anyone on the team can upload. On Vercel, videos go straight to Blob so iPhone clips are not capped by serverless POST size.

Anyone with the link can tap. No login.

## Install as an app

Open [artcell-edmonton.vercel.app](https://artcell-edmonton.vercel.app) in the phone browser, then:

- **iPhone (Safari):** Share → **Add to Home Screen** → Add. The board opens full-screen as **Artcell**.
- **Android (Chrome):** tap **Install** on the banner, or the menu → **Install app** / **Add to Home Screen**.

## Permanent hosting (Vercel)

This is the lasting public phone URL for the team.

### 1. Put the code on GitHub

Repo: [turja5252/artcell-edmonton](https://github.com/turja5252/artcell-edmonton)

Push `main` there (from your machine, or give the agent a GitHub token with repo write).

### 2. Deploy on Vercel

1. Open [vercel.com/new](https://vercel.com/new)
2. Import **turja5252/artcell-edmonton**
3. Framework: **Next.js** (auto)
4. Click **Deploy**

### 3. Add durable storage (required for permanent data)

Without this, ticket counts / call updates / files can reset on Vercel.

1. In the Vercel project → **Storage** → create a **Blob** store
2. Connect it to this project (adds `BLOB_READ_WRITE_TOKEN`)
3. Redeploy

When `BLOB_READ_WRITE_TOKEN` is set, board data and sponsor files are stored in Vercel Blob and survive deploys.

### 4. Share the link

Use the `*.vercel.app` URL (or your custom domain) in the group chat.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:43217](http://localhost:43217).

Optional for local blob testing:

```bash
cp .env.example .env.local
# set BLOB_READ_WRITE_TOKEN=...
```
