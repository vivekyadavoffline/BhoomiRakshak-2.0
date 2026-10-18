import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-9xl font-extrabold text-gray-200 tracking-widest">404</h1>
        <div className="bg-indigo-600 px-2 text-sm rounded rotate-12 absolute text-white shadow-sm -mt-16 ml-14">
          Page Not Found
        </div>
        
        <div className="mt-8">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Oops! We couldn't find that page.
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-lg mx-auto">
            The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
          </p>
        </div>

        <div className="mt-10">
          <Link 
            to="/" 
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Go back home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
