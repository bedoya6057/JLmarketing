import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SessionProvider } from "@/contexts/SessionContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { Loader2 } from "lucide-react";

// Aplicando Code Splitting para cargar las páginas bajo demanda y ahorrar memoria
const Index = React.lazy(() => import("./pages/Index"));
const Login = React.lazy(() => import("./pages/Login"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const NewEncarte = React.lazy(() => import("./pages/NewEncarte"));
const EncarteDetail = React.lazy(() => import("./pages/EncarteDetail"));
const NewExhibicion = React.lazy(() => import("./pages/NewExhibicion"));
const ExhibicionDetail = React.lazy(() => import("./pages/ExhibicionDetail"));
const CreateAdminUser = React.lazy(() => import("./pages/CreateAdminUser"));
const EncuestadorSelection = React.lazy(() => import("./pages/EncuestadorSelection"));
const EncuestadorEncarte = React.lazy(() => import("./pages/EncuestadorEncarte"));
const EncuestadorExhibicion = React.lazy(() => import("./pages/EncuestadorExhibicion"));
const EventLogs = React.lazy(() => import("./pages/EventLogs"));
const Seguimiento = React.lazy(() => import("./pages/Seguimiento"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Loader ultra ligero para las transiciones
const SuspenseLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gray-50/50">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SessionProvider>
        <PresenceProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<SuspenseLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/dashboard/nuevo" element={<NewEncarte />} />
                <Route path="/dashboard/encarte/:id" element={<EncarteDetail />} />
                <Route path="/dashboard/exhibicion/nuevo" element={<NewExhibicion />} />
                <Route path="/dashboard/exhibicion/:id" element={<ExhibicionDetail />} />
                <Route path="/create-admin" element={<CreateAdminUser />} />
                <Route path="/encuestador" element={<EncuestadorSelection />} />
                <Route path="/encuestador/encarte" element={<EncuestadorEncarte />} />
                <Route path="/encuestador/exhibicion" element={<EncuestadorExhibicion />} />
                <Route path="/event-logs" element={<EventLogs />} />
                <Route path="/seguimiento" element={<Seguimiento />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </PresenceProvider>
      </SessionProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
