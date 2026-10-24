import React, { useState } from 'react';
import { PDFDownloadLink, BlobProvider } from '@react-pdf/renderer';
import { GameResultsDocument, GameResultsPDFProps } from './GameResultsPDF';
import { Button } from '@/components/ui/button';
import { Share2, Download, Loader2 } from 'lucide-react';
import PdfDownloadOverlay from './PdfDownloadOverlay';

interface SharedQuizResultsActionsProps extends GameResultsPDFProps {}

export const SharedQuizResultsActions: React.FC<SharedQuizResultsActionsProps> = (props) => {
  const quizTitle = props.quiz?.title || 'Shared Quiz Results';
  const totalQuestions = props.quiz?.questions?.length || 0;
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleShare = async (blob: Blob | null) => {
    if (!blob) { alert('PDF not ready for sharing.'); return; }
    if (navigator.share) {
      try {
        const file = new File([blob], `${quizTitle}.pdf`, { type: 'application/pdf' });
        await navigator.share({ title: quizTitle, text: `Results for ${quizTitle}!`, files: [file] });
      } catch (_) {}
    } else {
      alert('Web Share API is not supported in your browser.');
    }
  };

  return (
    <>
      <PdfDownloadOverlay visible={pdfLoading} label="Generating results PDF…" />
      <BlobProvider document={<GameResultsDocument key="blob-doc" {...props} totalQuestions={totalQuestions} />}>
        {({ blob, loading }) => (
          <div className="flex space-x-1 md:space-x-2">
            <Button
              onClick={() => handleShare(blob)}
              disabled={loading || !blob}
              className="flex items-center gap-1 md:gap-2 bg-blue-500 hover:bg-blue-600 text-white text-xs md:text-sm px-2 py-1 md:px-3 md:py-2 rounded-md"
            >
              {loading
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Preparing…</>
                : <><Share2 className="h-3 w-3 md:h-4 md:w-4" /> Share</>
              }
            </Button>

            <PDFDownloadLink
              document={<GameResultsDocument key="dl-doc" {...props} totalQuestions={totalQuestions} />}
              fileName={`${quizTitle}.pdf`}
              onClick={() => { setPdfLoading(true); setTimeout(() => setPdfLoading(false), 3500); }}
            >
              {({ loading: dlLoading }) => (
                <Button
                  disabled={dlLoading || pdfLoading}
                  className="flex items-center gap-1 md:gap-2 bg-green-500 hover:bg-green-600 text-white text-xs md:text-sm px-2 py-1 md:px-3 md:py-2 rounded-md"
                >
                  {dlLoading || pdfLoading
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Preparing…</>
                    : <><Download className="h-3 w-3 md:h-4 md:w-4" /> Download</>
                  }
                </Button>
              )}
            </PDFDownloadLink>
          </div>
        )}
      </BlobProvider>
    </>
  );
};
