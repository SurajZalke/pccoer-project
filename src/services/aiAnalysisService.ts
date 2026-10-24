import { callAIAPI } from '@/services/aiProviderManager';
import { getDatabase, ref, get } from 'firebase/database';
import { app } from '@/lib/firebaseConfig';

export interface PerformanceData {
  studentName: string;
  rollNo: string;
  quizTitle: string;
  subject: string;
  score: number;
  totalMarks: number;
  accuracy: number;
  timestamp: string;
}

export const analyzeStudentPerformance = async (studentData: PerformanceData[]): Promise<string> => {
  if (studentData.length === 0) {
    return "No performance data available for analysis.";
  }

  const performanceSummary = studentData.map(d => 
    `Student: ${d.studentName} (Roll: ${d.rollNo}), Quiz: ${d.quizTitle}, Subject: ${d.subject}, Score: ${d.score}/${d.totalMarks}, Accuracy: ${d.accuracy}%`
  ).join('\n');

  const prompt = `As an educational AI analyst, provide a comprehensive performance analysis based on the following student quiz results. 

Analyze the data:
1. Subject-wise performance: Which subjects are students excelling in, and where are they struggling?
2. Test-wise performance: Are there specific tests that were particularly difficult or easy?
3. Individual insights: Identify top performers and students who may need extra support.
4. Actionable recommendations for the administrator.

Data:
${performanceSummary}

Provide a structured analysis with clear headings. Use professional yet encouraging tone.`;

  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await callAIAPI(prompt, 'auto');
      console.log(`✓ Performance analysis generated using ${response.provider}`);
      return response.text;
    } catch (err: any) {
      console.error(`Attempt ${attempt + 1} failed:`, err.message);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error('All AI providers exhausted for performance analysis.');
};

export const fetchAllStudentResults = async (adminUid: string): Promise<PerformanceData[]> => {
  const db = getDatabase(app);
  const sharedResultsRef = ref(db, 'sharedQuizResults');
  const snapshot = await get(sharedResultsRef);
  
  const allResults: PerformanceData[] = [];
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    for (const quizId in data) {
      const quizInfo = data[quizId];
      if (quizInfo.createdBy === adminUid) {
        const players = quizInfo.players || {};
        for (const playerId in players) {
          const p = players[playerId];
          allResults.push({
            studentName: p.nickname || 'Unknown',
            rollNo: p.rollNo || 'N/A',
            quizTitle: quizInfo.quizTitle || 'Untitled Quiz',
            subject: quizInfo.subject || 'General',
            score: p.score || 0,
            totalMarks: p.totalQuestions || 0, // Assuming totalQuestions as proxy for marks if not specified
            accuracy: p.accuracy || 0,
            timestamp: p.timestamp || ''
          });
        }
      }
    }
  }
  
  return allResults;
};
