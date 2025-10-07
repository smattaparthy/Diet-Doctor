import React from 'react';
import Card from '../components/common/Card';
import { useParams } from 'react-router-dom';

const RecipePage: React.FC = () => {
  const { id } = useParams();

  return (
    <div className="page-recipes">
      <div className="page-header">
        <h1>{id ? 'Recipe Details' : 'Recipes'}</h1>
        <p>Explore cultural recipes with Ayurvedic insights</p>
      </div>
      <Card>
        <h2>Coming Soon</h2>
        <p>Recipe database with cultural notes, ingredient mapping, and Ayurvedic dosha information.</p>
      </Card>
    </div>
  );
};

export default RecipePage;