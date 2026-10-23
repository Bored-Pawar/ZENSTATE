import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Today from "./pages/Today";
import Timetable from "./pages/Timetable";
import Planner from "./pages/Planner";
import PlannerReview from "./pages/PlannerReview";
import PlannerAvailability from "./pages/PlannerAvailability";
import PlannerConfirmation from "./pages/PlannerConfirmation";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import Journal from "./pages/Journal";
import DisciplineReport from "./pages/DisciplineReport";
import { useApp } from "./context/AppContext";
import { Outlet } from "react-router-dom";

function Protected() {
  const { state, loading } = useApp();
  if (loading)
    return <p className="loading-screen">Restoring your saved space…</p>;
  if (!state.user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
function Onboarded() {
  const { state } = useApp();
  return state.user.onboardingCompleted ? (
    <Outlet />
  ) : (
    <Navigate to="/setup" replace />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route element={<AppLayout />}>
          <Route path="/setup" element={<Timetable setup />} />
          <Route element={<Onboarded />}>
            <Route path="/today" element={<Today />} />
            <Route path="/timetable" element={<Timetable />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/planner/review" element={<PlannerReview />} />
            <Route
              path="/planner/availability"
              element={<PlannerAvailability />}
            />
            <Route
              path="/planner/confirmation"
              element={<PlannerConfirmation />}
            />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/tasks/:taskId" element={<TaskDetail />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/discipline-report" element={<DisciplineReport />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
