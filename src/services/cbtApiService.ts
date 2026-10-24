import { Question } from '@/types';

export interface CBTApiResponseQuestion {
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
  category?: string;
  type?: string;
  difficulty?: string;
}

export interface CBTApiResponse {
  response_code: number;
  results: CBTApiResponseQuestion[];
}

/**
 * Service to fetch questions from a CBT API.
 * Defaults to Open Trivia Database for demonstration, but can be configured for any API.
 */
export const fetchCBTQuestions = async (
  amount: number = 10,
  category?: number,
  difficulty?: 'easy' | 'medium' | 'hard',
  type: 'multiple' | 'boolean' = 'multiple'
): Promise<any[]> => {
  try {
    let url = `https://opentdb.com/api.php?amount=${amount}&type=${type}`;
    if (category) url += `&category=${category}`;
    if (difficulty) url += `&difficulty=${difficulty}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch from CBT API');
    }

    const data: CBTApiResponse = await response.json();
    
    if (data.response_code !== 0) {
      throw new Error(`CBT API returned error code: ${data.response_code}`);
    }

    return data.results.map((q, index) => {
      // Shuffle options
      const options = [
        q.correct_answer,
        ...q.incorrect_answers
      ].sort(() => Math.random() - 0.5);

      const optionLetters = ['a', 'b', 'c', 'd'];
      const formattedOptions = options.slice(0, 4).map((opt, i) => ({
        id: optionLetters[i],
        text: decodeHtml(opt)
      }));

      const correctOptionId = formattedOptions.find(o => o.text === decodeHtml(q.correct_answer))?.id || 'a';

      return {
        id: `cbt_${Date.now()}_${index}`,
        text: decodeHtml(q.question),
        options: formattedOptions,
        correctOption: correctOptionId,
        timeLimit: 30,
        Marks: 4,
        explanation: `Category: ${q.category}, Difficulty: ${q.difficulty}`
      };
    });
  } catch (error) {
    console.error('Error in fetchCBTQuestions:', error);
    throw error;
  }
};

// Helper to decode HTML entities from API response
function decodeHtml(html: string) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}
