# Artcell Edmonton Show

Phone board for the Artcell Edmonton concert team. Starts from the [sponsor search list](https://docs.google.com/spreadsheets/d/1v85LqFr8duSQ-eG0rvwGZtf_v-n4SZoL3xbgDe8itsI).

## Phone board

- **Calls** — claim a company, mark the call done, leave what happened.
- **Money** — set a target, log committed and received, see grand total and remaining.
- **Seats** — attendance outreach: who you invited, seats, confirmed / maybe / remaining.
- **Team** — add organizers to the roster; they appear in “Who are you?” and assignment lists.
- **Songs** — setlist cues.

Anyone with the link can tap. No login.

## Share with phones (public host)

The app must be on a public URL (not `localhost`) for the group chat.

**Fastest permanent path**

1. Click **Create repo** in Cursor so this project is on GitHub.
2. Sign up at [vercel.com](https://vercel.com) with that GitHub account (free).
3. Import this repo → Deploy.
4. Send the `*.vercel.app` link in the group chat.

**Important:** Vercel’s free plan does not keep file writes after a restart. For a concert team where everyone edits the same board, we should add a free database (Turso or Neon) before/at deploy so pledges and invites stick. Say the word and I’ll wire that in.

A temporary Cloudflare tunnel can also expose this agent’s copy while the session is running — that link dies when the agent stops.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:43217](http://localhost:43217).

```bash
npm run build
npm start
```

Optional Excel export still lives at `/Artcell-Edmonton-Show.xlsx` if someone wants an offline copy — the phone board is the main product.
