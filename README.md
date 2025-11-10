# Event Ticketing System (event_tix)

A FastAPI-based event ticketing system with queue management, JWT authentication, and real-time ticket processing.

## Features

- JWT-based authentication
- Priority queue system (VIP and Regular tickets)
- Background ticket processing with atomic inventory management
- Transaction logging to CSV
- RESTful API with CORS support
- CLI management tool

## Local Setup

### Prerequisites

- Python 3.8+
- pip
- Node.js 18+ and npm (for frontend)

### Backend Setup

1. **Create virtual environment:**

   Windows:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   ```

   macOS/Linux:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables:**
   
   Copy `.env.example` to `event_tix/.env`:
   
   Windows:
   ```bash
   copy .env.example event_tix\.env
   ```
   
   macOS/Linux:
   ```bash
   cp .env.example event_tix/.env
   ```
   
   Edit `event_tix/.env` and set a secure `SECRET_KEY` (32+ random characters):
   ```
   SECRET_KEY=your_random_32_character_string_here
   ACCESS_TOKEN_EXPIRE_MINUTES=43200
   CORS_ORIGINS=http://localhost:5173
   ```

4. **Seed the database:**
   ```bash
   python -c "from event_tix.seed import seed; seed()"
   ```
   
   This creates:
   - Demo Event (id=1) with VIP (capacity: 20) and Regular (capacity: 80) ticket types
   - Demo user: `demo@local.test` / `Passw0rd!`

5. **Start the server:**
   ```bash
   python -m uvicorn event_tix.app:app --reload --port 8000
   ```

The API will be available at `http://127.0.0.1:8000`

API documentation (Swagger UI): `http://127.0.0.1:8000/docs`

### Frontend Setup

1. **Navigate to web directory:**
   ```bash
   cd web
   ```

2. **Copy environment file:**
   
   Windows:
   ```bash
   copy .env.example .env
   ```
   
   macOS/Linux:
   ```bash
   cp .env.example .env
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:5173`

**Quick Start:**
1. Backend: `python -m uvicorn event_tix.app:app --reload --port 8000`
2. Frontend: `cd web && npm run dev`
3. Open: `http://localhost:5173/events`
4. Verify: `http://127.0.0.1:8000/api/events` returns a non-empty array

### Common Issues & Fixes

**Database Issues:**
- To reset the database, delete `event_tix.db` and run the seed command again:
  ```bash
  del event_tix.db  # Windows
  rm event_tix.db   # macOS/Linux
  python -c "from event_tix.seed import seed; seed()"
  ```

**CSV Logging Issues:**
- Ensure write permissions for `event_tix/data/` directory
- The directory is created automatically, but if you see permission errors:
  - Windows: Check folder permissions in Properties → Security
  - macOS/Linux: `chmod 755 event_tix/data`

**Port Already in Use:**
- Backend (8000): Change port in the uvicorn command or kill the process using the port
- Frontend (5173): Change port in `vite.config.ts` or kill the process

**Module Not Found Errors:**
- Ensure virtual environment is activated
- Reinstall dependencies: `pip install -r requirements.txt`

## Quick Test

### Register a user:
```bash
curl -X POST http://localhost:8000/api/auth/register -H "Content-Type: application/json" -d "{\"name\":\"Test\",\"email\":\"t@e.com\",\"password\":\"pass1234\"}"
```

### Login:
```bash
curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"t@e.com\",\"password\":\"pass1234\"}"
```

Save the `access_token` from the login response for authenticated requests.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token

### Tickets
- `GET /api/availability?event_id=1` - Get ticket availability
- `POST /api/ticket-requests` - Create a ticket request (Auth required)
- `GET /api/queue/position?request_id=...` - Get queue position (Auth required)
- `GET /api/orders` - Get user's orders (Auth required)
- `GET /api/tickets/verify/{qr_token}` - Verify a ticket QR code
- `POST /api/tickets/checkin/{qr_token}` - Check in a ticket

## CLI Tool

Run the management CLI:
```bash
python -m event_tix.cli.manage_cli
```

Options:
1. View availability
2. Enqueue test request
3. Process next tick once
4. Show last 10 transactions
5. Exit

## Project Structure

```
event_tix/
  __init__.py
  app.py              # Main FastAPI application
  auth.py             # JWT authentication
  db.py               # Database setup
  models.py           # SQLAlchemy models
  schemas.py          # Pydantic schemas
  seed.py             # Database seeding
  services/
    __init__.py
    queue.py          # In-memory queue management
    processing.py     # Background ticket processing
    logging.py        # CSV transaction logging
  cli/
    __init__.py
    manage_cli.py     # CLI management tool
  data/               # CSV transaction logs
```

## Database

The application uses SQLite (`event_tix.db`) with the following main tables:
- `users` - User accounts
- `events` - Events
- `ticket_types` - Ticket types with capacity tracking
- `orders` - Ticket orders
- `tickets` - Issued tickets with QR tokens

## Background Processing

The system runs a background processor that:
- Processes queue requests every 500ms
- Prioritizes VIP tickets over Regular tickets
- Uses atomic database operations to prevent overselling
- Logs all transactions to `event_tix/data/transactions.csv`

## License

MITnt 
<!-- Run the backend with this command -->
.\.venv\Scripts\Activate.ps1
python -m uvicorn event_tix.app:app --reload --port 8000

<!-- Run the frontend with this command -->
cd C:\Users\afran\Desktop\event\web
npm run dev

