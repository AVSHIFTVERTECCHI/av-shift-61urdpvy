import { Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import CalendarPage from "@/pages/CalendarPage";
import PinGate from "@/components/PinGate";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Routes>
      {/* every page sits behind the PIN */}
      <Route element={<PinGate />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/calendario" element={<CalendarPage />} />
      </Route>
    </Routes>
  );
}
