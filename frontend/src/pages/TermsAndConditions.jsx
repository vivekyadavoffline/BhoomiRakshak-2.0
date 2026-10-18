import React from 'react';

const TermsAndConditions = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms and Conditions</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: September 2026</p>
        
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Agreement to Terms</h2>
            <p>
              These Terms of Use constitute a legally binding agreement made between you and Bhoomi Rakshak concerning your access to and use of the website as well as any other media form, media channel, mobile website or mobile application related, linked, or otherwise connected thereto.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Intellectual Property Rights</h2>
            <p>
              Unless otherwise indicated, the Site is our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the Site and the trademarks, service marks, and logos contained therein are owned or controlled by us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. User Representations</h2>
            <p>
              By using the Site, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information and promptly update such registration information as necessary.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Contact Us</h2>
            <p>
              In order to resolve a complaint regarding the Site or to receive further information regarding use of the Site, please contact us at support@example.com.
            </p>
          </section>
        </div>

        <div className="mt-10">
          <a href="/" className="text-indigo-600 hover:text-indigo-800 font-medium">&larr; Back to Home</a>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
