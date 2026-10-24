import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface DocumentViewerProps {
  documentUrl: string;
  documentName: string;
  fileType: string;
  isOpen: boolean;
  onClose: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentUrl,
  documentName,
  fileType,
  isOpen,
  onClose,
}) => {


  const renderContent = () => {
    if (!documentUrl) {
      return <p>No document selected.</p>;
    }

    if (fileType.startsWith('image/')) {
      return <img src={documentUrl} alt={documentName} className="max-w-full max-h-[80vh] object-contain mx-auto" />;
    } else {
      return (
        <iframe
          src={documentUrl}
          title={documentName}
          width="100%"
          height="100%"
          className="border-none"
          style={{ minHeight: '80vh' }}
        ></iframe>
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed inset-0 w-screen h-screen max-w-none max-h-none p-0 flex flex-col bg-gray-900 text-white border-gray-700">
        <DialogHeader className="p-4 border-b border-gray-700 flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-bold text-indigo-400">{documentName}</DialogTitle>
          <DialogDescription className="sr-only">Viewing document: {documentName}</DialogDescription>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-6 w-6" />
          </Button>
        </DialogHeader>
        <div className="dialog-content-body p-4 flex-grow overflow-auto flex items-center justify-center">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentViewer;