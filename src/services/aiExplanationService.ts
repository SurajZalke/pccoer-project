// src/services/aiExplanationService.ts
import { Question, PlayerAnswer } from '@/types';
import { callAIAPI, getAPIStats } from '@/services/aiProviderManager';

/* ------------------------------------------------------------------ */
/* Type Definitions */
export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  text: string;
  imageUrl?: string;
  imageFile?: File | null;
  publicId?: string;
  options: QuizOption[];
  correctOption: string;
  timeLimit: number;
  Marks: number;
  explanation?: string;
}

export interface QuestionForExplanation {
  id: string;
  text: string;
}

/* ───────────────────────── Generate Quiz Explanations ────────────────────────── */
// Cache for explanations to avoid redundant API calls
const explanationCache: Record<string, string> = {};

export const generateQuizExplanations = async (questions: QuestionForExplanation[]): Promise<Record<string, string>> => {
  if (questions.length === 0) {
    return {};
  }

  // Filter out questions that are already in the cache
  const uncachedQuestions = questions.filter(q => !explanationCache[q.id]);
  
  // If all questions are cached, return from cache immediately
  if (uncachedQuestions.length === 0) {
    const cachedResults: Record<string, string> = {};
    questions.forEach(q => {
      cachedResults[q.id] = explanationCache[q.id];
    });
    return cachedResults;
  }
  
  // Process questions in smaller batches to improve reliability
  const BATCH_SIZE = 5;
  const allExplanations: Record<string, string> = {};
  
  // Add cached explanations to the result
  questions.forEach(q => {
    if (explanationCache[q.id]) {
      allExplanations[q.id] = explanationCache[q.id];
    }
  });
  
  // Process uncached questions in batches
  for (let i = 0; i < uncachedQuestions.length; i += BATCH_SIZE) {
    const batchQuestions = uncachedQuestions.slice(i, i + BATCH_SIZE);
    const batchExplanations = await generateExplanationBatch(batchQuestions);
    
    // Add to results and update cache
    Object.entries(batchExplanations).forEach(([id, explanation]) => {
      allExplanations[id] = explanation;
      explanationCache[id] = explanation; // Update cache
    });
    
    // Add a small delay between batches
    if (i + BATCH_SIZE < uncachedQuestions.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return allExplanations;
};

// Helper function to generate explanations for a batch of questions
async function generateExplanationBatch(questions: QuestionForExplanation[]): Promise<Record<string, string>> {
  const questionList = questions.map(q => `ID: ${q.id}\nQuestion: ${q.text}`).join('\n\n');

  const prompt = `Generate detailed explanations for the following questions. Provide a clear, educational explanation for each question, between 2-4 sentences.

Format your response as a JSON object where keys are the question IDs and values are their explanations. Ensure your response is ONLY the JSON object with no additional text.

Questions:
${questionList}

Example JSON format:
{
  "question_id_1": "Explanation for question 1.",
  "question_id_2": "Explanation for question 2."
}`; 

  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await callAIAPI(prompt, 'auto');
      const responseText = response.text.trim();

      try {
        // Attempt to extract JSON from the response, handling markdown code blocks
        let jsonString = responseText;
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonString = jsonMatch[1];
        } else {
          // If not wrapped in markdown, try to find the first { and last } to extract the JSON
          const firstBrace = jsonString.indexOf('{');
          const lastBrace = jsonString.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonString = jsonString.substring(firstBrace, lastBrace + 1);
          } else {
            // Fallback to original cleanup if braces not found or invalid
            jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
          }
        }

        const explanations = JSON.parse(jsonString);
        if (typeof explanations === 'object' && explanations !== null) {
          console.log(`✓ Batch explanations generated using ${response.provider}`);
          return explanations; // ✅ success
        } else {
          throw new Error('Invalid JSON format received from AI');
        }
      } catch (parseErr) {
        console.error('Failed to parse AI response as JSON:', parseErr);
        throw new Error('Failed to parse AI response as valid explanation format');
      }
    } catch (err: any) {
      console.error(`Attempt ${attempt + 1} failed:`, err.message);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  }

  throw new Error('All AI providers exhausted for quiz explanation generation. Please try again later.');
}
/* ------------------------------------------------------------------ */

/* ---------- Multiple API keys for automatic fail‑over ------------ */
// Removed - now handled by aiProviderManager.ts

/* ───────────────────────── Generate MCQs ────────────────────────── */
export const generateSingleExplanation = async (question: string): Promise<string> => {
  // Check cache first using the question as key
  const cacheKey = `question_${question.trim().toLowerCase().replace(/\s+/g, '_').substring(0, 50)}`;
  if (explanationCache[cacheKey]) {
    console.log('Using cached explanation');
    return explanationCache[cacheKey];
  }
  
  const prompt = `Generate a detailed explanation for the following question: "${question}"

Provide a clear, educational explanation that would help someone understand the concept. Keep the explanation between 2-4 sentences.

Format your response as plain text with no additional formatting or prefixes.`;

  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await callAIAPI(prompt, 'auto');
      const explanation = response.text.trim();
      
      if (explanation) {
        // Store in cache before returning
        explanationCache[cacheKey] = explanation;
        console.log(`✓ Explanation generated using ${response.provider}`);
        return explanation; // ✅ success
      } else {
        throw new Error('Empty explanation received from AI');
      }
    } catch (err: any) {
      console.error(`Attempt ${attempt + 1} failed:`, err.message);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error('All AI providers exhausted for explanation generation. Please try again later.');
};

export const generateExplanation = async (
questionText: string, numQuestions: number = 5): Promise<QuizQuestion[]> => {
  // For large numbers of questions, we'll make multiple API calls with smaller batches
  const MAX_QUESTIONS_PER_BATCH = 10; // Limit each API call to 10 questions for better reliability
  const MAX_BATCHES = 10; // Safety limit to prevent excessive API calls
  
  // Ensure we don't exceed reasonable limits
  const adjustedNumQuestions = Math.min(numQuestions, 100); // Cap at 100 questions max
  const batches = Math.min(Math.ceil(adjustedNumQuestions / MAX_QUESTIONS_PER_BATCH), MAX_BATCHES);
  let allQuestions: QuizQuestion[] = [];
  
  for (let batch = 0; batch < batches; batch++) {
    const questionsInBatch = Math.min(MAX_QUESTIONS_PER_BATCH, adjustedNumQuestions - (batch * MAX_QUESTIONS_PER_BATCH));
    if (questionsInBatch <= 0) break;
    
    const prompt = `Generate ${questionsInBatch} unique multiple-choice questions about the topic: "${questionText}". 

For each question:
1. Provide the question text
2. Provide 4 options labeled as a, b, c, and d
3. Indicate which option is correct
4. Include a brief explanation of why the correct answer is right

Format your response as a valid JSON array with this structure:
[
  {
    "text": "Question text here",
    "options": [
      { "id": "a", "text": "Option A text" },
      { "id": "b", "text": "Option B text" },
      { "id": "c", "text": "Option C text" },
      { "id": "d", "text": "Option D text" }
    ],
    "correctOption": "a",
    "explanation": "Explanation text here"
  },
  {...more questions...}
]

Ensure your response is ONLY the JSON array with no additional text.${batch > 0 ? ` Make sure these questions are different from previous batches.` : ''}`;

    const MAX_RETRIES = 3;
    let batchQuestions: QuizQuestion[] = [];
    let success = false;
    
    for (let attempt = 0; attempt < MAX_RETRIES && !success; attempt++) {
      try {
        const response = await callAIAPI(prompt, 'auto');
        const responseText = response.text;
        
        // Try to parse the response as JSON
        try {
          // Extract JSON if it's wrapped in markdown code blocks or has extra text
          const jsonMatch = responseText.match(/\[\s*\{.*\}\s*\]/s);
          const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
          const questions = JSON.parse(jsonStr);
          
          if (Array.isArray(questions) && questions.length > 0) {
            // Validate each question has required fields
            const validQuestions = questions.filter(q => {
              return q && q.text && Array.isArray(q.options) && 
                     q.options.length > 0 && q.correctOption && 
                     q.options.some(opt => opt && opt.id && opt.text);
            });
            
            if (validQuestions.length > 0) {
              batchQuestions = validQuestions;
              success = true;
              console.log(`✓ Batch ${batch + 1} generated using ${response.provider}`);
            } else {
              throw new Error('No valid questions in AI response');
            }
          } else {
            throw new Error('Invalid response format from AI');
          }
        } catch (parseErr) {
          console.error('Failed to parse AI response as JSON:', parseErr);
          throw new Error('Failed to parse AI response as valid question format');
        }
      } catch (err: any) {
        console.error(`Batch ${batch + 1}, Attempt ${attempt + 1} failed:`, err.message);
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }
    
    if (!success) {
      throw new Error('AI model is currently overloaded or all providers exhausted. Please try again later.');
    }
    
    // Add the batch questions to our collection
    allQuestions = [...allQuestions, ...batchQuestions];
    
    // If we're making multiple batches, add a small delay to avoid rate limiting
    if (batches > 1 && batch < batches - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  if (allQuestions.length === 0) {
    throw new Error('Failed to generate any questions. Please try again later.');
  }
  
  return allQuestions;
};

/* ───────────────────────── Generate Explanation ────────────────────────── */
// The generateSingleExplanation function is now defined above

/* ───────────────────── Player Accuracy Helper ───────────────────── */
export const calculateCorrectAnswerRate = (answers: PlayerAnswer[]): number => {
  if (!answers?.length) return 100;
  const correct = answers.filter(a => a.correct).length;
  return (correct / answers.length) * 100;
};

/* ─────────────────────── AI Explanation Block ───────────────────── */
export const generateAIExplanation = async (
  question: Question,
  selectedOption: string
): Promise<string> => {
  const correctOpt = question.options.find(o => o.id === question.correctOption);
  const chosenOpt  = question.options.find(o => o.id === selectedOption);

  if (!correctOpt) {
    return "Sorry, I couldn't generate an explanation for this question.";
  }
  
  // Check if we already have an explanation for this question in the cache
  // If the question already has an explanation, use it instead of generating a new one
  if (question.explanation && question.explanation.trim() !== '') {
    return formatExplanationHTML(question, selectedOption, correctOpt, chosenOpt, question.explanation);
  }
  
  // Create a cache key based on the question text and correct option
  const cacheKey = `ai_explanation_${question.text.trim().toLowerCase().replace(/\s+/g, '_').substring(0, 50)}_${correctOpt.id}`;
  if (explanationCache[cacheKey]) {
    console.log('Using cached AI explanation');
    return formatExplanationHTML(question, selectedOption, correctOpt, chosenOpt, explanationCache[cacheKey]);
  }

  const prompt = `Given the following quiz question and options, provide a concise and accurate explanation.

Question: ${question.text}
Correct Answer: ${correctOpt.text} (${correctOpt.id.toUpperCase()})
Selected Answer: ${chosenOpt?.text || selectedOption} (${selectedOption.toUpperCase()})

Provide a single, unified, and concise explanation. This explanation should:
1. Briefly state the core concept or principle related to the correct answer (1‑2 sentences).
2. Explain why the selected answer is wrong (if applicable).
3. Explain why the correct answer is right.
Do not add any introduction or conclusion.`;

  const MAX_RETRIES = 3;
  let explanation = '';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await callAIAPI(prompt, 'auto');
      explanation = response.text;
      
      // Store in cache
      explanationCache[cacheKey] = explanation;
      console.log(`✓ AI explanation generated using ${response.provider}`);
      break; // ✅ success
    } catch (err: any) {
      console.error(`Attempt ${attempt + 1} failed:`, err.message);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  if (!explanation) {
    explanation =
      'Failed to get a detailed explanation from AI. All providers exhausted. Please try again later.';
  }

  return formatExplanationHTML(question, selectedOption, correctOpt, chosenOpt, explanation);
};

// Helper function to format the explanation HTML
function formatExplanationHTML(
  question: Question,
  selectedOption: string,
  correctOpt: any,
  chosenOpt: any,
  explanation: string
): string {
  return `
<div class="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg mt-4 border border-blue-200 dark:border-blue-800">
  <h3 class="text-lg font-bold mb-2 text-blue-700 dark:text-blue-300">AI Explanation</h3>
  <p class="mb-3">Let me explain this question step by step:</p>
  <p><strong>Question:</strong> ${question.text}</p>
  <p><strong>Your answer:</strong> ${chosenOpt?.text || selectedOption} ${selectedOption !== question.correctOption ? '(incorrect)' : ''}</p>
  <p><strong>Correct answer:</strong> ${correctOpt.text}</p>
  <p><strong>Explanation:</strong></p>
  <p>${explanation.replace(/\n/g, '<br/>')}</p>
  <p class="text-xs text-blue-500 dark:text-blue-400 mt-4">
    This explanation was generated by AI to help you understand the concept better.
  </p>
</div>`;
}
