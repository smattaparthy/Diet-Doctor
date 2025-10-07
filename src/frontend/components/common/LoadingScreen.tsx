import React from 'react';

interface LoadingScreenProps {
  message?: string;
  submessage?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading...',
  submessage = 'Please wait a moment'
}) => {
  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <div className="loading-text">{message}</div>
      <div className="loading-subtext">{submessage}</div>
    </div>
  );
};

export default LoadingScreen;