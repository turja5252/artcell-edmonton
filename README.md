# Artcell Edmonton Show

Phone board and Excel workbook for the Artcell Edmonton concert team. Starts from the [sponsor search list](https://docs.google.com/spreadsheets/d/1v85LqFr8duSQ-eG0rvwGZtf_v-n4SZoL3xbgDe8itsI).

## Phone board

- **Calls** — claim a company, mark the call done, leave what happened.
- **Money** — set a target, log committed and received, see grand total and remaining.
- **Seats** — attendance outreach: who you invited, seats, confirmed / maybe / remaining.
- **Team** — add organizers to the roster; they appear in “Who are you?” and assignment lists.
- **Songs** — setlist cues.

Anyone with the link can tap. No login. The spreadsheet icon downloads the Excel file for Microsoft 365.

## Excel for Microsoft 365

If the crew already lives in OneDrive / Teams, Excel is the simpler shared ledger:

1. Download [Artcell-Edmonton-Show.xlsx](./Artcell-Edmonton-Show.xlsx) (also served at `/Artcell-Edmonton-Show.xlsx`).
2. Upload it to OneDrive. Share → anyone with the link can edit (or your org only).
3. Paste that link in the group chat. On a phone, open it in the Excel app.
4. Yellow cells are for typing. Gray cells are running totals.

Sheets inside the file:

| Sheet | What it does |
| --- | --- |
| Dashboard | Target, committed, received, remaining, confirmed seats, remaining seats |
| Sponsors | The 32 companies plus $ committed / received |
| Attendance | Invite list with status and seat count |
| Setlist | Cues with YouTube timestamps |
| How to share | The same steps as above |

The website and the Excel file are **not linked**. Pick one source of truth, or copy numbers across if you use both.

## Run the phone board

```bash
npm install
npm run dev
```

Open [http://localhost:43217](http://localhost:43217).

```bash
npm run build
npm start
```

To rebuild the Excel file after changing names or cues:

```bash
python3 scripts/build-excel.py
```
