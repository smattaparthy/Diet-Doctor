import React from 'react';
import Card from '../components/common/Card';

const ShoppingListPage: React.FC = () => {
  return (
    <div className="page-shopping-list">
      <div className="page-header">
        <h1>Shopping Lists</h1>
        <p>Retailer-grouped shopping items with completion tracking</p>
      </div>
      <Card>
        <h2>Coming Soon</h2>
        <p>Shopping lists organized by retailer with cultural product mapping and price comparison.</p>
      </Card>
    </div>
  );
};

export default ShoppingListPage;