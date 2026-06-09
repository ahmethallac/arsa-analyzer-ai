import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { DeviceProvider } from "@/hooks/useDevice";
import { AuthProvider } from "@/hooks/useAuth";
import { AnalysisDataProvider } from "@/contexts/AnalysisDataContext";
import Index from "./pages/Index";
import Analysis from "./pages/Analysis";
import Profile from "./pages/Profile";
import Packages from "./pages/Packages";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const NativeAuthFallbackBridge = () => {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (!/Android/i.test(navigator.userAgent)) return;

    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const hasAuthPayload =
      params.has("code") ||
      params.has("access_token") ||
      hashParams.has("access_token") ||
      hashParams.has("refresh_token");

    if (!hasAuthPayload) return;

    const nativeUrl = `com.arsaanaliz.app://auth${window.location.search}${window.location.hash}`;
    window.location.replace(nativeUrl);
  }, []);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <DeviceProvider>
      <AuthProvider>
        <AnalysisDataProvider>
          <TooltipProvider>
            <NativeAuthFallbackBridge />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/analysis" element={<Analysis />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/packages" element={<Packages />} />
                <Route path="/auth" element={<Auth />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AnalysisDataProvider>
      </AuthProvider>
    </DeviceProvider>
  </QueryClientProvider>
);

export default App;
