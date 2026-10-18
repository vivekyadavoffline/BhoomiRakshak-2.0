import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Chatbot from "./components/Chatbot";
import CookieBanner from "./components/CookieBanner";

// Lazy loaded pages for better page load speed
const LegacyApp = lazy(() => import("./LegacyApp"));
const Website = lazy(() => import("./pages/Website"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TinyFishIntel = lazy(() => import("./pages/TinyFishIntel"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const NotFound = lazy(() => import("./pages/NotFound"));

function App() {
  return (
    <Router>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Website />} />
          <Route path="/console" element={<Website />} />
          <Route path="/citizen" element={<Website />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/intel" element={<TinyFishIntel />} />
          <Route path="/app" element={<LegacyApp />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsAndConditions />} />

          {/* Catch-all route for unmatched paths */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Chatbot />
      <CookieBanner />
    </Router>
  );
}

export default App;
