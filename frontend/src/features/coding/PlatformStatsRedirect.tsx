import React from 'react';
import { useParams, Navigate } from 'react-router-dom';

export const PlatformStatsRedirect: React.FC = () => {
  const { platform } = useParams<{ platform: string }>();
  const targetPlatform = platform || 'coding-stats';
  return <Navigate to={`/profile?tab=coding-profiles&platform=${targetPlatform}`} replace />;
};
