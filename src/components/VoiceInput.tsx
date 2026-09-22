import { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceInputProps {
  onResult: (text: string) => void;
  language?: string;
  placeholder?: string;
  className?: string;
}

export default function VoiceInput({ 
  onResult, 
  language = 'ar-SA', 
  placeholder = 'تحدث الآن...',
  className = ''
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true; // Enable interim results for better feedback
      recognitionInstance.lang = language;

      recognitionInstance.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
        setError(null);
        setInterimTranscript('');
      };

      recognitionInstance.onresult = (event: any) => {
        let currentInterim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const transcript = event.results[i][0].transcript;
            console.log('Final transcript:', transcript);
            onResult(transcript);
            setIsListening(false);
            setInterimTranscript('');
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }
        setInterimTranscript(currentInterim);
      };

      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          // Ignore no-speech error as it's common
        } else {
          setError(event.error);
        }
        setIsListening(false);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    } else {
      setError('Browser not supported');
    }
  }, [language, onResult]);

  const toggleListening = useCallback(() => {
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (err) {
        console.error('Failed to start recognition:', err);
      }
    }
  }, [recognition, isListening]);

  if (error === 'Browser not supported') {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`p-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
        isListening 
          ? 'bg-danger text-white animate-pulse' 
          : 'bg-navy-100 dark:bg-navy-700 text-navy-600 dark:text-gray-400 hover:text-brand-primary'
      } ${className}`}
      title={isListening ? 'إيقاف الاستماع' : 'إدخال صوتي'}
    >
      {isListening ? (
        <div className="flex items-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[10px] font-bold max-w-[100px] truncate">
            {interimTranscript || 'جاري الاستماع...'}
          </span>
        </div>
      ) : (
        <Mic size={18} />
      )}
    </button>
  );
}
