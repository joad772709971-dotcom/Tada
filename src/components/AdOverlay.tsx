import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, Info } from 'lucide-react';
import { Ad, adService } from '../services/adService';

interface AdOverlayProps {
  ads: Ad[];
  isOpen: boolean;
  onClose: () => void;
}

export default function AdOverlay({ ads, isOpen, onClose }: AdOverlayProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const currentAd = ads[currentIdx];

  useEffect(() => {
    if (isOpen && currentAd) {
      adService.trackView(currentAd.id);
    }
  }, [isOpen, currentAd]);

  if (!currentAd || !isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-8">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-2xl bg-white dark:bg-navy-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10"
        >
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-all border border-white/10"
          >
            <X size={24} />
          </button>

          <div className="relative aspect-video w-full overflow-hidden">
            <img 
              src={currentAd.imageUrl} 
              alt={currentAd.title} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            
            <div className="absolute bottom-0 left-0 right-0 p-8 text-right">
              <h3 className="text-3xl font-black text-white mb-2">{currentAd.title}</h3>
              {currentAd.link && (
                <a 
                  href={currentAd.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => adService.trackClick(currentAd.id)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-black rounded-xl font-black bounce-hover"
                >
                  <ExternalLink size={20} />
                  عرض التفاصيل
                </a>
              )}
            </div>
          </div>

          <div className="p-6 bg-gray-50 dark:bg-navy-800 flex items-center justify-between">
            <div className="flex gap-2">
              {ads.length > 1 && ads.map((_, i) => (
                <button 
                  key={i}
                  onClick={() => setCurrentIdx(i)}
                  className={`h-2 rounded-full transition-all ${i === currentIdx ? 'w-8 bg-brand-primary' : 'w-2 bg-gray-300 dark:bg-navy-700'}`}
                />
              ))}
            </div>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white font-bold text-sm"
            >
              إغلاق الإعلان
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
