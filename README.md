# CYBS-F26A

AI-powered exam preparation platform for cybersecurity students. Upload lecture slides or PDFs, get AI-generated questions based on the material — and for Forretningsforståelse, questions are enriched with context from the course book via RAG.

## What it does

- Upload lecture slides (PPTX/PPT) or PDFs
- Select your subject (Programmering, Forretningsforståelse, Computerarkitektur, General)
- AI generates subject-specific questions in Danish:
  - **MCQ** — multiple choice with explanations
  - **Kodeopgaver** — live Python exercises with in-browser execution (Pyodide)
- Quiz yourself with instant feedback
- Sessions are cached in localStorage — previously generated questions load instantly
- RAG pipeline for Forretningsforståelse — retrieves relevant context from the course book before generating questions

## Tech Stack

### Frontend
- React + Vite
- CodeMirror 6 — in-browser code editor with Python syntax highlighting
- Pyodide — Python runtime in the browser (WASM)
- localStorage — client-side session caching

### Backend
- Python + Flask
- Anthropic Claude Haiku — question generation
- ChromaDB — vector database for RAG
- ChromaDB DefaultEmbeddingFunction (all-MiniLM-L6-v2) — embeddings
- markitdown — PPTX/PPT text extraction
- pypdf — PDF text extraction

### Infrastructure
- Raspberry Pi 5 — self-hosted
- Nginx — reverse proxy + static file serving
- Cloudflare Tunnel — secure public access without exposed ports
- GitHub Actions — CI/CD auto-deploy on push to main

## Project Structure
```
studymindv1/
├── .github/
│   └── workflows/
│       └── deploy.yml         # CI/CD pipeline
├── backend/
│   ├── main.py                # Flask app + routes
│   ├── prompts/               # Subject-specific Claude prompts
│   │   ├── programmering.txt
│   │   ├── forretningsforstaelse.txt
│   │   ├── computerarkitektur.txt
│   │   └── general.txt
│   └── rag/
│       ├── embedder.py        # Chunking + ChromaDB storage
│       ├── retriever.py       # Vector similarity search
│       └── ingester.py        # File ingestion pipeline
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Main app + session management
│   │   ├── App.css            # Global styles
│   │   ├── constants.js       # API URL + subjects
│   │   ├── components/
│   │   │   ├── CodeQuestion.jsx   # Live coding component
│   │   │   └── MCQQuestion.jsx    # Multiple choice component
│   │   └── hooks/
│   │       └── usePyodide.js      # Pyodide runtime hook
└── README.md
```

## Setup

### Prerequisites
- Python 3.12+
- Node.js 20+
- Anthropic API key

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install flask flask-cors pypdf anthropic python-dotenv chromadb
pip install "markitdown[pptx]"
```

Create `.env`:
```
ANTHROPIC_API_KEY=your_key_here
```

Start:
```bash
python main.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload PPTX/PDF, extract text, generate questions |
| POST | `/ingest` | Ingest book/slides into ChromaDB vector store |
| POST | `/generate` | Generate questions from stored embeddings by topic |
| GET | `/` | Health check |

## RAG Setup (Forretningsforståelse)

Ingest the course book once:
```bash
curl -X POST http://127.0.0.1:5300/ingest \
  -F "file=@/path/to/book.pdf" \
  -F "subject=Forretningsforståelse" \
  -F "source=book"
```

After ingestion, all uploads for Forretningsforståelse automatically retrieve relevant book chunks before generating questions.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |

## Deployment

Hosted on Raspberry Pi 5 via Cloudflare Tunnel. Auto-deploys on push to `main` via GitHub Actions — builds frontend, pulls latest code on Pi, restarts services.

## License

MIT
