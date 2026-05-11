/**
 * Known antiparasitic products for dogs (Polish market).
 * activeIngredient — main active substance(s)
 * ingredientClass  — pharmacological class (used for cross-reaction warnings)
 * type             — what it protects against
 * intervalDays     — typical re-dosing interval in days (null = depends on product/weight)
 */

export const ANTIPARASITIC_PRODUCTS = {
  // ── Isoxazolines – afoxolaner ────────────────────────────────────────────
  'NexGard': {
    activeIngredient: 'afoxolaner',
    ingredientClass:  'isoxazoline',
    type:             'tick+flea',
    intervalDays:     30,
  },
  'NexGard Spectra': {
    activeIngredient: 'afoxolaner + milbemycin',
    ingredientClass:  'isoxazoline',
    type:             'tick+flea+worm',
    intervalDays:     30,
  },
  'Front Pro': {
    activeIngredient: 'afoxolaner',
    ingredientClass:  'isoxazoline',
    type:             'tick+flea',
    intervalDays:     30,
  },

  // ── Isoxazolines – fluralaner ────────────────────────────────────────────
  'Bravecto': {
    activeIngredient: 'fluralaner',
    ingredientClass:  'isoxazoline',
    type:             'tick+flea',
    intervalDays:     84,  // 12 weeks
  },
  'Bravecto Plus': {
    activeIngredient: 'fluralaner + moxidectin',
    ingredientClass:  'isoxazoline',
    type:             'tick+flea+worm',
    intervalDays:     84,
  },

  // ── Isoxazolines – sarolaner ─────────────────────────────────────────────
  'Simparica': {
    activeIngredient: 'sarolaner',
    ingredientClass:  'isoxazoline',
    type:             'tick+flea',
    intervalDays:     30,
  },
  'Simparica Trio': {
    activeIngredient: 'sarolaner + moxidectin + pyrantel',
    ingredientClass:  'isoxazoline',
    type:             'tick+flea+worm',
    intervalDays:     30,
  },

  // ── Isoxazolines – lotilaner ─────────────────────────────────────────────
  'Credelio': {
    activeIngredient: 'lotilaner',
    ingredientClass:  'isoxazoline',
    type:             'tick+flea',
    intervalDays:     30,
  },
  'Credelio Plus': {
    activeIngredient: 'lotilaner + milbemycin',
    ingredientClass:  'isoxazoline',
    type:             'tick+flea+worm',
    intervalDays:     30,
  },

  // ── Avermectins / Selamectin ─────────────────────────────────────────────
  'Stronghold': {
    activeIngredient: 'selamectin',
    ingredientClass:  'avermectin',
    type:             'flea+worm',
    intervalDays:     30,
  },
  'Stronghold Plus': {
    activeIngredient: 'selamectin + sarolaner',
    ingredientClass:  'avermectin+isoxazoline',
    type:             'tick+flea+worm',
    intervalDays:     30,
  },
  'Stronghold TRIO': {
    activeIngredient: 'selamectin + sarolaner',
    ingredientClass:  'avermectin+isoxazoline',
    type:             'tick+flea+worm',
    intervalDays:     30,
  },
  'Revolution': {
    activeIngredient: 'selamectin',
    ingredientClass:  'avermectin',
    type:             'flea+worm',
    intervalDays:     30,
  },

  // ── Phenylpyrazoles / Fipronil ───────────────────────────────────────────
  'Frontline': {
    activeIngredient: 'fipronil',
    ingredientClass:  'phenylpyrazole',
    type:             'tick+flea',
    intervalDays:     30,
  },
  'Frontline Combo': {
    activeIngredient: 'fipronil + s-methoprene',
    ingredientClass:  'phenylpyrazole',
    type:             'tick+flea',
    intervalDays:     30,
  },
  'Frontline Tri-Act': {
    activeIngredient: 'fipronil + permethrin',
    ingredientClass:  'phenylpyrazole+pyrethroid',
    type:             'tick+flea',
    intervalDays:     30,
  },

  // ── Neonicotinoids ───────────────────────────────────────────────────────
  'Advantage': {
    activeIngredient: 'imidacloprid',
    ingredientClass:  'neonicotinoid',
    type:             'flea',
    intervalDays:     30,
  },
  'Advantix': {
    activeIngredient: 'imidacloprid + permethrin',
    ingredientClass:  'neonicotinoid+pyrethroid',
    type:             'tick+flea',
    intervalDays:     30,
  },

  // ── Collars ──────────────────────────────────────────────────────────────
  'Seresto': {
    activeIngredient: 'imidacloprid + flumethrin',
    ingredientClass:  'neonicotinoid+pyrethroid',
    type:             'tick+flea',
    intervalDays:     240,  // 8 months
  },

  // ── Dewormers ────────────────────────────────────────────────────────────
  'Drontal Junior': {
    activeIngredient: 'pyrantel + praziquantel',
    ingredientClass:  'anthelmintic',
    type:             'dewormer',
    intervalDays:     null,
  },
  'Drontal': {
    activeIngredient: 'pyrantel + praziquantel',
    ingredientClass:  'anthelmintic',
    type:             'dewormer',
    intervalDays:     null,
  },
  'Drontal Plus': {
    activeIngredient: 'febantel + pyrantel + praziquantel',
    ingredientClass:  'anthelmintic',
    type:             'dewormer',
    intervalDays:     null,
  },
  'Milbemax': {
    activeIngredient: 'milbemycin + praziquantel',
    ingredientClass:  'anthelmintic',
    type:             'dewormer',
    intervalDays:     null,
  },
  'Panacur': {
    activeIngredient: 'fenbendazole',
    ingredientClass:  'benzimidazole',
    type:             'dewormer',
    intervalDays:     null,
  },
  'Caniquantel': {
    activeIngredient: 'praziquantel + pyrantel',
    ingredientClass:  'anthelmintic',
    type:             'dewormer',
    intervalDays:     null,
  },
  'Exitel': {
    activeIngredient: 'pyrantel + praziquantel',
    ingredientClass:  'anthelmintic',
    type:             'dewormer',
    intervalDays:     null,
  },
}

/** All product names as a sorted list (for autocomplete / dropdowns) */
export const PRODUCT_NAMES = Object.keys(ANTIPARASITIC_PRODUCTS).sort()

/** Look up a product by name (case-insensitive) */
export function getProduct(name) {
  if (!name) return null
  const key = Object.keys(ANTIPARASITIC_PRODUCTS)
    .find(k => k.toLowerCase() === name.toLowerCase())
  return key ? { name: key, ...ANTIPARASITIC_PRODUCTS[key] } : null
}

/**
 * Given a list of past reactions (array of { product, reaction }),
 * check if a new product shares the same active ingredient class
 * as a product that caused a reaction.
 * Returns a warning string or null.
 */
export function checkCrossReaction(newProductName, pastRecords) {
  const newProduct = getProduct(newProductName)
  if (!newProduct) return null

  for (const record of pastRecords) {
    if (!record.reaction || record.reaction === 'none') continue
    const past = getProduct(record.product)
    if (!past) continue

    // Same product → obvious warning
    if (past.name === newProduct.name) {
      return { level: 'high', sameProduct: true, ingredient: past.activeIngredient }
    }

    // Same ingredient class → cross-reaction warning
    // Compare individual classes (a product may have multiple, e.g. 'isoxazoline+avermectin')
    const pastClasses = past.ingredientClass.split('+')
    const newClasses  = newProduct.ingredientClass.split('+')
    const shared      = pastClasses.filter(c => newClasses.includes(c))

    if (shared.length > 0) {
      return {
        level:           'medium',
        sameProduct:     false,
        ingredient:      newProduct.activeIngredient,
        sharedClass:     shared[0],
        priorProduct:    past.name,
        priorIngredient: past.activeIngredient,
        reaction:        record.reaction,
      }
    }
  }

  return null
}

// ─── Vaccine types ────────────────────────────────────────────────────────────

export const VACCINE_TYPES = [
  { value: 'rabies',   labelKey: 'health.vaccineTypes.rabies'   },
  { value: 'combined', labelKey: 'health.vaccineTypes.combined' },
  { value: 'other',    labelKey: 'health.vaccineTypes.other'    },
]

export const REACTION_TYPES = [
  { value: 'none',     labelKey: 'health.reactions.none'     },
  { value: 'diarrhea', labelKey: 'health.reactions.diarrhea' },
  { value: 'vomiting', labelKey: 'health.reactions.vomiting' },
  { value: 'lethargy', labelKey: 'health.reactions.lethargy' },
  { value: 'other',    labelKey: 'health.reactions.other'    },
]
