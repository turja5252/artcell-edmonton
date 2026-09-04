# Artcell Edmonton Show

A phone-first board for the Artcell Edmonton concert team. It starts from the [outreach spreadsheet](https://docs.google.com/spreadsheets/d/1v85LqFr8duSQ-eG0rvwGZtf_v-n4SZoL3xbgDe8itsI) and lets anyone with the link claim a company, mark the call done, and leave what happened.

## What you can do

- Pick your name once. Your open list is one tap away.
- Claim unassigned contacts, mark them done, and tap a result chip (waiting, confirmed, declined, and so on).
- Add a new company so it shows up for the whole group.
- See who is carrying how many names on the Team tab.
- Open setlist cues in YouTube at the exact timestamp.

Updates are shared on this server (saved to `data/leads.json`). Anyone with the link can edit — there is no login. Pull new rows from the Google Sheet with the refresh button; existing notes are not overwritten.

## Run locally

```bash
npm install
npm run dev -- --port 43217
```

Open [http://localhost:43217](http://localhost:43217) on your phone (same Wi-Fi) or laptop.

```bash
npm run build
npm start -- --port 43217
```

## Notes

- The board is meant to be shared in the group chat. Add it to the home screen on iOS/Android for app-like access.
- File storage works for a local or always-on server. A serverless host will not keep writes after restart unless you add a database or Google Sheets write access later.
