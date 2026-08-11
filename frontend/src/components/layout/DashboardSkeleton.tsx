import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse p-2">
      {/* Top Banner Skeleton */}
      <div className="h-32 bg-surface border border-borderLine rounded-2xl p-6 flex flex-col justify-between">
        <div className="h-4 bg-gray-200 dark:bg-gray-700/50 rounded w-1/4"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700/50 rounded w-1/2"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700/50 rounded w-1/3"></div>
      </div>

      {/* Stat Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-surface border border-borderLine rounded-xl p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-gray-200 dark:bg-gray-700/50 rounded w-1/3"></div>
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700/50"></div>
            </div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700/50 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700/50 rounded w-1/4"></div>
          </div>
        ))}
      </div>

      {/* Main Content Table / Grid Skeleton */}
      <div className="h-96 bg-surface border border-borderLine rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-borderLine">
          <div className="h-5 bg-gray-200 dark:bg-gray-700/50 rounded w-1/4"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700/50 rounded w-1/5"></div>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800/40 rounded flex items-center justify-between px-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700/50 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700/50 rounded w-1/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700/50 rounded w-1/5"></div>
          </div>
        ))}
      </div>
    </div>
  );
};
