import React from 'react';
import Card from '../components/common/Card';

const SettingsPage: React.FC = () => {
  return (
    <div className="page-settings">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your preferences and data</p>
      </div>
      <Card>
        <h2>Coming Soon</h2>
        <p>Settings for profile management, data import/export, and cultural preferences.</p>
      </Card>
    </div>
  );
};

export default SettingsPage;