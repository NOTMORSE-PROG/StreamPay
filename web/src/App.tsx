import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PublicShell } from "./components/shell/PublicShell";
import { EmployerShell } from "./components/shell/EmployerShell";
import { WorkerShell } from "./components/shell/WorkerShell";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/employer/Dashboard";
import { CreateStream } from "./pages/employer/CreateStream";
import { EmployerSettings } from "./pages/employer/Settings";
import { WorkerHome } from "./pages/worker/Home";
import { Activity } from "./pages/worker/Activity";
import { WalletTab } from "./pages/worker/WalletTab";
import { StreamDetail } from "./pages/worker/StreamDetail";
import { CashOut } from "./pages/worker/CashOut";
import { WorkerSettings } from "./pages/worker/Settings";
import { Onboarding } from "./pages/worker/Onboarding";
import { NotFound } from "./pages/NotFound";

// The route table, extracted from <App> so tests can mount it inside a
// MemoryRouter. Public pages (landing, not-found) get the PublicShell; the
// employer area has its own EmployerShell (sign-in gate + dashboard + create);
// the worker area has the phone-app WorkerShell (Home, Activity, Wallet, and the
// single-stream detail). Static worker segments outrank the :streamId param, and
// /worker/:streamId is unchanged so existing deep links and the PWA start_url
// keep working.

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicShell />}>
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/employer" element={<EmployerShell />}>
        <Route index element={<Dashboard />} />
        <Route path="create" element={<CreateStream />} />
        <Route path="settings" element={<EmployerSettings />} />
      </Route>
      <Route path="/worker/onboarding" element={<Onboarding />} />
      <Route path="/worker" element={<WorkerShell />}>
        <Route index element={<WorkerHome />} />
        <Route path="activity" element={<Activity />} />
        <Route path="wallet" element={<WalletTab />} />
        <Route path="settings" element={<WorkerSettings />} />
        <Route path="cashout" element={<CashOut />} />
        <Route path=":streamId" element={<StreamDetail />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
