# Event Ticketing Web Frontend

React + Vite + TypeScript frontend for the Event Ticketing System.

## Features

- User authentication (login/register)
- Real-time ticket availability display
- Ticket request queue with position tracking
- Order history with QR token management
- Responsive design with modern UI

## Local Development

### Prerequisites

- Node.js 18+ and npm
- Backend API running on http://localhost:8000

### Setup

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Set API URL (if different from default):**
   Edit `.env` and set:
   ```
   VITE_API_URL=http://localhost:8000
   ```

3. **Install dependencies:**
   ```bash
   npm i
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

The app will be served at http://localhost:5173

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Project Structure

```
web/
  src/
    lib/
      api.ts          # API client with auth token handling
      auth.ts         # Authentication utilities (localStorage)
    components/
      Nav.tsx         # Navigation bar
      AvailabilityCard.tsx
      TicketButtons.tsx
      Toast.tsx       # Toast notifications
      ProtectedRoute.tsx
    routes/
      Home.tsx        # Main page with availability and ticket requests
      Login.tsx       # Login page
      Register.tsx    # Registration page
      Orders.tsx      # User orders list
      NotFound.tsx    # 404 page
    App.tsx           # Main app with routing
    main.tsx          # Entry point
    styles.css        # Global styles
```

## Features

### Home Page
- Displays real-time ticket availability (polls every 4s)
- Ticket request buttons (VIP/Regular)
- Queue position tracking (polls every 3s when queued)
- Shows queue status updates

### Authentication
- JWT token stored in localStorage
- Protected routes for authenticated users
- Auto-redirect after login/register

### Orders Page
- Lists last 10 orders
- Shows order status, ticket type, creation date
- Copy QR token to clipboard
- Status badges for different order states

## API Integration

The app communicates with the FastAPI backend at `VITE_API_URL`:
- All API calls include JWT token in Authorization header when authenticated
- Errors are displayed as toast notifications
- Automatic token refresh handling

## License

MIT

