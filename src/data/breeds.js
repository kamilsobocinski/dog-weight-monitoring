// Weight ranges in kg per breed, split by sex (male/female)
// Source: FCI breed standards, AKC breed standards, veterinary references
// adultMin/adultMax = adult weight range
// growthCurve = fraction of adult weight at given age in months [3,6,9,12,18,24]
export const breeds = [
  { id: 1,  name: "Labrador Retriever",         male: { min: 29, max: 36 }, female: { min: 25, max: 32 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 2,  name: "German Shepherd",            male: { min: 30, max: 40 }, female: { min: 22, max: 32 }, growth: [0.28,0.52,0.72,0.85,0.96,1.00] },
  { id: 3,  name: "Golden Retriever",           male: { min: 29, max: 34 }, female: { min: 25, max: 29 }, growth: [0.28,0.52,0.72,0.86,0.97,1.00] },
  { id: 4,  name: "French Bulldog",             male: { min: 9,  max: 14 }, female: { min: 8,  max: 13 }, growth: [0.35,0.62,0.82,0.93,0.99,1.00] },
  { id: 5,  name: "Bulldog",                    male: { min: 23, max: 25 }, female: { min: 18, max: 23 }, growth: [0.33,0.60,0.80,0.92,0.99,1.00] },
  { id: 6,  name: "Poodle (Standard)",          male: { min: 20, max: 32 }, female: { min: 18, max: 28 }, growth: [0.27,0.50,0.70,0.84,0.96,1.00] },
  { id: 7,  name: "Poodle (Miniature)",         male: { min: 5,  max: 9  }, female: { min: 5,  max: 9  }, growth: [0.38,0.65,0.84,0.94,0.99,1.00] },
  { id: 8,  name: "Poodle (Toy)",               male: { min: 2,  max: 4  }, female: { min: 2,  max: 4  }, growth: [0.40,0.68,0.86,0.95,1.00,1.00] },
  { id: 9,  name: "Beagle",                     male: { min: 10, max: 16 }, female: { min: 9,  max: 14 }, growth: [0.35,0.62,0.82,0.92,0.99,1.00] },
  { id: 10, name: "Rottweiler",                 male: { min: 50, max: 60 }, female: { min: 35, max: 48 }, growth: [0.25,0.48,0.68,0.82,0.95,1.00] },
  { id: 11, name: "Yorkshire Terrier",          male: { min: 2,  max: 3.2 }, female: { min: 2, max: 3.2 }, growth: [0.40,0.68,0.86,0.95,1.00,1.00] },
  { id: 12, name: "Boxer",                      male: { min: 27, max: 32 }, female: { min: 25, max: 29 }, growth: [0.28,0.52,0.72,0.86,0.97,1.00] },
  { id: 13, name: "Dachshund (Standard)",       male: { min: 7,  max: 15 }, female: { min: 7,  max: 15 }, growth: [0.38,0.65,0.84,0.94,0.99,1.00] },
  { id: 14, name: "Siberian Husky",             male: { min: 20, max: 27 }, female: { min: 16, max: 23 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 15, name: "Great Dane",                 male: { min: 54, max: 90 }, female: { min: 45, max: 72 }, growth: [0.22,0.45,0.65,0.80,0.95,1.00] },
  { id: 16, name: "Doberman Pinscher",          male: { min: 34, max: 45 }, female: { min: 27, max: 41 }, growth: [0.27,0.50,0.70,0.84,0.96,1.00] },
  { id: 17, name: "Shih Tzu",                   male: { min: 4,  max: 7.5 }, female: { min: 4, max: 7.5 }, growth: [0.40,0.68,0.86,0.95,1.00,1.00] },
  { id: 18, name: "Australian Shepherd",        male: { min: 25, max: 32 }, female: { min: 16, max: 25 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 19, name: "Miniature Schnauzer",        male: { min: 5.5, max: 9 }, female: { min: 5.5, max: 9 }, growth: [0.38,0.65,0.84,0.94,0.99,1.00] },
  { id: 20, name: "Cavalier King Charles Spaniel", male: { min: 5.9, max: 8.2 }, female: { min: 5.9, max: 8.2 }, growth: [0.40,0.68,0.86,0.95,1.00,1.00] },
  { id: 21, name: "Border Collie",              male: { min: 14, max: 20 }, female: { min: 12, max: 19 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 22, name: "Pomeranian",                 male: { min: 1.4, max: 3.2 }, female: { min: 1.4, max: 3.2 }, growth: [0.42,0.70,0.88,0.96,1.00,1.00] },
  { id: 23, name: "Bernese Mountain Dog",       male: { min: 38, max: 50 }, female: { min: 35, max: 48 }, growth: [0.25,0.48,0.68,0.82,0.95,1.00] },
  { id: 24, name: "Shetland Sheepdog",          male: { min: 6,  max: 12 }, female: { min: 6,  max: 12 }, growth: [0.35,0.62,0.82,0.93,0.99,1.00] },
  { id: 25, name: "Pug",                        male: { min: 6,  max: 8  }, female: { min: 6,  max: 8  }, growth: [0.40,0.68,0.86,0.95,1.00,1.00] },
  { id: 26, name: "English Springer Spaniel",   male: { min: 20, max: 25 }, female: { min: 18, max: 23 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 27, name: "Cocker Spaniel",             male: { min: 11, max: 14 }, female: { min: 9,  max: 13 }, growth: [0.35,0.62,0.82,0.93,0.99,1.00] },
  { id: 28, name: "Maltese",                    male: { min: 1.5, max: 4 }, female: { min: 1.5, max: 4 }, growth: [0.42,0.70,0.88,0.96,1.00,1.00] },
  { id: 29, name: "Chihuahua",                  male: { min: 1.5, max: 3 }, female: { min: 1.5, max: 3 }, growth: [0.45,0.72,0.90,0.97,1.00,1.00] },
  { id: 30, name: "German Shorthaired Pointer", male: { min: 25, max: 32 }, female: { min: 20, max: 27 }, growth: [0.28,0.52,0.72,0.86,0.97,1.00] },
  { id: 31, name: "Havanese",                   male: { min: 3,  max: 6  }, female: { min: 3,  max: 6  }, growth: [0.42,0.70,0.88,0.96,1.00,1.00] },
  { id: 32, name: "Weimaraner",                 male: { min: 30, max: 40 }, female: { min: 25, max: 35 }, growth: [0.28,0.52,0.72,0.86,0.97,1.00] },
  { id: 33, name: "Vizsla",                     male: { min: 22, max: 30 }, female: { min: 18, max: 25 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 34, name: "Collie (Rough)",             male: { min: 27, max: 34 }, female: { min: 23, max: 29 }, growth: [0.28,0.52,0.72,0.86,0.97,1.00] },
  { id: 35, name: "Newfoundland",               male: { min: 60, max: 70 }, female: { min: 45, max: 55 }, growth: [0.22,0.44,0.64,0.78,0.94,1.00] },
  { id: 36, name: "Irish Setter",               male: { min: 27, max: 32 }, female: { min: 25, max: 29 }, growth: [0.28,0.52,0.72,0.86,0.97,1.00] },
  { id: 37, name: "Bichon Frise",               male: { min: 3,  max: 5  }, female: { min: 3,  max: 5  }, growth: [0.42,0.70,0.88,0.96,1.00,1.00] },
  { id: 38, name: "West Highland White Terrier",male: { min: 6.5, max: 10 }, female: { min: 6, max: 9 }, growth: [0.38,0.65,0.84,0.94,0.99,1.00] },
  { id: 39, name: "Basset Hound",               male: { min: 25, max: 34 }, female: { min: 20, max: 29 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 40, name: "Papillon",                   male: { min: 3.5, max: 5 }, female: { min: 3.5, max: 5 }, growth: [0.42,0.70,0.88,0.96,1.00,1.00] },
  { id: 41, name: "Saint Bernard",              male: { min: 64, max: 82 }, female: { min: 54, max: 64 }, growth: [0.20,0.42,0.62,0.77,0.93,1.00] },
  { id: 42, name: "Akita",                      male: { min: 34, max: 54 }, female: { min: 34, max: 50 }, growth: [0.27,0.50,0.70,0.84,0.96,1.00] },
  { id: 43, name: "Alaskan Malamute",           male: { min: 36, max: 43 }, female: { min: 32, max: 38 }, growth: [0.27,0.50,0.70,0.84,0.96,1.00] },
  { id: 44, name: "Basenji",                    male: { min: 10, max: 12 }, female: { min: 9,  max: 11 }, growth: [0.38,0.65,0.84,0.94,0.99,1.00] },
  { id: 45, name: "Belgian Malinois",           male: { min: 25, max: 34 }, female: { min: 18, max: 27 }, growth: [0.28,0.52,0.72,0.86,0.97,1.00] },
  { id: 46, name: "Bull Terrier",               male: { min: 22, max: 38 }, female: { min: 20, max: 36 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 47, name: "Bullmastiff",                male: { min: 50, max: 59 }, female: { min: 41, max: 50 }, growth: [0.23,0.46,0.66,0.80,0.95,1.00] },
  { id: 48, name: "Cairn Terrier",              male: { min: 6,  max: 7.5 }, female: { min: 6, max: 7.5 }, growth: [0.40,0.68,0.86,0.95,1.00,1.00] },
  { id: 49, name: "Chow Chow",                  male: { min: 25, max: 32 }, female: { min: 20, max: 27 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 50, name: "Dalmation",                  male: { min: 23, max: 27 }, female: { min: 18, max: 25 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 51, name: "English Cocker Spaniel",     male: { min: 13, max: 16 }, female: { min: 12, max: 15 }, growth: [0.35,0.62,0.82,0.93,0.99,1.00] },
  { id: 52, name: "Flat-Coated Retriever",      male: { min: 27, max: 36 }, female: { min: 25, max: 32 }, growth: [0.28,0.52,0.72,0.86,0.97,1.00] },
  { id: 53, name: "Giant Schnauzer",            male: { min: 35, max: 47 }, female: { min: 30, max: 41 }, growth: [0.27,0.50,0.70,0.84,0.96,1.00] },
  { id: 54, name: "Greyhound",                  male: { min: 27, max: 32 }, female: { min: 25, max: 29 }, growth: [0.28,0.52,0.72,0.86,0.97,1.00] },
  { id: 55, name: "Irish Wolfhound",            male: { min: 54, max: 70 }, female: { min: 40, max: 55 }, growth: [0.20,0.42,0.62,0.77,0.93,1.00] },
  { id: 56, name: "Jack Russell Terrier",       male: { min: 5,  max: 8  }, female: { min: 5,  max: 8  }, growth: [0.40,0.68,0.86,0.95,1.00,1.00] },
  { id: 57, name: "Keeshond",                   male: { min: 16, max: 20 }, female: { min: 16, max: 20 }, growth: [0.33,0.60,0.80,0.92,0.99,1.00] },
  { id: 58, name: "Leonberger",                 male: { min: 54, max: 77 }, female: { min: 41, max: 59 }, growth: [0.22,0.44,0.64,0.78,0.94,1.00] },
  { id: 59, name: "Lhasa Apso",                 male: { min: 5.5, max: 8 }, female: { min: 5, max: 7 }, growth: [0.40,0.68,0.86,0.95,1.00,1.00] },
  { id: 60, name: "Mastiff",                    male: { min: 73, max: 100 }, female: { min: 54, max: 77 }, growth: [0.20,0.40,0.60,0.76,0.92,1.00] },
  { id: 61, name: "Miniature Pinscher",         male: { min: 4,  max: 5  }, female: { min: 4,  max: 5  }, growth: [0.42,0.70,0.88,0.96,1.00,1.00] },
  { id: 62, name: "Norwich Terrier",            male: { min: 5,  max: 5.5 }, female: { min: 5, max: 5.5 }, growth: [0.42,0.70,0.88,0.96,1.00,1.00] },
  { id: 63, name: "Old English Sheepdog",       male: { min: 30, max: 45 }, female: { min: 27, max: 36 }, growth: [0.27,0.50,0.70,0.84,0.96,1.00] },
  { id: 64, name: "Pembroke Welsh Corgi",       male: { min: 10, max: 14 }, female: { min: 10, max: 13 }, growth: [0.35,0.62,0.82,0.93,0.99,1.00] },
  { id: 65, name: "Plott Hound",                male: { min: 22, max: 27 }, female: { min: 18, max: 25 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 66, name: "Portuguese Water Dog",       male: { min: 16, max: 25 }, female: { min: 16, max: 23 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 67, name: "Rhodesian Ridgeback",        male: { min: 36, max: 41 }, female: { min: 29, max: 34 }, growth: [0.27,0.50,0.70,0.84,0.96,1.00] },
  { id: 68, name: "Samoyed",                    male: { min: 20, max: 30 }, female: { min: 16, max: 23 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 69, name: "Schipperke",                 male: { min: 5,  max: 9  }, female: { min: 5,  max: 9  }, growth: [0.40,0.68,0.86,0.95,1.00,1.00] },
  { id: 70, name: "Scottish Terrier",           male: { min: 8.5, max: 10 }, female: { min: 8, max: 9.5 }, growth: [0.40,0.68,0.86,0.95,1.00,1.00] },
  { id: 71, name: "Soft Coated Wheaten Terrier",male: { min: 16, max: 20 }, female: { min: 14, max: 18 }, growth: [0.33,0.60,0.80,0.92,0.99,1.00] },
  { id: 72, name: "Staffordshire Bull Terrier", male: { min: 13, max: 17 }, female: { min: 11, max: 15.5 }, growth: [0.35,0.62,0.82,0.93,0.99,1.00] },
  { id: 73, name: "Standard Schnauzer",         male: { min: 14, max: 20 }, female: { min: 14, max: 20 }, growth: [0.35,0.62,0.82,0.93,0.99,1.00] },
  { id: 74, name: "Sussex Spaniel",             male: { min: 18, max: 20 }, female: { min: 16, max: 18 }, growth: [0.33,0.60,0.80,0.92,0.99,1.00] },
  { id: 75, name: "Tibetan Mastiff",            male: { min: 45, max: 72 }, female: { min: 34, max: 54 }, growth: [0.23,0.46,0.66,0.80,0.95,1.00] },
  { id: 76, name: "Tibetan Terrier",            male: { min: 8,  max: 14 }, female: { min: 8,  max: 14 }, growth: [0.38,0.65,0.84,0.94,0.99,1.00] },
  { id: 77, name: "Toy Fox Terrier",            male: { min: 1.5, max: 3.5 }, female: { min: 1.5, max: 3.5 }, growth: [0.42,0.70,0.88,0.96,1.00,1.00] },
  { id: 78, name: "Whippet",                    male: { min: 12, max: 14 }, female: { min: 10, max: 14 }, growth: [0.33,0.60,0.80,0.92,0.99,1.00] },
  { id: 79, name: "Dachshund (Miniature)",      male: { min: 4,  max: 5.5 }, female: { min: 4, max: 5.5 }, growth: [0.40,0.68,0.86,0.95,1.00,1.00] },
  { id: 80, name: "American Staffordshire Terrier", male: { min: 25, max: 30 }, female: { min: 22, max: 28 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 81, name: "Bloodhound",                 male: { min: 41, max: 50 }, female: { min: 36, max: 45 }, growth: [0.27,0.50,0.70,0.84,0.96,1.00] },
  { id: 82, name: "Bouvier des Flandres",       male: { min: 35, max: 40 }, female: { min: 27, max: 35 }, growth: [0.27,0.50,0.70,0.84,0.96,1.00] },
  { id: 83, name: "Briard",                     male: { min: 30, max: 45 }, female: { min: 25, max: 40 }, growth: [0.28,0.52,0.72,0.86,0.97,1.00] },
  { id: 84, name: "Brittany",                   male: { min: 14, max: 20 }, female: { min: 14, max: 20 }, growth: [0.33,0.60,0.80,0.92,0.99,1.00] },
  { id: 85, name: "Cane Corso",                 male: { min: 45, max: 55 }, female: { min: 40, max: 45 }, growth: [0.25,0.48,0.68,0.82,0.95,1.00] },
  { id: 86, name: "Cardigan Welsh Corgi",       male: { min: 14, max: 17 }, female: { min: 11, max: 15 }, growth: [0.35,0.62,0.82,0.93,0.99,1.00] },
  { id: 87, name: "Chesapeake Bay Retriever",   male: { min: 29, max: 36 }, female: { min: 25, max: 32 }, growth: [0.28,0.52,0.72,0.86,0.97,1.00] },
  { id: 88, name: "Chinese Shar-Pei",           male: { min: 18, max: 25 }, female: { min: 18, max: 25 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 89, name: "Curly-Coated Retriever",     male: { min: 32, max: 41 }, female: { min: 27, max: 36 }, growth: [0.28,0.52,0.72,0.86,0.97,1.00] },
  { id: 90, name: "Eurasier",                   male: { min: 23, max: 32 }, female: { min: 18, max: 26 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 91, name: "Finnish Spitz",              male: { min: 14, max: 16 }, female: { min: 10, max: 13 }, growth: [0.35,0.62,0.82,0.93,0.99,1.00] },
  { id: 92, name: "Irish Terrier",              male: { min: 12, max: 12 }, female: { min: 11, max: 11 }, growth: [0.35,0.62,0.82,0.93,0.99,1.00] },
  { id: 93, name: "Komondor",                   male: { min: 50, max: 60 }, female: { min: 36, max: 50 }, growth: [0.25,0.48,0.68,0.82,0.95,1.00] },
  { id: 94, name: "Kuvasz",                     male: { min: 52, max: 62 }, female: { min: 37, max: 50 }, growth: [0.25,0.48,0.68,0.82,0.95,1.00] },
  { id: 95, name: "Miniature Bull Terrier",     male: { min: 11, max: 15 }, female: { min: 11, max: 15 }, growth: [0.38,0.65,0.84,0.94,0.99,1.00] },
  { id: 96, name: "Nova Scotia Duck Tolling Retriever", male: { min: 20, max: 23 }, female: { min: 17, max: 20 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 97, name: "Plott",                      male: { min: 22, max: 27 }, female: { min: 18, max: 22 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] },
  { id: 98, name: "Polish Lowland Sheepdog",    male: { min: 14, max: 16 }, female: { min: 14, max: 16 }, growth: [0.33,0.60,0.80,0.92,0.99,1.00] },
  { id: 99, name: "Xoloitzcuintli (Standard)",  male: { min: 11, max: 18 }, female: { min: 11, max: 18 }, growth: [0.33,0.60,0.80,0.92,0.99,1.00] },
  { id: 100, name: "Mixed Breed / Other",       male: { min: 10, max: 30 }, female: { min: 8,  max: 28 }, growth: [0.30,0.55,0.75,0.88,0.97,1.00] }
]

// Growth curve ages in months
export const GROWTH_AGES = [3, 6, 9, 12, 18, 24]

/**
 * Returns the ideal weight range for a dog at a given age in months.
 * Uses linear interpolation between growth curve points.
 */
export function getIdealWeightAtAge(breed, sex, ageMonths) {
  const sexData = sex === 'female' ? breed.female : breed.male
  const adultMin = sexData.min
  const adultMax = sexData.max
  const { growth } = breed

  // For adults (>= 24 months), return full adult weight
  if (ageMonths >= 24) {
    return { min: adultMin, max: adultMax }
  }
  if (ageMonths <= 0) {
    return { min: adultMin * growth[0], max: adultMax * growth[0] }
  }

  // Find surrounding growth points and interpolate
  for (let i = 0; i < GROWTH_AGES.length - 1; i++) {
    const a0 = GROWTH_AGES[i], a1 = GROWTH_AGES[i + 1]
    if (ageMonths >= a0 && ageMonths <= a1) {
      const t = (ageMonths - a0) / (a1 - a0)
      const f = growth[i] + t * (growth[i + 1] - growth[i])
      return { min: +(adultMin * f).toFixed(2), max: +(adultMax * f).toFixed(2) }
    }
  }

  // Below first point
  const f = growth[0] * (ageMonths / GROWTH_AGES[0])
  return { min: +(adultMin * f).toFixed(2), max: +(adultMax * f).toFixed(2) }
}

export function getBreedById(id) {
  return breeds.find(b => b.id === id)
}

export function getBreedByName(name) {
  return breeds.find(b => b.name.toLowerCase() === name.toLowerCase())
}
