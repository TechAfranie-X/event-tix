import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Nav from './components/Nav';
import RequireAuth from './components/RequireAuth';
import RequireAdminAuth from './components/RequireAdminAuth';
import Landing from './pages/Landing';
import Login from './routes/Login';
import Register from './routes/Register';
import Orders from './routes/Orders';
import Events from './routes/Events';
import EventDetail from './routes/EventDetail';
import Scan from './routes/Scan';
import NotFound from './routes/NotFound';
import AdminLogin from './routes/AdminLogin';
import AdminEvents from './routes/AdminEvents';
import AdminEventForm from './routes/AdminEventForm';
import AdminTicketTypes from './routes/AdminTicketTypes';
import AdminPromos from './routes/AdminPromos';
import AdminReports from './routes/AdminReports';
import OrganizerCreate from './routes/OrganizerCreate';
import OrganizerMyEvents from './routes/OrganizerMyEvents';
import OrganizerPromos from './pages/OrganizerPromos';
import './styles.css';

function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/orders"
          element={
            <RequireAuth>
              <Orders />
            </RequireAuth>
          }
        />
        <Route path="/scan" element={<Scan />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin/events"
          element={
            <RequireAdminAuth>
              <AdminEvents />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/events/new"
          element={
            <RequireAdminAuth>
              <AdminEventForm />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/events/:id/edit"
          element={
            <RequireAdminAuth>
              <AdminEventForm />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/events/:id/ticket-types"
          element={
            <RequireAdminAuth>
              <AdminTicketTypes />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/events/:id/promos"
          element={
            <RequireAdminAuth>
              <AdminPromos />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <RequireAdminAuth>
              <AdminReports />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/organizer/create"
          element={
            <RequireAuth>
              <OrganizerCreate />
            </RequireAuth>
          }
        />
        <Route
          path="/organizer/events"
          element={
            <RequireAuth>
              <OrganizerMyEvents />
            </RequireAuth>
          }
        />
        <Route
          path="/organizer/promos"
          element={
            <RequireAuth>
              <OrganizerPromos />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

