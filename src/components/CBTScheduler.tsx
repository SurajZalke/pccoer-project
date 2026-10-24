import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { scheduleTest, getScheduledTests, deleteScheduledTest } from '@/services/firebaseService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { PlusCircle, Globe, Calendar, Clock, Trash2, Check, Eye, X } from 'lucide-react';
import { ScheduledTest, Quiz } from '@/types';
import { getDatabase, ref, get } from 'firebase/database';
import { app } from '@/lib/firebaseConfig';
import { ADMIN_UID } from './StudentManagement';
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface CBTSchedulerProps {
  quizzes: Quiz[];
}

interface TestResult {
  nickname: string;
  rollNo: string;
  classId: string;
  score: number;
  totalQuestions: number;
  timestamp: string;
}

const CBTScheduler: React.FC<CBTSchedulerProps> = ({ quizzes }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [tests, setTests] = useState<ScheduledTest[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResultsLoading, setIsResultsLoading] = useState(false);
  const [selectedTestResults, setSelectedTestResults] = useState<TestResult[]>([]);
  const [isResultsDialogOpen, setIsResultsDialogOpen] = useState(false);
  const [activeResultsTestTitle, setActiveResultsTestTitle] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState(30);

  // Auto-update endTime when startTime or duration changes
  useEffect(() => {
    if (startTime && duration) {
      const start = new Date(startTime);
      const end = new Date(start.getTime() + duration * 60000);
      
      // Format to YYYY-MM-DDTHH:MM for datetime-local
      const year = end.getFullYear();
      const month = String(end.getMonth() + 1).padStart(2, '0');
      const day = String(end.getDate()).padStart(2, '0');
      const hours = String(end.getHours()).padStart(2, '0');
      const minutes = String(end.getMinutes()).padStart(2, '0');
      
      setEndTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    }
  }, [startTime, duration]);

  const [amount, setAmount] = useState(10);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [type, setType] = useState<'multiple' | 'boolean'>('multiple');
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);

  const isAdmin = currentUser && currentUser.uid === ADMIN_UID;

  useEffect(() => {
    fetchTests();
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const db = getDatabase(app);
      const classesRef = ref(db, 'classes');
      const snapshot = await get(classesRef);
      if (snapshot.exists()) {
        const classesData = snapshot.val();
        const classes = Object.keys(classesData).filter(cls => cls.trim() !== "");
        setAvailableClasses(classes);
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  const fetchTests = async () => {
    setIsLoading(true);
    const result = await getScheduledTests();
    if (result.success) {
      setTests(result.tests);
    }
    setIsLoading(false);
  };

  const fetchResults = async (testId: string, testTitle: string) => {
    setIsResultsLoading(true);
    setActiveResultsTestTitle(testTitle);
    try {
      const db = getDatabase(app);
      const resultsRef = ref(db, `sharedQuizResults/${testId}/players`);
      const snapshot = await get(resultsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const results = Object.values(data) as TestResult[];
        // Sort by score descending
        results.sort((a, b) => b.score - a.score);
        setSelectedTestResults(results);
      } else {
        setSelectedTestResults([]);
        toast({
          title: "No Results",
          description: "No students have attempted this test yet.",
        });
      }
      setIsResultsDialogOpen(true);
    } catch (error) {
      console.error("Error fetching results:", error);
      toast({
        title: "Error",
        description: "Failed to fetch test results.",
        variant: "destructive"
      });
    } finally {
      setIsResultsLoading(false);
    }
  };

  const toggleClass = (cls: string) => {
    setSelectedClassIds(prev => 
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    );
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!title || selectedClassIds.length === 0 || !startTime || !endTime) {
      toast({ title: 'Error', description: 'Please fill all fields and select at least one class', variant: 'destructive' });
      return;
    }

    let testData: Partial<ScheduledTest>;

    if (selectedQuizId) {
      const selectedQuiz = quizzes.find(q => q.id === selectedQuizId);
      if (!selectedQuiz) {
        toast({ title: 'Error', description: 'Selected quiz not found', variant: 'destructive' });
        return;
      }
      testData = {
        title: selectedQuiz.title, // Use selected quiz's title
        classId: selectedClassIds[0], // Keep for backward compatibility if needed
        classIds: selectedClassIds,
        startTime,
        endTime,
        duration,
        quizId: selectedQuizId, // Reference the existing quiz
        createdBy: currentUser.uid
      };
    } else {
      testData = {
        title,
        classId: selectedClassIds[0], // Keep for backward compatibility
        classIds: selectedClassIds,
        startTime,
        endTime,
        duration,
        cbtParams: {
          amount,
          difficulty,
          type
        },
        createdBy: currentUser.uid
      };
    }

    const result = await scheduleTest(testData);
    if (result.success) {
      toast({ title: 'Success', description: 'Test scheduled successfully' });
      resetForm();
      fetchTests();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this scheduled test?')) return;
    const result = await deleteScheduledTest(id);
    if (result.success) {
      toast({ title: 'Success', description: 'Scheduled test deleted' });
      fetchTests();
    }
  };

  const resetForm = () => {
    setTitle('');
    setSelectedClassIds([]);
    setStartTime('');
    setEndTime('');
    setDuration(30);
    setAmount(10);
    setDifficulty('medium');
    setType('multiple');
  };

  if (!isAdmin) return <div className="p-8 text-white">Access Denied</div>;

  return (
    <div className="space-y-8 p-4">
      <Dialog open={isResultsDialogOpen} onOpenChange={setIsResultsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-gray-900 text-white border-white/20">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center justify-between">
              <span>Results: {activeResultsTestTitle}</span>
              <Button variant="ghost" size="icon" onClick={() => setIsResultsDialogOpen(false)} className="text-white hover:bg-white/10">
                <X className="w-5 h-5" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {isResultsLoading ? (
            <div className="py-10 text-center">Loading results...</div>
          ) : selectedTestResults.length > 0 ? (
            <div className="mt-4">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/10">
                    <TableHead className="text-purple-300 font-bold">Rank</TableHead>
                    <TableHead className="text-purple-300 font-bold">Name</TableHead>
                    <TableHead className="text-purple-300 font-bold">Roll No</TableHead>
                    <TableHead className="text-purple-300 font-bold">Class</TableHead>
                    <TableHead className="text-purple-300 font-bold">Score</TableHead>
                    <TableHead className="text-purple-300 font-bold">Accuracy</TableHead>
                    <TableHead className="text-purple-300 font-bold">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedTestResults.map((result, index) => (
                    <TableRow key={index} className="border-white/5 hover:bg-white/5 transition-colors">
                      <TableCell className="font-medium">
                        <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                          index === 0 ? 'bg-yellow-500 text-black font-bold' : 
                          index === 1 ? 'bg-gray-300 text-black font-bold' : 
                          index === 2 ? 'bg-amber-600 text-white font-bold' : 
                          'bg-white/10 text-white'
                        }`}>
                          {index + 1}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold">{result.nickname}</TableCell>
                      <TableCell className="text-white/70">{result.rollNo}</TableCell>
                      <TableCell className="text-white/70">{result.classId}</TableCell>
                      <TableCell className="font-bold text-green-400">
                        {result.score} / {result.totalQuestions}
                      </TableCell>
                      <TableCell className="text-blue-300">
                        {Math.round((result.score / result.totalQuestions) * 100)}%
                      </TableCell>
                      <TableCell className="text-white/50 text-xs">
                        {new Date(result.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-10 text-center text-white/50 italic">No attempts found for this test.</div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="text-green-400" /> Schedule New CBT Test
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSchedule} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Test Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Weekly Physics Quiz" className="bg-white/20 border-white/30 text-white" />
              </div>
              <div className="space-y-2">
                <Label>Select Existing Quiz (Optional)</Label>
                <Select value={selectedQuizId || 'none'} onValueChange={(v) => setSelectedQuizId(v === 'none' ? null : v)}>
                  <SelectTrigger className="bg-white/20 border-white/30 text-white">
                    <SelectValue placeholder="Select a Quiz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None (Use CBT API) --</SelectItem>
                    {quizzes.filter(q => q.id && q.id.trim() !== "").map(quiz => (
                      <SelectItem key={quiz.id} value={quiz.id}>{quiz.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-purple-300 font-semibold">Select Classes (Multiple)</Label>
                <div className="grid grid-cols-2 gap-3 bg-black/20 p-3 rounded-lg border border-white/10 max-h-40 overflow-y-auto">
                  {availableClasses.map(cls => (
                    <div key={cls} className="flex items-center space-x-2 bg-white/5 p-2 rounded hover:bg-white/10 transition-colors">
                      <Checkbox 
                        id={`class-${cls}`} 
                        checked={selectedClassIds.includes(cls)}
                        onCheckedChange={() => toggleClass(cls)}
                        className="border-white/50 data-[state=checked]:bg-purple-500"
                      />
                      <label htmlFor={`class-${cls}`} className="text-sm font-medium leading-none cursor-pointer select-none truncate">
                        {cls}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-blue-400" /> Start Time
                  </Label>
                  <div className="relative">
                    <Input 
                      type="datetime-local" 
                      value={startTime} 
                      onChange={e => setStartTime(e.target.value)} 
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className="bg-white/20 border-white/30 text-white cursor-pointer pr-10" 
                    />
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-red-400" /> End Time
                  </Label>
                  <div className="relative">
                    <Input 
                      type="datetime-local" 
                      value={endTime} 
                      onChange={e => setEndTime(e.target.value)} 
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className="bg-white/20 border-white/30 text-white cursor-pointer pr-10" 
                    />
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Duration (Minutes)</Label>
                <Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="bg-white/20 border-white/30 text-white" />
              </div>
            </div>

            <div className="space-y-4 bg-black/20 p-4 rounded-lg border border-white/10">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-purple-300">
                <Globe className="w-4 h-4" /> CBT API Configuration
              </h3>
              <div className="space-y-2">
                <Label>Number of Questions</Label>
                <Input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="bg-white/20 border-white/30 text-white" disabled={!!selectedQuizId} />
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)} disabled={!!selectedQuizId}>
                  <SelectTrigger className="bg-white/20 border-white/30 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)} disabled={!!selectedQuizId}>
                  <SelectTrigger className="bg-white/20 border-white/30 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple">Multiple Choice</SelectItem>
                    <SelectItem value="boolean">True/False</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" className="md:col-span-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
              Schedule Test
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Calendar className="text-blue-400" /> Currently Scheduled Tests
        </h2>
        {isLoading ? (
          <div className="text-white">Loading tests...</div>
        ) : tests.length === 0 ? (
          <div className="text-white/60">No tests scheduled</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tests.map(test => (
              <Card key={test.id} className="bg-white/5 border-white/10 text-white hover:bg-white/10 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg text-purple-300">{test.title}</h3>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => fetchResults(test.id, test.title)} className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(test.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm space-y-1 text-white/80">
                    <p className="flex items-center gap-2">
                      <PlusCircle className="w-3 h-3" /> 
                      Class: {Array.isArray(test.classIds) ? test.classIds.join(', ') : test.classId}
                    </p>
                    <p className="flex items-center gap-2"><Clock className="w-3 h-3" /> Duration: {test.duration} mins</p>
                    <p className="flex items-center gap-2 text-xs text-blue-300">
                      <Calendar className="w-3 h-3" /> 
                      {new Date(test.startTime).toLocaleString()} - {new Date(test.endTime).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-white/10 flex gap-2">
                    <span className="text-[10px] bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
                      {test.quizId ? 'Fixed Quiz' : `${test.cbtParams?.amount || 0} Qs`}
                    </span>
                    <span className="text-[10px] bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-500/30 capitalized">
                      {test.quizId ? 'N/A' : (test.cbtParams?.difficulty || 'medium')}
                    </span>
                    <Button 
                      variant="link" 
                      className="text-[10px] h-auto p-0 ml-auto text-purple-400 hover:text-purple-300"
                      onClick={() => fetchResults(test.id, test.title)}
                    >
                      View Scores
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CBTScheduler;
