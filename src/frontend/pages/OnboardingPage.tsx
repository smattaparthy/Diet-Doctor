import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ChevronRight, ChevronLeft, Leaf, Users, Utensils, Heart } from 'lucide-react';

// Components
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import ProgressIndicator from '../components/common/ProgressIndicator';

// Types
interface OnboardingData {
  cuisinePreferences: string[];
  dietaryRestrictions: Array<{
    type: 'religious' | 'medical' | 'ethical' | 'cultural';
    restriction: string;
    severity: 'strict' | 'moderate' | 'mild';
  }>;
  dosha: 'vata' | 'pitta' | 'kapha' | 'tridosha' | null;
  culturalBackground: string;
  preferredRetailers: string[];
}

// Dosha questions
const DOSHA_QUESTIONS = [
  {
    id: 'body_type',
    question: 'Which best describes your body type?',
    options: [
      { value: 'vata', label: 'Thin, light build', traits: 'naturally slender, difficulty gaining weight' },
      { value: 'pitta', label: 'Medium, muscular build', traits: 'moderate weight, gains muscle easily' },
      { value: 'kapha', label: 'Heavy, solid build', traits: 'natural tendency to gain weight' }
    ]
  },
  {
    id: 'digestion',
    question: 'How would you describe your digestion?',
    options: [
      { value: 'vata', label: 'Variable/irregular', traits: 'bloating, constipation or gas' },
      { value: 'pitta', label: 'Strong, sharp', traits: 'can eat anything, rarely indigestion' },
      { value: 'kapha', label: 'Slow, heavy', traits: 'takes time to digest, feel full for hours' }
    ]
  },
  {
    id: 'energy_patterns',
    question: 'What are your typical energy levels?',
    options: [
      { value: 'vata', label: 'Ups and downs', traits: 'bursts of energy then fatigue' },
      { value: 'pitta', label: 'Consistently high', traits: 'steady energy throughout the day' },
      { value: 'kapha', label: 'Slow but steady', traits: 'takes time to get going' }
    ]
  },
  {
    id: 'stress_response',
    question: 'How do you typically respond to stress?',
    options: [
      { value: 'vata', label: 'Anxious, worried', traits: 'racing thoughts, difficulty sleeping' },
      { value: 'pitta', label: 'Irritable, angry', traits: 'intense, critical, impatient' },
      { value: 'kapha', label: 'Withdrawn, overwhelmed', traits: 'avoid confrontation, feel stuck' }
    ]
  },
  {
    id: 'sleep_patterns',
    question: 'What describes your sleep patterns?',
    options: [
      { value: 'vata', label: 'Light, disturbed', traits: 'wake up easily, often restless' },
      { value: 'pitta', label: 'Moderate but regular', traits: 'sleep well but wake up alert' },
      { value: 'kapha', label: 'Heavy, deep', traits: 'hard to wake up, love sleeping' }
    ]
  }
];

const CUISINE_OPTIONS = [
  { value: 'north_indian', label: 'North Indian', icon: '🍛', description: 'Rich curries, breads, dairy-based dishes' },
  { value: 'south_indian', label: 'South Indian', icon: '🥘', description: 'Rice-based, light, fermented foods' },
  { value: 'mughlai', label: 'Mughlai', icon: '🍗', description: 'Royal cuisine, rich gravies, tandoori' },
  { value: 'gujarati', label: 'Gujarati', icon: '🥙', description: 'Sweet, savory, vegetarian focused' },
  { value: 'punjabi', label: 'Punjabi', icon: '🫔', description: 'Hearty, tandoori, rich flavors' },
  { value: 'bengali', label: 'Bengali', icon: '🐟', description: 'Fish-based, mustard oil, sweets' },
  { value: 'rajasthani', label: 'Rajasthani', icon: '🫓', description: 'Spicy, gram flour, desert adaptations' },
];

const DIETARY_RESTRICTIONS = [
  { type: 'religious', options: [
    { value: 'hindu_vegetarian', label: 'Hindu Vegetarian' },
    { value: 'jain', label: 'Jain (no root vegetables)' },
    { value: 'sattvic', label: 'Sattvic (pure, no onion/garlic)' },
    { value: 'halal', label: 'Halal' },
    { value: 'kosher', label: 'Kosher' }
  ]},
  { type: 'medical', options: [
    { value: 'gluten_free', label: 'Gluten-free' },
    { value: 'dairy_free', label: 'Dairy-free' },
    { value: 'diabetic', label: 'Diabetes-friendly' },
    { value: 'low_sodium', label: 'Low sodium' },
    { value: 'heart_healthy', label: 'Heart-healthy' }
  ]},
  { type: 'ethical', options: [
    { value: 'vegan', label: 'Vegan' },
    { value: 'vegetarian', label: 'Vegetarian' },
    { value: 'organic', label: 'Organic preferred' }
  ]}
];

const RETAILER_OPTIONS = [
  { value: 'patel_brothers', label: 'Patel Brothers', description: 'Large Indian grocery chain' },
  { value: 'subzi_mandi', label: 'Subzi Mandi', description: 'Fresh Indian groceries' },
  { value: 'hanuman', label: 'Hanuman', description: 'Traditional Indian market' },
  { value: 'trader_joes', label: "Trader Joe's", description: 'Specialty and organic options' },
];

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { updateProfile } = useAuth();
  const { t } = useLanguage();

  const [currentStep, setCurrentStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    cuisinePreferences: [],
    dietaryRestrictions: [],
    dosha: null,
    culturalBackground: 'hindu',
    preferredRetailers: [],
  });

  const [doshaScores, setDoshaScores] = useState<{ vata: number; pitta: number; kapha: number }>({
    vata: 0,
    pitta: 0,
    kapha: 0,
  });

  const totalSteps = 5;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleCuisineSelection = (cuisine: string) => {
    setOnboardingData(prev => ({
      ...prev,
      cuisinePreferences: prev.cuisinePreferences.includes(cuisine)
        ? prev.cuisinePreferences.filter(c => c !== cuisine)
        : [...prev.cuisinePreferences, cuisine]
    }));
  };

  const handleDietaryRestriction = (type: string, restriction: string, severity: 'strict' | 'moderate' | 'mild') => {
    const key = `${type}_${restriction}`;
    const existing = onboardingData.dietaryRestrictions.find(r => r.restriction === restriction);

    setOnboardingData(prev => ({
      ...prev,
      dietaryRestrictions: existing
        ? prev.dietaryRestrictions.filter(r => r.restriction !== restriction)
        : [...prev.dietaryRestrictions, { type: type as any, restriction, severity }]
    }));
  };

  const handleDoshaAnswer = (questionId: string, doshaValue: string) => {
    doshaScores[doshaValue as keyof typeof doshaScores] += 1;

    // Auto-calculate dosha at the end
    if (Object.values(doshaScores).reduce((a, b) => a + b, 0) === DOSHA_QUESTIONS.length) {
      const scores = Object.entries(doshaScores);
      const maxScore = Math.max(...scores.map(([, score]) => score));
      const topDoshas = scores.filter(([, score]) => score === maxScore).map(([dosha]) => dosha);

      if (topDoshas.length === 1) {
        setOnboardingData(prev => ({ ...prev, dosha: topDoshas[0] as any }));
      } else {
        setOnboardingData(prev => ({ ...prev, dosha: 'tridosha' }));
      }
    }
  };

  const handleRetailerSelection = (retailer: string) => {
    setOnboardingData(prev => ({
      ...prev,
      preferredRetailers: prev.preferredRetailers.includes(retailer)
        ? prev.preferredRetailers.filter(r => r !== retailer)
        : [...prev.preferredRetailers, retailer]
    }));
  };

  const handleNext = async () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Complete onboarding
      await handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      await updateProfile({
        cuisine_preferences: onboardingData.cuisinePreferences,
        dietary_restrictions: onboardingData.dietaryRestrictions,
        dosha: onboardingData.dosha,
        cultural_background: onboardingData.culturalBackground,
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="onboarding-step">
            <div className="step-header">
              <Utensils className="step-icon" size={48} />
              <h2>{t('onboarding.welcome')}</h2>
              <p>Let's personalize your cultural diet experience</p>
            </div>
            <div className="step-content">
              <h3>What are your preferred cuisines?</h3>
              <div className="cuisine-grid">
                {CUISINE_OPTIONS.map(cuisine => (
                  <Card
                    key={cuisine.value}
                    className={`cuisine-card ${onboardingData.cuisinePreferences.includes(cuisine.value) ? 'selected' : ''}`}
                    onClick={() => handleCuisineSelection(cuisine.value)}
                  >
                    <div className="cuisine-icon">{cuisine.icon}</div>
                    <h4>{cuisine.label}</h4>
                    <p>{cuisine.description}</p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="onboarding-step">
            <div className="step-header">
              <Heart className="step-icon" size={48} />
              <h2>Dietary Preferences</h2>
              <p>Tell us about your dietary needs and restrictions</p>
            </div>
            <div className="step-content">
              {DIETARY_RESTRICTIONS.map(category => (
                <div key={category.type} className="restriction-category">
                  <h3>{category.type.charAt(0).toUpperCase() + category.type.slice(1)}</h3>
                  <div className="restriction-options">
                    {category.options.map(option => (
                      <Card
                        key={option.value}
                        className={`restriction-card ${onboardingData.dietaryRestrictions.some(r => r.restriction === option.value) ? 'selected' : ''}`}
                      >
                        <label className="restriction-item">
                          <input
                            type="checkbox"
                            checked={onboardingData.dietaryRestrictions.some(r => r.restriction === option.value)}
                            onChange={() => handleDietaryRestriction(category.type, option.value, 'moderate')}
                          />
                          <span>{option.label}</span>
                        </label>
                        {onboardingData.dietaryRestrictions.some(r => r.restriction === option.value) && (
                          <select
                            className="severity-select"
                            onChange={(e) => {
                              const existing = onboardingData.dietaryRestrictions.find(r => r.restriction === option.value);
                              if (existing) {
                                setOnboardingData(prev => ({
                                  ...prev,
                                  dietaryRestrictions: prev.dietaryRestrictions.map(r =>
                                    r.restriction === option.value
                                      ? { ...r, severity: e.target.value as any }
                                      : r
                                  )
                                }));
                              }
                            }}
                          >
                            <option value="mild">Mild preference</option>
                            <option value="moderate">Moderate restriction</option>
                            <option value="strict">Strict requirement</option>
                          </select>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="onboarding-step">
            <div className="step-header">
              <Leaf Users className="step-icon" size={48} />
              <h2>Discover Your Dosha</h2>
              <p>Answer these questions to understand your constitutional type</p>
            </div>
            <div className="step-content">
              <div className="dosha-questionnaire">
                {DOSHA_QUESTIONS.map((question, index) => (
                  <div key={question.id} className="question-block">
                    <h4>{index + 1}. {question.question}</h4>
                    <div className="answer-options">
                      {question.options.map(option => (
                        <Card
                          key={option.value}
                          className="answer-card"
                          onClick={() => handleDoshaAnswer(question.id, option.value)}
                        >
                          <div className="answer-header">
                            <h5>{option.label}</h5>
                          </div>
                          <p className="answer-description">{option.traits}</p>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {onboardingData.dosha && (
                <div className="dosha-result">
                  <h3>Your Dosha: <span className={`dosha-${onboardingData.dosha}`}>{onboardingData.dosha.toUpperCase()}</span></h3>
                  <p>Based on your answers, this is your dominant dosha type.</p>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="onboarding-step">
            <div className="step-header">
              <Leaf Users className="step-icon" size={48} />
              <h2>Cultural Background</h2>
              <p>Help us understand your cultural heritage</p>
            </div>
            <div className="step-content">
              <div className="cultural-background">
                <h3>Select your cultural background</h3>
                <select
                  value={onboardingData.culturalBackground}
                  onChange={(e) => setOnboardingData(prev => ({ ...prev, culturalBackground: e.target.value }))}
                  className="background-select"
                >
                  <option value="hindu">Hindu</option>
                  <option value="jain">Jain</option>
                  <option value="sikh">Sikh</option>
                  <option value="buddhist">Buddhist</option>
                  <option value="indian_general">Indian (General)</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="onboarding-step">
            <div className="step-header">
              <Leaf Users className="step-icon" size={48} />
              <h2>Shopping Preferences</h2>
              <p>Where do you prefer to shop for groceries?</p>
            </div>
            <div className="step-content">
              <div className="retailer-selection">
                <h3>Select your preferred retailers</h3>
                <div className="retailer-grid">
                  {RETAILER_OPTIONS.map(retailer => (
                    <Card
                      key={retailer.value}
                      className={`retailer-card ${onboardingData.preferredRetailers.includes(retailer.value) ? 'selected' : ''}`}
                      onClick={() => handleRetailerSelection(retailer.value)}
                    >
                      <h4>{retailer.label}</h4>
                      <p>{retailer.description}</p>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-container">
        <div className="onboarding-header">
          <ProgressIndicator progress={progress} />
          <h1>Welcome to Cultural Diet</h1>
          <p>Step {currentStep + 1} of {totalSteps}</p>
        </div>

        <div className="onboarding-content">
          {renderStepContent()}
        </div>

        <div className="onboarding-footer">
          <div className="navigation-buttons">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handlePrevious}
                icon={<ChevronLeft size={20} />}
              >
                Previous
              </Button>
            )}
            <Button
              onClick={handleNext}
              icon={<ChevronRight size={20} />}
              iconPosition="right"
              disabled={
                (currentStep === 0 && onboardingData.cuisinePreferences.length === 0) ||
                (currentStep === 2 && !onboardingData.dosha)
              }
            >
              {currentStep === totalSteps - 1 ? 'Complete Setup' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;