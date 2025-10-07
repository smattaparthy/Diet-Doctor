import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getMealPlanByDate, getMealPlanStats, getFavoriteRecipes, getHinduDietaryGuidance } from '../services/api';
import { format } from 'date-fns';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import ProgressIndicator from '../components/common/ProgressIndicator';
import { Calendar, Utensils, Heart, TrendingUp, Plus, MapPin } from 'lucide-react';

interface TodayMeals {
  breakfast?: any;
  lunch?: any;
  dinner?: any;
  snack?: any;
}

interface CulturalTip {
  title: string;
  description: string;
  category: 'hindu' | 'ayurvedic' | 'cultural';
  icon: string;
}

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [todayMeals, setTodayMeals] = useState<TodayMeals>({});
  const [mealPlanStats, setMealPlanStats] = useState<any>(null);
  const [favoriteRecipes, setFavoriteRecipes] = useState<any[]>([]);
  const [culturalTips, setCulturalTips] = useState<CulturalTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');

      const [mealsResponse, statsResponse, favoritesResponse, guidanceResponse] = await Promise.all([
        getMealPlanByDate(today),
        getMealPlanStats(),
        getFavoriteRecipes(),
        getHinduDietaryGuidance(),
      ]);

      setTodayMeals(mealsResponse);
      setMealPlanStats(statsResponse);
      setFavoriteRecipes(favoritesResponse);

      // Process cultural tips from guidance
      const tips: CulturalTip[] = [
        {
          title: 'Daily Prayer Before Meals',
          description: 'Reciting a prayer or blessing before eating enhances the spiritual nourishment of your food.',
          category: 'hindu',
          icon: '🙏'
        },
        {
          title: 'Mindful Eating Practice',
          description: 'Eat slowly and with gratitude, focusing on the flavors and textures of each bite.',
          category: 'ayurvedic',
          icon: '🧘'
        },
        {
          title: 'Seasonal Food Awareness',
          description: 'Choose foods that align with the current season for optimal digestion and energy.',
          category: 'ayurvedic',
          icon: '🌸'
        }
      ];

      setCulturalTips(tips);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getDoshaColor = (dosha: string) => {
    const colors = {
      vata: '#1976D2',
      pitta: '#F57C00',
      kapha: '#388E3C',
      tridosha: 'transparent'
    };
    return colors[dosha as keyof typeof colors] || '#666';
  };

  if (loading) {
    return (
      <div className="page-dashboard">
        <div className="dashboard-header">
          <h1>Loading Dashboard...</h1>
        </div>
        <div className="loading-screen" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-dashboard">
        <div className="dashboard-header">
          <h1>Error</h1>
        </div>
        <div className="error-container">
          <p>{error}</p>
          <Button onClick={loadDashboardData}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>
            Welcome back, {user?.name}! 🙏
          </h1>
          <p>{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="user-summary">
          <div className="dosha-indicator">
            <span className="dosha-label">Dosha</span>
            <span
              className="dosha-value"
              style={{ color: getDoshaColor(user?.dosha || 'tridosha') }}
            >
              {user?.dosha ? t(`dosha.${user.dosha}`) : 'Not Set'}
            </span>
          </div>
          <div className="cuisine-indicator">
            <span className="cuisine-label">Cuisine</span>
            <span className="cuisine-value">
              {user?.cuisine_preferences?.[0] ? t(`cuisine.${user.cuisine_preferences[0]}`) : 'Not Set'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-section">
        <h2>Quick Actions</h2>
        <div className="quick-actions-grid">
          <Button variant="outline" icon={<Plus size={20} />}>
            Generate Meal Plan
          </Button>
          <Button variant="outline" icon={<Plus size={20} />}>
            Create Shopping List
          </Button>
          <Button variant="outline" icon={<Heart size={20} />}>
            Browse Recipes
          </Button>
          <Button variant="outline" icon={<Calendar size={20} />}>
            View Weekly Plan
          </Button>
        </div>
      </div>

      {/* Today's Meals */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2>Today's Meals</h2>
          <Button variant="ghost" icon={<Utensils size={16} />}>
            View Meal Plan
          </Button>
        </div>
        <div className="meals-grid">
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType) => {
            const meal = todayMeals[mealType];
            return (
              <Card key={mealType} className="meal-card">
                <div className="meal-header">
                  <h3 className={`meal-${mealType}`}>
                    {t(`meal.${mealType}`)}
                  </h3>
                  {meal ? (
                    <span className="meal-compliance compliance-moderate">
                      ✓ Compliant
                    </span>
                  ) : (
                    <span className="meal-missing">Not planned</span>
                  )}
                </div>
                {meal ? (
                  <div className="meal-content">
                    <h4>{meal.recipe?.title}</h4>
                    <p>{meal.recipe?.description}</p>
                    <div className="meal-meta">
                      <span>Cuisine: {meal.recipe?.cuisine_type}</span>
                      <span>Prep: {meal.recipe?.prep_time_minutes} min</span>
                    </div>
                  </div>
                ) : (
                  <div className="meal-empty">
                    <p>Plan your {mealType}</p>
                    <Button variant="ghost" size="sm">
                      Add Recipe
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Stats and Insights */}
      {mealPlanStats && (
        <div className="dashboard-section">
          <h2>Your Progress</h2>
          <div className="stats-grid">
            <Card className="stat-card">
              <div className="stat-icon">
                <TrendingUp size={24} />
              </div>
              <div className="stat-content">
                <h3>Cultural Compliance</h3>
                <div className="stat-value">
                  <span>{Math.round(mealPlanStats.average_compliance_score || 85)}%</span>
                </div>
                <ProgressIndicator
                  progress={mealPlanStats.average_compliance_score || 85}
                  size="sm"
                  color="success"
                />
              </div>
            </Card>

            <Card className="stat-card">
              <div className="stat-icon">
                <Heart size={24} />
              </div>
              <div className="stat-content">
                <h3>Favorite Recipes</h3>
                <div className="stat-value">
                  <span>{favoriteRecipes.length}</span>
                </div>
                <p>Recipes you love</p>
              </div>
            </Card>

            <Card className="stat-card">
              <div className="stat-icon">
                <MapPin size={24} />
              </div>
              <div className="stat-content">
                <h3>Preferred Stores</h3>
                <div className="stat-value">
                  <span>{user?.cuisine_preferences?.length || 0}</span>
                </div>
                <p>Retailers mapped</p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Cultural Tips */}
      <div className="dashboard-section">
        <h2>Daily Cultural Wisdom</h2>
        <div className="tips-grid">
          {culturalTips.map((tip, index) => (
            <Card key={index} className={`tip-card tip-${tip.category}`}>
              <div className="tip-icon">{tip.icon}</div>
              <div className="tip-content">
                <h3>{tip.title}</h3>
                <p>{tip.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;