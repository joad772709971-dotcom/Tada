import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronDown, Plus, Loader2 } from 'lucide-react';

interface CreatableSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  collectionName: 'fixed_assets_categories' | 'outflow_categories';
  ownerId: string;
  placeholder?: string;
  required?: boolean;
}

export function CreatableSelect({
  label,
  value,
  onChange,
  collectionName,
  ownerId,
  placeholder,
  required = false
}: CreatableSelectProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch options on mount or when ownerId/collectionName changes
  useEffect(() => {
    if (!ownerId) return;
    const fetchOptions = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, collectionName), where('ownerId', '==', ownerId));
        const snap = await getDocs(q);
        const fetched = snap.docs.map(doc => doc.data().name as string);
        // Deduplicate and filter out empty names
        setOptions(Array.from(new Set(fetched)).filter(Boolean));
      } catch (err) {
        console.error("Error fetching options:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOptions();
  }, [ownerId, collectionName]);

  // Sync input value with external value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Handle clicking outside to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset input value to selected value if they didn't create/select anything
        setInputValue(value);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(inputValue.toLowerCase())
  );

  const handleSelect = (val: string) => {
    onChange(val);
    setInputValue(val);
    setIsOpen(false);
  };

  const handleCreateNew = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (options.includes(trimmed)) {
      handleSelect(trimmed);
      return;
    }

    setCreating(true);
    try {
      // Check Firestore strictly to ensure no duplicates
      const q = query(
        collection(db, collectionName),
        where('ownerId', '==', ownerId),
        where('name', '==', trimmed)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        if (!options.includes(trimmed)) {
          setOptions(prev => [...prev, trimmed]);
        }
        handleSelect(trimmed);
        return;
      }

      await addDoc(collection(db, collectionName), {
        ownerId,
        name: trimmed,
        createdAt: serverTimestamp()
      });
      setOptions(prev => [...prev, trimmed]);
      handleSelect(trimmed);
    } catch (err) {
      console.error("Error creating option:", err);
      alert("عذراً، فشل إضافة الفئة الجديدة إلى قاعدة البيانات.");
    } finally {
      setCreating(false);
    }
  };

  const showCreateOption = inputValue.trim() && !options.includes(inputValue.trim());

  return (
    <div ref={containerRef} className="space-y-1 relative text-right font-sans">
      <label className="text-xs font-black text-gray-400 block">{label}</label>
      
      <div className="relative">
        <input
          required={required}
          type="text"
          className="w-full bg-gray-50 dark:bg-navy-900/50 p-3 pl-10 rounded-xl border border-gray-100 dark:border-navy-800 text-xs text-navy-900 dark:text-white font-black transition-colors focus:border-[#3498db] focus:ring-1 focus:ring-[#3498db] focus:outline-none"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || "اختر من القائمة أو اكتب اسماً جديداً..."}
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 className="animate-spin text-gray-400" size={14} />}
          <ChevronDown 
            className={`text-gray-400 cursor-pointer transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            size={16} 
            onClick={() => setIsOpen(!isOpen)}
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-navy-800 border border-gray-150 dark:border-navy-700 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-50 dark:divide-navy-700">
          {showCreateOption && (
            <button
              type="button"
              onClick={handleCreateNew}
              disabled={creating}
              className="w-full p-3 text-xs font-black text-[#3498db] hover:bg-[#3498db]/5 text-right flex items-center justify-between"
            >
              <span className="flex items-center gap-1">
                <Plus size={14} />
                إضافة "{inputValue}" كصنف جديد
              </span>
              {creating && <Loader2 className="animate-spin" size={12} />}
            </button>
          )}

          {filteredOptions.length === 0 ? (
            !showCreateOption && (
              <div className="p-3 text-xs text-gray-400 text-center">
                لا توجد خيارات متاحة. اكتب لإضافة صنف جديد!
              </div>
            )
          ) : (
            filteredOptions.map((opt, idx) => (
              <div
                key={idx}
                className={`p-3 text-xs font-bold text-navy-900 dark:text-white hover:bg-gray-50 dark:hover:bg-navy-900/50 cursor-pointer text-right transition-colors ${
                  opt === value ? 'bg-[#3498db]/5 border-r-2 border-[#3498db]' : ''
                }`}
                onClick={() => handleSelect(opt)}
              >
                {opt}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
