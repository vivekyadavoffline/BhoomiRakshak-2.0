import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: September 2026</p>
        
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              Welcome to Bhoomi Rakshak. We are committed to protecting your personal information and your right to privacy. 
              If you have any questions or concerns about our policy, or our practices with regards to your personal information, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <p>
              We collect personal information that you voluntarily provide to us when you express an interest in obtaining information about us or our products and services. 
              The personal information that we collect depends on the context of your interactions with us and the Website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p>
              We use personal information collected via our Website for a variety of business purposes described below. 
              We process your personal information for these purposes in reliance on our legitimate business interests, in order to enter into or perform a contract with you, with your consent, and/or for compliance with our legal obligations.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Contact Us</h2>
            <p>
              If you have questions or comments about this notice, you may email us at support@example.com.
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

export default PrivacyPolicy;
