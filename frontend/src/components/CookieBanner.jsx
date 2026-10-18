import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const CookieBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      // Show after a small delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 transform transition-transform duration-500 ease-in-out">
      <div className="max-w-4xl mx-auto bg-gray-900/95 backdrop-blur-sm text-white rounded-2xl shadow-2xl p-5 border border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-200">
            We use cookies to improve your experience and analyze site traffic. 
            By continuing to use this site, you agree to our use of cookies as detailed in our <a href="/privacy" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">Privacy Policy</a>.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={handleDecline}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Decline
          </button>
          <button 
            onClick={handleAccept}
            className="px-6 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 rounded-full transition-colors shadow-lg shadow-indigo-500/20"
          >
            Accept
          </button>
          <button 
            onClick={handleDecline}
            className="p-2 text-gray-400 hover:text-gray-200 rounded-full hover:bg-gray-800 transition-colors ml-2"
            aria-label="Close banner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
