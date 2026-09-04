# Artcell Edmonton Show

Phone board for the Artcell Edmonton concert team.  
GitHub: [turja5252/artcell-edmonton](https://github.com/turja5252/artcell-edmonton)

## Phone board

- **Calls** — claim a company, mark done, leave what happened, upload/download sponsor photos & PDFs
- **Money** — target, pledged, received
- **Seats** — tickets sold (with last-updated day), call list with first/last name, phone, email, team assignment, Call button, confirmed / tentative / declined + member count. Add people manually, from Android phone contacts (Chrome), or by importing a .vcf / .csv (iPhone & Android).
- **Team** — add organizers
- **Songs** — setlist cues

Anyone with the link can tap. No login.

## Deploy to Vercel (public phone link)

1. Push this repo to GitHub (if it isn’t already).
2. Open [vercel.com/new](https://vercel.com/new)
3. Import **turja5252/artcell-edmonton**
4. Click **Deploy**
5. Share the `*.vercel.app` URL in the group chat

Framework preset: Next.js. Build command: `npm run build`. Output: default.

**Note:** On Vercel’s free plan, file writes can reset when the server sleeps. For a lasting shared board, add a free Turso/Neon database after the first deploy.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:43217](http://localhost:43217).
