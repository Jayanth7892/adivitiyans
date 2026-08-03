import React from 'react';
import { CodingProfilesSection } from '../../coding/CodingProfilesSection';

interface CodingProfilesTabProps {
  profiles?: any[];
  onRefresh?: () => void;
}

export const CodingProfilesTab: React.FC<CodingProfilesTabProps> = ({ onRefresh }) => {
  return <CodingProfilesSection onRefreshAll={onRefresh} />;
};
