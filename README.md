# CSV Analyzer Pro by Vraj

An end-to-end CSV analytics workspace with statistics, interactive charts, and
in-browser machine learning. Ships with an optional FastAPI backend that mirrors
the frontend feature set for server-side workflows.

## Highlights

- Drag-and-drop CSV upload (up to 100 MB), fully parsed in the browser
- Automatic column typing (numeric, integer, boolean, date, string)
- Data cleaning: duplicate removal, missing-value imputation, IQR outlier trim
- Descriptive statistics: mean/median/mode, quartiles, stdev, skew, kurtosis, outliers
- Correlation heatmap and interactive Recharts visualisations
- ML Studio: Linear Regression, KNN classification, K-Means clustering with metrics
- Reports: PDF (jsPDF), Excel (xlsx), cleaned CSV, and JSON exports
- Persistent recent-uploads history + dark mode (Zustand + localStorage)
- Optional FastAPI backend with Pandas / Scikit-learn / SQLite for server-side use

## Frontend

TanStack Start (React 19 + Vite), Tailwind v4, Shadcn UI, Recharts, Framer Motion,
Zustand, Papa Parse, simple-statistics, ml-regression, ml-kmeans, jspdf, xlsx.

```bash
bun install
bun run dev
```

Open http://localhost:8080.

### Routes

| Path        | Description                                          |
| ----------- | ---------------------------------------------------- |
| `/`         | Dashboard, upload dropzone, recent history           |
| `/preview`  | Table view with search, sort, cleaning controls      |
| `/analyze`  | Descriptive stats, distributions, correlation matrix |
| `/ml`       | ML Studio (regression, classification, clustering)   |
| `/reports`  | PDF / Excel / CSV / JSON export                      |

## Backend (optional)

Python 3.12 · FastAPI · Pandas · Scikit-learn · SQLAlchemy · SQLite.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Explore the API at http://localhost:8000/docs.

### Key endpoints

| Method | Path                          | Purpose                            |
| ------ | ----------------------------- | ---------------------------------- |
| GET    | `/api/health`                 | Liveness probe                     |
| POST   | `/api/uploads`                | Upload CSV (multipart)             |
| GET    | `/api/uploads`                | List recent uploads                |
| GET    | `/api/analysis/{upload_id}`   | Full statistical analysis          |
| POST   | `/api/ml/train`               | Train regression/classification/kmeans |
| GET    | `/api/reports/{id}/excel`     | Download Excel report              |
| GET    | `/api/reports/{id}/json`      | Download JSON report               |

Run backend tests:

```bash
cd backend && pytest
```

## Docker

Build the frontend once (`bun run build`) then:

```bash
docker compose up --build
```

- Backend → http://localhost:8000
- Frontend (Nginx serving `dist/`, proxying `/api` to backend) → http://localhost:8080

## Project layout

```
.
├── src/                        # TanStack Start frontend
│   ├── components/             # UI: layout, upload, data, charts, dashboard
│   ├── lib/
│   │   ├── csv/parser.ts       # CSV → typed dataset
│   │   ├── analysis/           # statistics, cleaning
│   │   ├── ml/models.ts        # regression / classification / clustering
│   │   └── reports/exporters.ts# PDF / Excel / CSV / JSON exports
│   ├── routes/                 # File-based routes
│   └── store/dataset-store.ts  # Zustand persistent store
├── backend/                    # FastAPI + Pandas + Scikit-learn service
│   ├── app/
│   │   ├── api/routes/
│   │   ├── core/
│   │   ├── db/
│   │   ├── services/
│   │   └── main.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── README.md
```

## Security notes

- All CSVs stay in the browser when using the frontend-only flow
- The FastAPI service enforces per-IP rate limiting, extension whitelist, and a
  size cap (`ACAP_MAX_UPLOAD_BYTES`, default 100 MB)
- Files are stored under `ACAP_UPLOAD_DIR`; SQLite metadata in `ACAP_DATABASE_URL`

## License

MIT.
