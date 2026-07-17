import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { DeviceProvider } from "@/hooks/useDevice";
import { AuthProvider } from "@/hooks/useAuth";
import { AnalysisDataProvider } from "@/contexts/AnalysisDataContext";
import Index from "./pages/Index";
import Analysis from "./pages/Analysis";
import Profile from "./pages/Profile";
import Packages from "./pages/Packages";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="arsa-analiz-theme">
    <QueryClientProvider client={queryClient}>
      <DeviceProvider>
        <AuthProvider>
          <AnalysisDataProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/analysis" element={<Analysis />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/packages" element={<Packages />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/gizlilik-politikasi" element={<PrivacyPolicy />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AnalysisDataProvider>
        </AuthProvider>
      </DeviceProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
