# Bible Quiz with AI

An interactive Bible quiz built with React and Django. Groq generates questions for a chosen theme and difficulty, while the app guides players through a game-like experience with progress, scores, and XP.

[Open the live app](https://quiz-biblico-ia-fios.vercel.app/)

## Features

- Choose a Bible theme, difficulty, and a round of 3, 5, 7, or 10 questions.
- Answer one question at a time and review the correct answers at the end.
- Explore the creator and project section on the home page.
- Generate quiz data with Groq's `openai/gpt-oss-120b` model. The backend validates the JSON, retries formatting errors, and generates longer rounds in small batches.

## Stack

- Frontend: React and Vite
- Backend: Python, Django, and Django REST Framework
- AI provider: Groq API
- Local containers: Docker Compose

## Run locally

1. Clone the repository:

   ```bash
   git clone https://github.com/thaynandias4-collab/quiz-biblico-ia.git
   cd quiz-biblico-ia
   ```

2. Create the backend environment file:

   ```bash
   cp backend/.env.example backend/.env
   ```

   Set `GROQ_API_KEY` in `backend/.env` to a key from the [Groq Console](https://console.groq.com/keys). Keep this file private.

3. Start the app with Docker Compose:

   ```bash
   docker compose up --build
   ```

   Open the frontend at [http://localhost:5173](http://localhost:5173). The API runs at [http://localhost:8000](http://localhost:8000).

## Checks

Run the backend tests:

```bash
docker compose exec backend python manage.py test quiz
```

Build the frontend:

```bash
cd frontend && npm run build
```

## Creator

Thaynan Willian Dias is a Full Stack developer and Software Analysis and Development student at Facens. The app includes an introduction to the creator and the project on its home page.
