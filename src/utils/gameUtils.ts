
// Generate a random game code
export const generateGameCode = (): string => {
  // Create a 6-character alphanumeric code
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// Generate a unique player ID
export const generatePlayerId = (): string => {
  return 'player_' + Math.random().toString(36).substring(2, 9);
};

// Mock function to validate game code
export const isValidGameCode = (code: string): boolean => {
  // In a real app, this would check against active game sessions
  return code.length === 6;
};

// Science stream subjects
export const scienceSubjects = [
  {
    id: "physics",
    name: "Physics",
    topics: [
      { id: "mechanics", name: "Mechanics", quizCount: 12 },
      { id: "electricity", name: "Electricity & Magnetism", quizCount: 10 },
      { id: "optics", name: "Optics", quizCount: 10 },
      { id: "modern_physics", name: "Modern Physics", quizCount: 14 },
      { id: "thermodynamics", name: "Thermodynamics", quizCount: 10 },
    ]
  },
  {
    id: "chemistry",
    name: "Chemistry",
    topics: [
      { id: "organic", name: "Organic Chemistry", quizCount: 15 },
      { id: "inorganic", name: "Inorganic Chemistry", quizCount: 12 },
      { id: "physical", name: "Physical Chemistry", quizCount: 11 },
      { id: "analytical", name: "Analytical Chemistry", quizCount: 10 },
    ]
  },
  {
    id: "biology",
    name: "Biology",
    topics: [
      { id: "botany", name: "Botany", quizCount: 14 },
      { id: "zoology", name: "Zoology", quizCount: 16 },
      { id: "human_physiology", name: "Human Physiology", quizCount: 12 },
      { id: "genetics", name: "Genetics", quizCount: 10 },
      { id: "ecology", name: "Ecology", quizCount: 10 },
    ]
  },
  {
    id: "mathematics",
    name: "Mathematics",
    topics: [
      { id: "algebra", name: "Algebra", quizCount: 15 },
      { id: "calculus", name: "Calculus", quizCount: 14 },
      { id: "trigonometry", name: "Trigonometry", quizCount: 10 },
      { id: "coordinate", name: "Coordinate Geometry", quizCount: 12 },
      { id: "statistics", name: "Statistics & Probability", quizCount: 10 },
    ]
  },
  {
    id: "Marathi",
    name: "मराठी",
  },
  {
    id: "English",
    name: "English",
  },
];

export const gameUtils = {
  gradeLevels: [
    'Grade 11',
    'Grade 12',
  ],
};

export const sampleQuizzes = [];
