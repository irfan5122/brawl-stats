# Brawl Stats

A dark purple/neon Brawl Stars brawler gallery with a React + TypeScript + Vite frontend and Python FastAPI backend.

## Requirements
- Python 3.10+
- Node.js 20+ and npm
- A Brawl Stars API key from https://developer.brawlstars.com/

## Project layout
```text
brawl-stats/
├── backend/
│   ├── .env.example
│   ├── .gitignore
│   ├── requirements.txt
│   └── main.py
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api.ts
│       ├── types.ts
│       └── styles.css
└── .gitignore
```

## 1. Configure the API key
Copy `backend/.env.example` to `backend/.env`, then add your API key:

```dotenv
BRAWL_STARS_API_KEY=put_your_real_key_here
FRONTEND_ORIGIN=http://localhost:5173
```

Keep `backend/.env` private. Never put the Brawl Stars API key in a frontend `.env` file or commit it to GitHub. The API key must allow the public IP address used by the machine running the backend.

## 2. Run the backend
From the project root:

```bash
cd backend
python -m venv .venv
```

Activate the environment:

Linux/macOS:
```bash
source .venv/bin/activate
```

Windows PowerShell:
```powershell
.venv\Scripts\Activate.ps1
```

Install and run:
```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Backend docs: http://127.0.0.1:8000/docs

## 3. Run the frontend
Open a second terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (normally http://localhost:5173).

## Use
- Enter a player tag such as `#ABC123` and click **Load profile**.
- Switch between **1000+ trophies** and **Below 1000**.
- Cards are grouped by class and sorted from highest to lowest current trophies within each class.
- Filter by class or search by brawler name.
- Refresh to retrieve current stats again.

## Data notes
- Trophy thresholds use **current trophies**. Exactly 1,000 belongs in the 1000+ tab; 999 and below belongs in the Below 1000 tab.
- The official player endpoint supplies the player's brawlers and their current trophy/power information.
- Class and catalogue metadata are fetched from BrawlAPI. If the catalogue is unavailable, the backend will still return player brawlers under `Unknown` class.
- Star Powers, gadgets and gears are displayed only when the player endpoint supplies ownership information. The frontend labels unavailable information as `—`; it does not infer that an item is unlocked.
- BrawlAPI is a third-party catalogue and can change independently of Supercell's official API.
