import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllStudentResults, analyzeStudentPerformance, PerformanceData } from '@/services/aiAnalysisService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, BarChart2, BookOpen, UserCheck, Download, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ADMIN_UID } from '@/components/StudentManagement';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PdfDownloadOverlay from '@/components/PdfDownloadOverlay';

interface StudentAIAnalysisProps {
  specificResults?: PerformanceData[];
  onClearSpecific?: () => void;
}

const StudentAIAnalysis: React.FC<StudentAIAnalysisProps> = ({ specificResults, onClearSpecific }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<PerformanceData[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const isAdmin = currentUser && currentUser.uid === ADMIN_UID;

  useEffect(() => {
    if (isAdmin) {
      if (specificResults && specificResults.length > 0) {
        setResults(specificResults);
        setAnalysis(null); // Reset analysis when new specific data comes in
      } else {
        loadResults();
      }
    }
  }, [currentUser, specificResults]);

  const loadResults = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const data = await fetchAllStudentResults(currentUser.uid);
      setResults(data);
    } catch (error) {
      console.error('Error loading results:', error);
      toast({
        title: 'Error',
        description: 'Failed to load student results.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (results.length === 0) {
      toast({
        title: 'No Data',
        description: 'No student results found to analyze.',
      });
      return;
    }

    setAnalyzing(true);
    try {
      const aiAnalysis = await analyzeStudentPerformance(results);
      setAnalysis(aiAnalysis);
      toast({
        title: 'Analysis Complete',
        description: 'AI has successfully analyzed student performance.',
      });
    } catch (error) {
      console.error('Error running AI analysis:', error);
      toast({
        title: 'Analysis Failed',
        description: 'Failed to generate AI analysis. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const downloadAnalysisPDF = () => {
    if (!analysis) return;

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PW = doc.internal.pageSize.getWidth();
      const PH = doc.internal.pageSize.getHeight();
      const M  = 14;
      const today = new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });

      const footer = (pageNum?: number) => {
        const totalPages = doc.getNumberOfPages();
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.line(M, PH - 10, PW - M, PH - 10);
        doc.text(
          'PCCOER Education Platform  ·  AI Performance Report  ·  Auto-generated',
          PW / 2, PH - 5.5, { align: 'center' }
        );
        doc.text(`Page ${pageNum ?? totalPages}`, PW - M, PH - 5.5, { align: 'right' });
        doc.text('Created by Mr. Suraj Zalke', M, PH - 5.5);
      };

      // ── Header band ─────────────────────────────────────────────────────
      doc.setFillColor(30, 27, 75); // indigo-900
      doc.rect(0, 0, PW, 30, 'F');

      try { doc.addImage('/msplogo.jpg', 'JPEG', M, 4, 20, 20); } catch (_) {}

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('PCCOER EDUCATION PLATFORM', PW / 2, 12, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(199, 210, 254);
      doc.text('AI Student Performance Report', PW / 2, 19, { align: 'center' });
      doc.text(`Generated: ${today}`, PW / 2, 25, { align: 'center' });

      // ── Summary stats ────────────────────────────────────────────────────
      let y = 38;
      autoTable(doc, {
        head: [['Metric', 'Value']],
        body: [
          ['Total Students',    new Set(results.map(r => r.rollNo)).size.toString()],
          ['Total Tests Taken', results.length.toString()],
          ['Subjects Covered',  new Set(results.map(r => r.subject)).size.toString()],
        ],
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 }, valign: 'middle' },
        headStyles: { fillColor: [30, 27, 75], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 9 },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [55, 65, 81] },
          1: { halign: 'center', textColor: [99, 102, 241], fontStyle: 'bold' },
        },
        margin: { left: M, right: M },
        didDrawPage: () => footer(),
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // ── AI Insights section heading ───────────────────────────────────────
      doc.setFillColor(30, 27, 75);
      doc.rect(M, y, PW - M * 2, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('AI INSIGHTS & DETAILED ANALYSIS', PW / 2, y + 5.5, { align: 'center' });
      y += 12;

      // ── Analysis text ─────────────────────────────────────────────────────
      // Strip markdown hash headers, trim whitespace
      const cleanedAnalysis = analysis
        .replace(/^#{1,6}\s*/gm, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .trim();

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(55, 65, 81);

      const lines = doc.splitTextToSize(cleanedAnalysis, PW - M * 2);
      for (const line of lines) {
        if (y > PH - 18) {
          footer();
          doc.addPage();
          // Re-draw a mini header on continuation pages
          doc.setFillColor(30, 27, 75);
          doc.rect(0, 0, PW, 12, 'F');
          doc.setTextColor(199, 210, 254);
          doc.setFontSize(8);
          doc.text('PCCOER Education Platform  ·  AI Analysis (cont.)', PW / 2, 8, { align: 'center' });
          y = 18;
          doc.setFontSize(9.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(55, 65, 81);
        }
        doc.text(line, M, y);
        y += 5.5;
      }

      // Final footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        footer(i);
      }

      const fileName = specificResults
        ? `AI_Analysis_${(results[0]?.quizTitle || 'Custom').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
        : 'AI_Performance_Analysis.pdf';
      doc.save(fileName);

      toast({
        title: 'PDF Downloaded',
        description: 'The AI performance report has been saved.',
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to generate the PDF report.',
        variant: 'destructive',
      });
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-white">
        <p>Access denied. This section is only for administrators.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <PdfDownloadOverlay visible={pdfLoading} label="Generating AI analysis PDF…" />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Sparkles className="mr-2 text-yellow-400" /> AI Student Performance Analysis
          </h2>
          {specificResults && (
            <p className="text-blue-300 text-sm mt-1 flex items-center gap-2">
              Analyzing Specific Test: {results[0]?.quizTitle || 'Custom Selection'}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClearSpecific}
                className="h-6 px-2 text-xs text-red-300 hover:text-red-400 hover:bg-red-900/20"
              >
                <Trash2 className="h-3 w-3 mr-1" /> Clear Selection
              </Button>
            </p>
          )}
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {analysis && (
            <Button
              onClick={async () => {
                setPdfLoading(true);
                try { downloadAnalysisPDF(); }
                finally { setTimeout(() => setPdfLoading(false), 400); }
              }}
              disabled={pdfLoading}
              className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white shadow-lg disabled:opacity-60"
            >
              {pdfLoading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
                : <><Download className="mr-2 h-4 w-4" /> Download PDF</>
              }
            </Button>
          )}
          <Button 
            onClick={handleRunAnalysis} 
            disabled={analyzing || loading || results.length === 0}
            className="flex-1 md:flex-none bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg"
          >
            {analyzing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
            ) : (
              <><BarChart2 className="mr-2 h-4 w-4" /> Run AI Analysis</>
            )}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-white" />
        </div>
      ) : results.length === 0 ? (
        <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white">
          <CardContent className="p-12 text-center">
            <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-xl">No student performance data found yet.</p>
            <p className="text-sm opacity-70 mt-2">Data will appear here once students complete shared quizzes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-blue-900/40 border-blue-500/30 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <UserCheck className="mr-2 h-4 w-4 text-blue-300" /> Total Students
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{new Set(results.map(r => r.rollNo)).size}</div>
              </CardContent>
            </Card>
            <Card className="bg-purple-900/40 border-purple-500/30 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <BarChart2 className="mr-2 h-4 w-4 text-purple-300" /> Total Tests Taken
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{results.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-indigo-900/40 border-indigo-500/30 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <BookOpen className="mr-2 h-4 w-4 text-indigo-300" /> Subjects Covered
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{new Set(results.map(r => r.subject)).size}</div>
              </CardContent>
            </Card>
          </div>

          {analysis && (
            <Card className="bg-white/10 backdrop-blur-lg border-white/20 text-white shadow-2xl animate-fadeIn">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="flex items-center text-xl">
                  <Sparkles className="mr-2 text-yellow-400" /> AI Insights & Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="prose prose-invert max-w-none">
                  {analysis.split('\n').map((line, i) => (
                    <p key={i} className={line.startsWith('#') ? 'text-xl font-bold mt-4 mb-2 text-cyan-300' : 'mb-2 text-gray-200'}>
                      {line.startsWith('#') ? line.replace(/^#+\s*/, '') : line}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!analysis && !analyzing && (
            <div className="text-center p-8 bg-black/20 rounded-xl border border-dashed border-white/20">
              <p className="text-white/70">Click "Run AI Analysis" to get deep insights into student performance.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentAIAnalysis;
