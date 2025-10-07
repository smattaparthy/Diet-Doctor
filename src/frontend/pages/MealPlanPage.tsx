import React from 'react';
import Card from '../components/common/Card';

const MealPlanPage: React.FC = () => {
  return (
    <div className="page-meal-plan">
      <div className="page-header">
        <h1>Meal Plan</h1>
        <p>Plan your weekly cultural meals</p>
      </div>
      <Card>
        <h2>Coming Soon</h2>
        <p>Weekly meal planner with cultural compliance indicators and meal swapping functionality.</p>
      </Card>
    </div>
  );
};

export default MealPlanPage;