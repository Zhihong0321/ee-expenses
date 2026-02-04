/**
 * Preset Expense Categories
 * Used for auto-categorization and spending analysis
 */

const EXPENSE_CATEGORIES = {
  // 1. Travel & Transport
  TRAVEL: {
    id: 'travel',
    name: 'Travel & Transport',
    icon: 'plane',
    keywords: ['airline', 'airport', 'taxi', 'uber', 'lyft', 'train', 'bus', 'transit', 'parking', 'toll', 'fuel', 'gas', 'rental car', 'hotel', 'lodging', 'accommodation'],
    merchants: ['uber', 'lyft', 'grab', 'taxi', 'shell', 'esso', 'petronas', 'airasia', 'malaysia airlines', 'singapore airlines', 'booking.com', 'agoda', 'expedia', 'airbnb']
  },
  
  // 2. Meals & Entertainment
  MEALS: {
    id: 'meals',
    name: 'Meals & Entertainment',
    icon: 'utensils',
    keywords: ['restaurant', 'cafe', 'coffee', 'food', 'lunch', 'dinner', 'breakfast', 'meal', 'catering', 'bar', 'pub'],
    merchants: ['mcdonalds', 'kfc', 'starbucks', 'coffee bean', 'pizza hut', 'dominos', 'subway', 'sushi', 'ramen', 'korean bbq', 'steakhouse', 'seafood']
  },
  
  // 3. Office Supplies
  OFFICE: {
    id: 'office',
    name: 'Office Supplies',
    icon: 'briefcase',
    keywords: ['stationery', 'paper', 'pen', 'printer', 'ink', 'toner', 'stapler', 'folder', 'notebook'],
    merchants: ['popular', 'muji', 'daiso', 'staples', 'office depot']
  },
  
  // 4. Technology & Software
  TECH: {
    id: 'tech',
    name: 'Technology & Software',
    icon: 'laptop',
    keywords: ['software', 'subscription', 'app', 'license', 'domain', 'hosting', 'cloud', 'data', 'saas', 'zoom', 'slack', 'jira'],
    merchants: ['adobe', 'microsoft', 'google', 'aws', 'azure', 'zoom', 'slack', 'atlassian', 'github']
  },

  // 5. Communications
  COMMUNICATIONS: {
    id: 'communications',
    name: 'Communications',
    icon: 'phone',
    keywords: ['phone', 'mobile', 'internet', 'broadband', 'telecom', 'data plan'],
    merchants: ['digi', 'maxis', 'celcom', 'umobile', 'yes', 'unifi', 't-mobile', 'verizon', 'att']
  },

  // 6. Professional Services
  PROFESSIONAL: {
    id: 'professional',
    name: 'Professional Services',
    icon: 'scale',
    keywords: ['legal', 'accounting', 'audit', 'consulting', 'advisory', 'lawyer', 'tax'],
    merchants: ['pwc', 'ey', 'kpmg', 'deloitte', 'law firm', 'consulting']
  },

  // 7. Marketing & Advertising
  MARKETING: {
    id: 'marketing',
    name: 'Marketing & Advertising',
    icon: 'megaphone',
    keywords: ['advertising', 'promotion', 'marketing', 'campaign', 'sponsorship', 'facebook ads', 'google ads', 'printing', 'banner'],
    merchants: ['facebook ads', 'google ads', 'linkedin ads', 'tiktok ads', 'canva', 'shutterstock']
  },

  // 8. Utilities & Operations
  UTILITIES: {
    id: 'utilities',
    name: 'Utilities & Operations',
    icon: 'zap',
    keywords: ['electricity', 'water', 'gas', 'maintenance', 'repair', 'cleaning', 'rent', 'facility'],
    merchants: ['tenaga nasional', 'tnb', 'syabas', 'air selangor']
  },

  // 9. Training & Education
  TRAINING: {
    id: 'training',
    name: 'Training & Education',
    icon: 'graduation-cap',
    keywords: ['training', 'course', 'certification', 'seminar', 'workshop', 'conference', 'learning', 'tuition'],
    merchants: ['udemy', 'coursera', 'linkedin learning', 'pluralsight']
  },

  // 10. Equipment & Hardware
  EQUIPMENT: {
    id: 'equipment',
    name: 'Equipment & Hardware',
    icon: 'hard-drive',
    keywords: ['laptop', 'computer', 'monitor', 'keyboard', 'mouse', 'furniture', 'desk', 'chair', 'hardware', 'machinery'],
    merchants: ['apple store', 'dell', 'hp', 'lenovo', 'ikea', 'harvey norman']
  },

  // 11. Insurance
  INSURANCE: {
    id: 'insurance',
    name: 'Insurance',
    icon: 'shield',
    keywords: ['insurance', 'premium', 'coverage', 'liability', 'medical insurance', 'health insurance'],
    merchants: ['allianz', 'prudential', 'aia', 'manulife', 'axa']
  },

  // 12. Logistics & Postage
  LOGISTICS: {
    id: 'logistics',
    name: 'Logistics & Postage',
    icon: 'truck',
    keywords: ['shipping', 'delivery', 'courier', 'postage', 'mail', 'freight', 'fedex', 'dhl', 'ups', 'poslaju'],
    merchants: ['fedex', 'dhl', 'ups', 'poslaju', 'j&t', 'grabexpress']
  },

  // Health & Wellness (Keep existing if needed, but the user asked for 12)
  HEALTH: {
    id: 'health',
    name: 'Health & Wellness',
    icon: 'heart',
    keywords: ['medical', 'pharmacy', 'doctor', 'dentist', 'clinic', 'hospital', 'medicine', 'gym'],
    merchants: ['guardian', 'watsons', 'caring']
  },
  
  // Miscellaneous
  MISC: {
    id: 'misc',
    name: 'Miscellaneous',
    icon: 'more-horizontal',
    keywords: [],
    merchants: []
  }
};

/**
 * Auto-categorize based on merchant name and items
 * @param {string} merchant - Merchant name
 * @param {Array} items - Bill items
 * @returns {string} Category ID
 */
function autoCategorize(merchant = '', items = []) {
  const merchantLower = merchant.toLowerCase();
  const itemsText = items.map(i => (i.item_description || '').toLowerCase()).join(' ');
  
  // Check merchants first (exact or partial match)
  for (const [key, cat] of Object.entries(EXPENSE_CATEGORIES)) {
    if (cat.merchants && cat.merchants.some(m => merchantLower.includes(m))) {
      return cat.id;
    }
  }
  
  // Check keywords in merchant name or items
  for (const [key, cat] of Object.entries(EXPENSE_CATEGORIES)) {
    if (cat.keywords && cat.keywords.some(k => merchantLower.includes(k) || itemsText.includes(k))) {
      return cat.id;
    }
  }
  
  return 'misc';
}

/**
 * Get all categories as an array
 */
function getAllCategories() {
  return Object.values(EXPENSE_CATEGORIES);
}

/**
 * Get category by ID
 */
function getCategoryById(id) {
  return Object.values(EXPENSE_CATEGORIES).find(cat => cat.id === id) || EXPENSE_CATEGORIES.MISC;
}

module.exports = {
  EXPENSE_CATEGORIES,
  autoCategorize,
  getAllCategories,
  getCategoryById
};
