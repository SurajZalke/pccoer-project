import React, { useState } from 'react';
import { PDFDownloadLink, BlobProvider } from '@react-pdf/renderer';
import { GameResultsDocument, GameResultsPDFProps } from './GameResultsPDF';
import { Button } from '@/components/ui/button';
import { Share2, Download, Loader2 } from 'lucide-react';
import PdfDownloadOverlay from './PdfDownloadOverlay';

interface GameResultsActionsProps extends GameResultsPDFProps {}

export const GameResultsActions: React.FC<GameResultsActionsProps> = (props) => {
  const quizTitle = props.quiz?.title || 'Game Results';
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleShare = async (blob: Blob | null) => {
    if (!blob) { alert('PDF not ready for sharing.'); return; }
    if (navigator.share) {
      try {
        const file = new File([blob], `${quizTitle}.pdf`, { type: 'application/pdf' });
        await navigator.share({ title: quizTitle, text: `Results for ${quizTitle}!`, files: [file] });
      } catch (_) {}
    } else {
      alert('Web Share API is not supported in your browser. Please download the PDF instead.');
    }
  };

  return (
    <>
      <PdfDownloadOverlay visible={pdfLoading} label="Generating results PDF…" />
      <div className="flex space-x-1 md:space-x-2">
        <PDFDownloadLink
          document={<GameResultsDocument key="dl-doc" {...props} />}
          fileName={`${quizTitle}.pdf`}
          onClick={() => { setPdfLoading(true); setTimeout(() => setPdfLoading(false), 3500); }}
        >
          {({ loading }) => (
            <Button
              className="inline-flex items-center gap-1 md:gap-2 h-8 md:h-10 px-2 md:px-4 bg-[#1e1b4b] hover:bg-[#4338ca] text-white text-xs md:text-sm rounded-md transition-colors"
              disabled={loading || pdfLoading}
            >
              {loading || pdfLoading
                ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Preparing…</>
                : <><Download className="h-3 w-3 md:h-4 md:w-4" /> Download</>
              }
            </Button>
          )}
        </PDFDownloadLink>

        <BlobProvider document={<GameResultsDocument key="blob-doc" {...props} />}>
          {({ blob, loading }) => (
            <Button
              className="inline-flex items-center gap-1 md:gap-2 h-8 md:h-10 px-2 md:px-4 bg-gray-600 hover:bg-gray-700 text-white text-xs md:text-sm rounded-md transition-colors"
              onClick={() => handleShare(blob)}
              disabled={loading || !blob}
            >
              {loading
                ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Preparing…</>
                : <><Share2 className="h-3 w-3 md:h-4 md:w-4" /> Share</>
              }
            </Button>
          )}
        </BlobProvider>
      </div>
    </>
  );
};
