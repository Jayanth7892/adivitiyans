import React from 'react';
import { CodingProfilesSection } from '../../coding/CodingProfilesSection';

interface CodingProfilesTabProps {
  profiles?: any[];
  studentName?: string;
  studentRollNumber?: string;
  readOnly?: boolean;
  onRefresh?: () => void;
}

export const CodingProfilesTab: React.FC<CodingProfilesTabProps> = ({
  onRefresh,
  studentName,
  studentRollNumber,
  readOnly,
}) => {
  return (
    <CodingProfilesSection
      onRefreshAll={onRefresh}
      studentName={studentName}
      studentRollNumber={studentRollNumber}
      readOnly={readOnly}
    />
  );
};
