import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toasts, Skeleton } from "./components/ui";
import Landing from "./pages/Landing";
import Docs from "./pages/Docs";

// The dashboard (Plotly, React Flow) is split into its own chunk so the landing page loads fast.
const DashboardLayout = lazy(() => import("./dashboard/DashboardLayout"));
const Overview = lazy(() => import("./dashboard/Overview"));
const StartTracing = lazy(() => import("./dashboard/StartTracing"));
const LiveTrace = lazy(() => import("./dashboard/LiveTrace"));
const ProcessExplorer = lazy(() => import("./dashboard/ProcessExplorer"));
const SyscallExplorer = lazy(() => import("./dashboard/SyscallExplorer"));
const Timeline = lazy(() => import("./dashboard/Timeline"));
const FileOps = lazy(() => import("./dashboard/FileOps"));
const Memory = lazy(() => import("./dashboard/Memory"));
const Reports = lazy(() => import("./dashboard/Reports"));
const Settings = lazy(() => import("./dashboard/Settings"));

function PageFallback() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      <Skeleton className="h-72" />
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const top = location.pathname.startsWith("/app") ? "app" : location.pathname;
  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div key={top} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <Suspense fallback={<PageFallback />}>
            <Routes location={location}>
              <Route path="/" element={<Landing />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/app" element={<DashboardLayout />}>
                <Route index element={<Overview />} />
                <Route path="trace" element={<StartTracing />} />
                <Route path="live" element={<LiveTrace />} />
                <Route path="processes" element={<ProcessExplorer />} />
                <Route path="syscalls" element={<SyscallExplorer />} />
                <Route path="timeline" element={<Timeline />} />
                <Route path="files" element={<FileOps />} />
                <Route path="memory" element={<Memory />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
      <Toasts />
    </>
  );
}
