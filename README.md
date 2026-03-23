# StudyMind

AI-powered study platform. Upload your PDFs or PowerPoints, get AI-generated questions for studying.

## What it does

- **Upload** a PDF or PowerPoint file
- **AI generates** multiple choice, code, or definition questions in Danish
- **Quiz yourself** and track your progress

## Tech Stack

- Frontend: Next.js
- Backend: Express.js
- AI: OpenRouter (DeepSeek model)
- File parsing: pdf-parse (PDF), XML extraction (PPTX)

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenRouter API key

### Backend

```bash
cd backend
npm install
```

Create `.env` file:

```
PORT=3001
FRONTEND_URL=http://localhost:3000
```

Start:

```bash
node server.js
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000`

## Project Structure

```
studymindv1/
├── backend/
│   ├── server.js          # Express API server
│   ├── routes/            # API routes (auth, upload, questions)
│   └── services/          # AI and parsing services
├── frontend/
│   ├── app/
│   │   └── page.js       # Main upload/quiz page
│   └── ...
└── README.md
```

## API Endpoints

- `POST /api/upload` - Upload PDF/PPTX, returns extracted text
- `POST /api/generate` - Generate questions from text
- `GET /health` - Health check

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Backend port (default: 3001) |
| `FRONTEND_URL` | Frontend URL for CORS |

## License

MIT
