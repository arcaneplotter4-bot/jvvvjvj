import React, { useState } from 'react';
import { motion } from 'motion/react';
import { PresentationData, SlideData, SlideType } from '../../presentationTypes';
import { Copy, Check, FileCode, Play, Wand2, ChevronLeft, LayoutTemplate } from 'lucide-react';
import { copyToClipboard } from '../../utils';

export const parseCSV = (text: string): Record<string, string>[] => {
  const lines: string[] = [];
  let currentLine = '';
  let insideQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === '\n' && !insideQuotes) {
      lines.push(currentLine);
      currentLine = '';
    } else if (char === '\r' && !insideQuotes) {
      // skip \r
    } else {
      currentLine += char;
    }
  }
  if (currentLine) lines.push(currentLine);

  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const result: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values: string[] = [];
    let currentVal = '';
    let inQuote = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        values.push(currentVal);
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal);

    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = values[idx] || '';
    });
    result.push(obj);
  }

  return result;
};

interface PresentationParserProps {
  onParsed: (data: PresentationData) => void;
  onCancel: () => void;
}

export const PresentationParser: React.FC<PresentationParserProps> = ({ onParsed, onCancel }) => {
  const [slideTypes, setSlideTypes] = useState<string[]>(['title', 'agenda', 'text', 'image-text', 'images', 'split-text', 'quote', 'bullets', 'chart', 'grid', 'process', 'timeline', 'team']);
  const [copied, setCopied] = useState(false);
  const [parseText, setParseText] = useState('');
  const [error, setError] = useState('');

  const toggleSlideType = (type: string) => {
    setSlideTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleCopyPrompt = () => {
    const typesStr = slideTypes.join(', ');
    const prompt = `I need you to generate a presentation in JSON format.
The presentation should ONLY contain the following slide types: ${typesStr}.

You must output a JSON array of objects, where each object represents a slide. Ensure you follow the exact schema for each slide type.

Available Slide Schemas:
${slideTypes.includes('title') ? `- Title Slide: { "type": "title", "title": "Main Title", "subtitle": "Optional subtitle", "author": "Optional author", "date": "Optional date" }` : ''}
${slideTypes.includes('agenda') ? `- Agenda Slide: { "type": "agenda", "title": "Agenda", "items": ["Item 1", "Item 2", "Item 3"] }` : ''}
${slideTypes.includes('text') ? `- Text Slide: { "type": "text", "title": "Slide Title", "content": "Slide content with **Markdown** support" }` : ''}
${slideTypes.includes('split-text') ? `- Split Text Slide: { "type": "split-text", "title": "Slide Title", "leftContent": "Left column Markdown", "rightContent": "Right column Markdown" }` : ''}
${slideTypes.includes('image-text') ? `- Image & Text Slide: { "type": "image-text", "title": "Slide Title", "textContent": "Markdown content", "imageUrl": "https://example.com/image.jpg", "imagePosition": "left" | "right" | "top" | "bottom" }` : ''}
${slideTypes.includes('images') ? `- Multi-Image Slide: { "type": "images", "title": "Gallery Title", "images": ["url1", "url2"] }` : ''}
${slideTypes.includes('quote') ? `- Quote Slide: { "type": "quote", "quote": "The quote text", "author": "Author Name" }` : ''}
${slideTypes.includes('bullets') ? `- Bullets Slide: { "type": "bullets", "title": "Slide Title", "bullets": ["Bullet 1", "Bullet 2", "Bullet 3"] }` : ''}
${slideTypes.includes('chart') ? `- Chart Slide: { "type": "chart", "title": "Performance...", "data": [{ "name": "Jan", "value": 100 }] }` : ''}
${slideTypes.includes('grid') ? `- Grid/SWOT Slide: { "type": "grid", "title": "Objectives", "items": [{ "title": "Goal 1", "description": "Details", "icon": "Target" }] }` : ''}
${slideTypes.includes('process') ? `- Process Slide: { "type": "process", "title": "Workflow", "items": [{ "label": "Step 1", "description": "Info" }] }` : ''}
${slideTypes.includes('timeline') ? `- Timeline Slide: { "type": "timeline", "title": "Roadmap", "items": [{ "date": "2026", "title": "Event", "description": "Info" }] }` : ''}
${slideTypes.includes('team') ? `- Team Slide: { "type": "team", "title": "Our Team", "members": [{ "name": "Name", "role": "Role", "bio": "Bio" }] }` : ''}

Output ONLY the JSON array without any markdown wrappers or surrounding text.`;

    copyToClipboard(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleLoadSample = () => {
    const sampleSlides: any[] = [];
    if (slideTypes.includes('title')) sampleSlides.push({ 
      type: 'title', 
      title: 'Future of **Technology**', 
      subtitle: 'A deep dive into *tomorrow* and *beyond*', 
      author: 'AI Architect', 
      date: new Date().toISOString().split('T')[0] 
    });
    if (slideTypes.includes('agenda')) sampleSlides.push({ 
      type: 'agenda', 
      title: "Today's Agenda", 
      items: ['Introduction to **GenAI**', 'Key Trends in <span class="text-indigo-600">2026</span>', 'Design Challenges', 'Final Conclusion'] 
    });
    if (slideTypes.includes('text')) sampleSlides.push({ 
      type: 'text', 
      title: 'Introduction', 
      content: 'We are standing at the **precipice** of a new technological era.\n\n### Core Pillars\n1. **Artificial Intelligence**: Reshaping interaction.\n2. **Quantum Computing**: Solving the unsolvable.\n3. **Biotechnology**: Bridging life and circuit.\n\n> "The best way to predict the future is to invent it." \n\n<div class="p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-xl my-4 text-indigo-900 font-bold italic">\nNote: This transition is happening faster than anticipated.\n</div>' 
    });
    if (slideTypes.includes('split-text')) sampleSlides.push({ 
      type: 'split-text', 
      title: 'Pros & Cons', 
      leftContent: '### <span class="text-emerald-600">Advantages</span>\n- **Efficiency**: 10x faster workflows\n- **Automation**: Mundane tasks removed\n- **Insights**: Pattern recognition at scale\n\n```js\n// Efficiency Example\nconst boost = process => process * 10;\n```', 
      rightContent: '### <span class="text-rose-600">Disadvantages</span>\n- *Privacy*: Data security overlaps\n- *Cost*: High initial R&D sink\n- *Job Displacement*: Transition friction\n\n| Risk | Impact | \n| :--- | :--- | \n| Data | High | \n| Initial | Med | \n| Ethics | Critical |' 
    });
    if (slideTypes.includes('image-text')) sampleSlides.push({ 
      type: 'image-text', 
      title: 'Visual Data', 
      textContent: 'Complex data can be understood better when **visualized properly**.\n\n*   Charts provide context\n*   Visuals aid retention\n*   Design communicates emotion\n\n<mark class="bg-amber-200 px-2 py-1 rounded">Highlighting critical data points</mark> attracts immediate attention.', 
      imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80', 
      imagePosition: 'left' 
    });
    if (slideTypes.includes('images')) sampleSlides.push({ 
      type: 'images', 
      title: 'Global Performance', 
      images: [
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80', 
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
        'https://images.unsplash.com/photo-1543286386-713bdd548da4?w=800&q=80',
        'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80'
      ]
    });
    if (slideTypes.includes('quote')) sampleSlides.push({ 
      type: 'quote', 
      quote: 'The **only limit** to our realization of tomorrow will be our *doubts* of today.', 
      author: 'Franklin D. Roosevelt' 
    });
    if (slideTypes.includes('bullets')) sampleSlides.push({ 
      type: 'bullets', 
      title: 'Key Takeaways', 
      bullets: [
        'Identify **core problems** first', 
        'Iterate *quickly* and learn', 
        'Always keep the **user** in mind',
        'Embrace <span class="text-indigo-600">innovation</span>'
      ] 
    });
    if (slideTypes.includes('chart')) sampleSlides.push({ 
      type: 'chart', 
      title: 'Growth **Analysis** 2026', 
      subtitle: 'Market share and user retention across Q1-Q4', 
      data: [
        { name: 'Q1', value: 240, secondary: 120 },
        { name: 'Q2', value: 380, secondary: 210 },
        { name: 'Q3', value: 520, secondary: 450 },
        { name: 'Q4', value: 780, secondary: 680 }
      ]
    });
    if (slideTypes.includes('grid')) sampleSlides.push({ 
      type: 'grid', 
      title: 'Project **Objectives**', 
      items: [
        { id: '1', title: 'Scalability', description: 'Systems that grow with our user base globally.', icon: 'Zap', color: '#6366f1' },
        { id: '2', title: 'Security', description: 'Zero-trust architecture and data encryption.', icon: 'Shield', color: '#10b981' },
        { id: '3', title: 'UX Excellence', description: 'Intuitive designs for modern professionals.', icon: 'Layout', color: '#f59e0b' },
        { id: '4', title: 'Performance', description: 'Sub-100ms response times for all users.', icon: 'Activity', color: '#6366f1' }
      ]
    });
    if (slideTypes.includes('process')) sampleSlides.push({ 
      type: 'process', 
      title: 'Development **Lifecycle**', 
      items: [
        { id: '1', label: 'Discovery', description: 'User research and requirements gathering.' },
        { id: '2', label: 'Design', description: 'Prototyping and visual architecture.' },
        { id: '3', label: 'Develop', description: 'Agile implementation and coding phase.' },
        { id: '4', label: 'Deploy', description: 'Production release and global rollout.' }
      ]
    });
    if (slideTypes.includes('timeline')) sampleSlides.push({
      type: 'timeline',
      title: 'Global **Roadmap**',
      items: [
        { id: '1', date: 'Q1 2026', title: 'Alpha Phase', description: 'Initial testing with core group.' },
        { id: '2', date: 'Q2 2026', title: 'Public Beta', description: 'Opening access to pre-registered users.' },
        { id: '3', date: 'Q3 2026', title: 'Mass Launch', description: 'Full global availability and support.' },
        { id: '4', date: 'Q4 2026', title: 'Expansion', description: 'Adding AI-powered automation features.' }
      ]
    });
    if (slideTypes.includes('team')) sampleSlides.push({
      type: 'team',
      title: 'The **Visionaries**',
      members: [
        { id: '1', name: 'Marco Chen', role: 'CTO / Strategy', bio: 'Former Lead Engineer at Global Vision Corp.', imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400' },
        { id: '2', name: 'Sarah Miller', role: 'Design Director', bio: 'Award-winning product designer and futurist.', imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400' },
        { id: '3', name: 'Elena Rossi', role: 'DevOps Lead', bio: 'Expert in cloud architecture and scaling.', imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400' },
        { id: '4', name: 'David Smith', role: 'Product Manager', bio: 'Bridging the gap between code and customers.', imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400' }
      ]
    });

    setParseText(JSON.stringify(sampleSlides, null, 2));
    setError('');
  };

  const handleParse = () => {
    setError('');
    if (!parseText.trim()) {
      setError('Please paste JSON or CSV data first.');
      return;
    }

    try {
      let rawData: any[] = [];
      const textTrimmed = parseText.trim();
      
      if (textTrimmed.startsWith('[') || textTrimmed.startsWith('{')) {
        const parsed = JSON.parse(textTrimmed);
        rawData = Array.isArray(parsed) ? parsed : (parsed.slides ? parsed.slides : [parsed]);
      } else if (textTrimmed.includes(',')) {
        rawData = parseCSV(textTrimmed);
        if (rawData.length === 0) {
           setError('Failed to parse CSV data.');
           return;
        }
      } else {
        setError('Format not recognized. Please paste valid JSON or CSV.');
        return;
      }

      const slides: SlideData[] = rawData.map((item: any, index: number): SlideData => {
        const type = (item.type || item.Type || 'text').toLowerCase() as SlideType;
        const base = { id: `slide-${index}-${Date.now()}` };
        switch (type) {
          case 'title': return { ...base, type: 'title', title: item.title || item.Title || 'Untitled', subtitle: item.subtitle || item.Subtitle, author: item.author || item.Author, date: item.date || item.Date };
          case 'agenda': return { ...base, type: 'agenda', title: item.title || item.Title || 'Agenda', items: Array.isArray(item.items) ? item.items : (item.items ? String(item.items).split('|') : []) };
          case 'split-text': return { ...base, type: 'split-text', title: item.title || item.Title || '', leftContent: item.leftContent || item.LeftContent || '', rightContent: item.rightContent || item.RightContent || '' };
          case 'image-text': return { ...base, type: 'image-text', title: item.title || item.Title || '', textContent: item.textContent || item.content || item.TextContent || item.Content || '', imageUrl: item.imageUrl || item.ImageUrl || '', imagePosition: (item.imagePosition || item.ImagePosition) === 'right' ? 'right' : (item.imagePosition === 'top' ? 'top' : (item.imagePosition === 'bottom' ? 'bottom' : 'left')) };
          case 'images': return { ...base, type: 'images', title: item.title || item.Title || '', images: Array.isArray(item.images) ? item.images : (item.images ? String(item.images).split('|') : []) };
          case 'quote': return { ...base, type: 'quote', quote: item.quote || item.content || item.Quote || item.Content || '', author: item.author || item.Author || '' };
          case 'bullets': return { ...base, type: 'bullets', title: item.title || item.Title || '', bullets: Array.isArray(item.bullets) ? item.bullets : (item.bullets ? String(item.bullets).split('|') : []) };
          case 'chart': return { ...base, type: 'chart', title: item.title || item.Title || '', subtitle: item.subtitle || item.Subtitle || '', data: Array.isArray(item.data) ? item.data : [] };
          case 'grid': return { ...base, type: 'grid', title: item.title || item.Title || 'Objectives', items: Array.isArray(item.items) ? item.items : [] };
          case 'process': return { ...base, type: 'process', title: item.title || item.Title || 'Process', items: Array.isArray(item.items) ? item.items : [] };
          case 'timeline': return { ...base, type: 'timeline', title: item.title || item.Title || 'Timeline', items: Array.isArray(item.items) ? item.items : [] };
          case 'team': return { ...base, type: 'team', title: item.title || item.Title || 'Our Team', members: Array.isArray(item.members) ? item.members : [] };
          case 'text':
          default: return { ...base, type: 'text', title: item.title || item.Title || '', content: item.content || item.text || item.Content || item.Text || '' };
        }
      });

      onParsed({
        id: `pres-${Date.now()}`,
        title: 'New Presentation',
        slides,
        createdAt: Date.now()
      });
    } catch (e: any) {
      setError('Failed to parse: ' + e.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border-b-8 border-indigo-100 dark:border-indigo-900 shadow-xl">
        <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-indigo-500">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-3xl font-black tracking-tighter uppercase italic text-slate-900 dark:text-white leading-none">Presentation Builder</h2>
          <p className="text-indigo-500 font-bold text-xs uppercase tracking-widest mt-1">Generate or paste your slides</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Step 1: Prompt Generation */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
              <Wand2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">1. AI Instructions</h3>
              <p className="text-sm font-medium text-slate-500">Select slide types and get a prompt</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Available Slide Types</p>
            <div className="flex flex-wrap gap-2">
              {['title', 'agenda', 'text', 'image-text', 'images', 'split-text', 'quote', 'bullets', 'chart', 'grid', 'process', 'timeline', 'team'].map(type => (
                <button
                  key={type}
                  onClick={() => toggleSlideType(type)}
                  className={`px-4 py-2 font-bold text-xs rounded-xl transition-all ${slideTypes.includes(type) ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border-2 border-indigo-300 dark:border-indigo-700/50' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                >
                  <span className="capitalize">{type.replace('-', ' ')}</span>
                </button>
              ))}
            </div>
          </div>
          
          <button 
            onClick={handleCopyPrompt} 
            className={`w-full py-4 font-black uppercase text-sm tracking-widest rounded-2xl shadow-[0_4px_0_rgba(0,0,0,0.2)] hover:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-3 ${copied ? 'bg-emerald-500 text-white shadow-[0_4px_0_theme(colors.emerald.700)]' : 'bg-indigo-600 text-white shadow-[0_4px_0_theme(colors.indigo.800)]'}`}
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            {copied ? "Prompt Copied!" : "Copy AI Prompt"}
          </button>
          <p className="text-[10px] text-slate-500 text-center font-medium leading-relaxed">Paste this prompt into ChatGPT or Gemini, ask for a presentation, then paste the resulting JSON into the next section.</p>
        </div>

        {/* Step 2: Parser Data */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 space-y-6 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">2. Parse Data</h3>
                <p className="text-sm font-medium text-slate-500">Paste your generated JSON</p>
              </div>
            </div>
            
            <button onClick={handleLoadSample} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4" /> Sample
            </button>
          </div>

          <div className="flex-1 relative">
            <textarea
              value={parseText}
              onChange={(e) => { setParseText(e.target.value); setError(''); }}
              placeholder="Paste the generated JSON array here..."
              className="w-full h-full min-h-[300px] p-6 bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-2xl font-mono text-sm outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all resize-none text-slate-800 dark:text-slate-200"
            />
            {error && (
              <div className="absolute bottom-4 left-4 right-4 bg-red-100 dark:bg-red-900/80 text-red-600 dark:text-red-200 px-4 py-3 rounded-xl text-sm font-bold shadow-lg backdrop-blur-md">
                {error}
              </div>
            )}
          </div>

          <button onClick={handleParse} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase text-sm tracking-widest rounded-2xl shadow-[0_4px_0_rgba(0,0,0,0.1)] hover:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-3">
            <Play className="w-5 h-5" /> Start Presentation
          </button>
        </div>
      </div>
    </div>
  );
};
