import React, { createContext, useContext, useEffect, useState } from 'react';

type Language = 'en' | 'hi' | 'es';

interface Translations {
  [key: string]: {
    [key in Language]: string;
  };
}

const translations: Translations = {
  // Navigation
  'nav.dashboard': {
    en: 'Dashboard',
    hi: 'डैशबोर्ड',
    es: 'Panel Principal'
  },
  'nav.mealPlan': {
    en: 'Meal Plan',
    hi: 'भोजन योजना',
    es: 'Plan de Comidas'
  },
  'nav.recipes': {
    en: 'Recipes',
    hi: 'व्यंजन',
    es: 'Recetas'
  },
  'nav.shoppingList': {
    en: 'Shopping List',
    hi: 'खरीदारी सूची',
    es: 'Lista de Compras'
  },
  'nav.settings': {
    en: 'Settings',
    hi: 'सेटिंग्स',
    es: 'Configuración'
  },
  'nav.profile': {
    en: 'Profile',
    hi: 'प्रोफ़ाइल',
    es: 'Perfil'
  },
  'nav.logout': {
    en: 'Logout',
    hi: 'लॉगआउट',
    es: 'Cerrar Sesión'
  },

  // Common
  'common.loading': {
    en: 'Loading...',
    hi: 'लोड हो रहा है...',
    es: 'Cargando...'
  },
  'common.save': {
    en: 'Save',
    hi: 'सहेजें',
    es: 'Guardar'
  },
  'common.cancel': {
    en: 'Cancel',
    hi: 'रद्द करें',
    es: 'Cancelar'
  },
  'common.edit': {
    en: 'Edit',
    hi: 'संपादित करें',
    es: 'Editar'
  },
  'common.delete': {
    en: 'Delete',
    hi: 'हटाएं',
    es: 'Eliminar'
  },
  'common.add': {
    en: 'Add',
    hi: 'जोड़ें',
    es: 'Agregar'
  },
  'common.search': {
    en: 'Search',
    hi: 'खोजें',
    es: 'Buscar'
  },
  'common.filter': {
    en: 'Filter',
    hi: 'फ़िल्टर',
    es: 'Filtrar'
  },
  'common.next': {
    en: 'Next',
    hi: 'अगला',
    es: 'Siguiente'
  },
  'common.previous': {
    en: 'Previous',
    hi: 'पिछला',
    es: 'Anterior'
  },
  'common.submit': {
    en: 'Submit',
    hi: 'जमा करें',
    es: 'Enviar'
  },
  'common.error': {
    en: 'Error',
    hi: 'त्रुटि',
    es: 'Error'
  },
  'common.success': {
    en: 'Success',
    hi: 'सफलता',
    es: 'Éxito'
  },

  // Authentication
  'auth.login': {
    en: 'Login',
    hi: 'लॉगिन',
    es: 'Iniciar Sesión'
  },
  'auth.register': {
    en: 'Register',
    hi: 'रजिस्टर',
    es: 'Registrarse'
  },
  'auth.email': {
    en: 'Email',
    hi: 'ईमेल',
    es: 'Correo'
  },
  'auth.password': {
    en: 'Password',
    hi: 'पासवर्ड',
    es: 'Contraseña'
  },
  'auth.name': {
    en: 'Name',
    hi: 'नाम',
    es: 'Nombre'
  },

  // Cuisine Types
  'cuisine.northIndian': {
    en: 'North Indian',
    hi: 'उत्तर भारतीय',
    es: 'Norte de la India'
  },
  'cuisine.southIndian': {
    en: 'South Indian',
    hi: 'दक्षिण भारतीय',
    es: 'Sur de la India'
  },
  'cuisine.mughlai': {
    en: 'Mughlai',
    hi: 'मुगलई',
    es: 'Mogol'
  },
  'cuisine.gujarati': {
    en: 'Gujarati',
    hi: 'गुजराती',
    es: 'Guyaratí'
  },
  'cuisine.punjabi': {
    en: 'Punjabi',
    hi: 'पंजाबी',
    es: 'Punyabí'
  },
  'cuisine.bengali': {
    en: 'Bengali',
    hi: 'बंगाली',
    es: 'Bengalí'
  },
  'cuisine.rajasthani': {
    en: 'Rajasthani',
    hi: 'राजस्थानी',
    es: 'Rajastaní'
  },

  // Doshas
  'dosha.vata': {
    en: 'Vata',
    hi: 'वात',
    es: 'Vata'
  },
  'dosha.pitta': {
    en: 'Pitta',
    hi: 'पित्त',
    es: 'Pitta'
  },
  'dosha.kapha': {
    en: 'Kapha',
    hi: 'कफ',
    es: 'Kapha'
  },
  'dosha.tridosha': {
    en: 'Tridosha',
    hi: 'त्रिदोष',
    es: 'Tridosha'
  },

  // Meal Types
  'meal.breakfast': {
    en: 'Breakfast',
    hi: 'नाश्ता',
    es: 'Desayuno'
  },
  'meal.lunch': {
    en: 'Lunch',
    hi: 'दोपहर का भोजन',
    es: 'Almuerzo'
  },
  'meal.dinner': {
    en: 'Dinner',
    hi: 'रात का भोजन',
    es: 'Cena'
  },
  'meal.snack': {
    en: 'Snack',
    hi: 'नाश्ता',
    es: 'Snack'
  },

  // Cultural Compliance
  'compliance.strict': {
    en: 'Strictly Compliant',
    hi: 'सख्ती अनुपालन',
    es: 'Cumplimiento Estricto'
  },
  'compliance.moderate': {
    en: 'Moderately Compliant',
    hi: 'मध्यम अनुपालन',
    es: 'Cumplimiento Moderado'
  },
  'compliance.restricted': {
    en: 'Restricted - Check Ingredients',
    hi: 'प्रतिबंधित - सामग्री जांचें',
    es: 'Restringido - Verificar Ingredientes'
  },

  // Error Messages
  'error.network': {
    en: 'Network error. Please check your connection.',
    hi: 'नेटवर्क त्रुटि। कृपया अपना कनेक्शन जांचें।',
    es: 'Error de red. Por favor verifique su conexión.'
  },
  'error.server': {
    en: 'Server error. Please try again later.',
    hi: 'सर्वर त्रुटि। कृपया बाद में प्रयास करें।',
    es: 'Error del servidor. Por favor intentelo más tarde.'
  },
  'error.unauthorized': {
    en: 'Please login to continue.',
    hi: 'जारी रखने के लिए कृपया लॉगिन करें।',
    es: 'Por favor inicie sesión para continuar.'
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language') as Language;
    if (saved && ['en', 'hi', 'es'].includes(saved)) {
      return saved;
    }
    return 'en';
  });

  const isRTL = language === 'hi' || language === 'ar'; // For future Arabic support

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language;

    // Update text direction for RTL languages
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  }, [language, isRTL]);

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
  };

  const t = (key: string): string => {
    if (translations[key]) {
      return translations[key][language] || key;
    }
    console.warn(`Translation missing for key: ${key}`);
    return key;
  };

  const value: LanguageContextType = {
    language,
    setLanguage,
    t,
    isRTL,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};