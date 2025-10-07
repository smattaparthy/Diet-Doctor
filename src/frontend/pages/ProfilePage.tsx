import React from 'react';
import Card from '../components/common/Card';

const ProfilePage: React.FC = () => {
  return (
    <div className="page-profile">
      <div className="page-header">
        <h1>Profile</h1>
        <p>Manage your personal information and preferences</p>
      </div>
      <Card>
        <h2>Coming Soon</h2>
        <p>Profile management with cultural preferences and dosha information.</p>
      </Card>
    </div>
  );
};

export default ProfilePage;