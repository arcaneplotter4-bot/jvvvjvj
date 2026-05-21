import React, { useState } from 'react';
import { PresentationHome } from './components/presentation/PresentationHome';
import { PresentationParser } from './components/presentation/PresentationParser';
import { PresentationViewer } from './components/presentation/PresentationViewer';
import { PresentationData } from './presentationTypes';

interface PresentationModeProps {
  view: 'home' | 'parser' | 'viewer';
  setView: (view: 'home' | 'parser' | 'viewer') => void;
}

export function PresentationMode({ view, setView }: PresentationModeProps) {
  const [presentation, setPresentation] = useState<PresentationData | null>(null);

  if (view === 'home') {
    return (
      <PresentationHome 
        onStart={() => setView('parser')} 
      />
    );
  }
  
  if (view === 'parser') {
    return (
      <PresentationParser 
        onParsed={(data) => { 
          setPresentation(data); 
          setView('viewer'); 
        }} 
        onCancel={() => setView('home')} 
      />
    );
  }

  if (view === 'viewer' && presentation) {
    return (
      <PresentationViewer 
        presentation={presentation} 
        onUpdatePresentation={setPresentation}
        onClose={() => setView('parser')} 
      />
    );
  }

  return null;
}
