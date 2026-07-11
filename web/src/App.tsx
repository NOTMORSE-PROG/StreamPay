import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { EmployerDashboard } from "./pages/EmployerDashboard";
import { WorkerOnboarding } from "./pages/WorkerOnboarding";
import { WorkerView } from "./pages/WorkerView";
import { NotFound } from "./pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<EmployerDashboard />} />
          <Route path="/worker" element={<WorkerOnboarding />} />
          <Route path="/worker/:streamId" element={<WorkerView />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
