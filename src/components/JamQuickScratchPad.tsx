import React, { useState, useEffect } from 'react';
import { Trash2, Calendar, Clock, Plus, Square, CheckSquare, X, List, Check } from 'lucide-react';

interface QuickNote {
  id: string;
  text: string;
  createdAt: string; // ISO String
}

export const JamQuickScratchPad: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'today'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 1. تحميل الملاحظات والترقية الذكية من الإصدار القديم المفرد
  useEffect(() => {
    // التحقق من وجود ملاحظة قديمة مفردة لترحيلها بدقة
    const oldNote = localStorage.getItem('jam_quick_note');
    const savedNotesStr = localStorage.getItem('jam_quick_notes_list');
    
    let loadedNotes: QuickNote[] = [];
    
    if (savedNotesStr) {
      try {
        loadedNotes = JSON.parse(savedNotesStr);
      } catch (e) {
        console.error('Failed to parse jam_quick_notes_list', e);
      }
    }

    if (oldNote && oldNote.trim()) {
      const migratedNote: QuickNote = {
        id: 'migrated-' + Date.now(),
        text: oldNote,
        createdAt: new Date().toISOString()
      };
      loadedNotes = [migratedNote, ...loadedNotes];
      localStorage.setItem('jam_quick_notes_list', JSON.stringify(loadedNotes));
      localStorage.removeItem('jam_quick_note'); // إزالة المفتاح القديم لمنع التكرار
    }

    setNotes(loadedNotes);
  }, []);

  // 2. تحديث قائمة الاختيار التلقائي عند تغيير قائمة الملاحظات لتفادي مرجعيات مشطوبة
  const saveNotesList = (updatedList: QuickNote[]) => {
    setNotes(updatedList);
    localStorage.setItem('jam_quick_notes_list', JSON.stringify(updatedList));
  };

  // 3. معالج حدث لوحة المفاتيح: حفظ الخاطفة لتدشين ملاحظة جديدة وإغلاق الفانوس
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addNewNote();
    }
  };

  const addNewNote = () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;

    const newNote: QuickNote = {
      id: 'note-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      text: trimmed,
      createdAt: new Date().toISOString()
    };

    const updated = [newNote, ...notes];
    saveNotesList(updated);
    setNoteText('');
    setIsOpen(false); // إغلاق منبثق النوتة تلقائياً كالمطلوب بالاختصار السريع
    console.log('📝 تم ترحيل وحفظ الملاحظة الجديدة وإغلاق المفكرة بنجاح.');
  };

  const addNewNoteAndKeepOpen = () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;

    const newNote: QuickNote = {
      id: 'note-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      text: trimmed,
      createdAt: new Date().toISOString()
    };

    const updated = [newNote, ...notes];
    saveNotesList(updated);
    setNoteText('');
  };

  // 4. حذف الملاحظات المحددة
  const deleteSelectedNotes = () => {
    if (selectedIds.length === 0) return;
    const remaining = notes.filter(n => !selectedIds.includes(n.id));
    saveNotesList(remaining);
    setSelectedIds([]);
  };

  // 5. تصفية الملاحظات بحسب "اليوم" أو "الكل"
  const isToday = (isoString: string) => {
    const noteDate = new Date(isoString);
    const today = new Date();
    return noteDate.getDate() === today.getDate() &&
           noteDate.getMonth() === today.getMonth() &&
           noteDate.getFullYear() === today.getFullYear();
  };

  const filteredNotes = notes.filter(n => {
    if (filterMode === 'today') {
      return isToday(n.createdAt);
    }
    return true;
  });

  // 6. التحكم باختيار الكل
  const handleSelectAllToggle = () => {
    const visibleIds = filteredNotes.map(n => n.id);
    const allVisibleSelected = visibleIds.every(id => selectedIds.includes(id));

    if (allVisibleSelected) {
      // إلغاء تحديد الظاهر فقط
      setSelectedIds(selectedIds.filter(id => !visibleIds.includes(id)));
    } else {
      // تحديد كل المعروضين
      const merged = Array.from(new Set([...selectedIds, ...visibleIds]));
      setSelectedIds(merged);
    }
  };

  const toggleSelectNote = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Listen to global open/close events to integrate with Jam floating action dock
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      const forceState = customEvent.detail?.open;
      setIsOpen(prev => forceState !== undefined ? forceState : !prev);
    };
    window.addEventListener('toggle-jam-scratchpad', handleToggle);
    return () => window.removeEventListener('toggle-jam-scratchpad', handleToggle);
  }, []);

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed', 
        bottom: '96px', 
        left: '24px', 
        zIndex: 100002,
        width: '350px',
        background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.99))', 
        backdropFilter: 'blur(16px)',
        border: '2px solid rgba(207, 138, 60, 0.8)', 
        borderRadius: '20px', 
        padding: '14px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.08)', 
        color: '#fff',
        fontFamily: '"Cairo", "Outfit", sans-serif',
        maxHeight: '520px',
        display: 'flex',
        flexDirection: 'column',
      }}
      className="animate-fade-in text-right"
      dir="rtl"
    >
      {/* رأس المفكرة */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: '900', color: '#cf8a3c', display: 'flex', alignItems: 'center', gap: '6px' }}>
          📝 مفكرة المهام الذكية
        </span>
        <button 
          onClick={() => {
            setIsOpen(false);
            window.dispatchEvent(new CustomEvent('jam-tool-closed', { detail: { tool: 'notes' } }));
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* لوحة كتابة الملاحظات */}
      <div className="relative mb-3">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="اكتب مهامك، أرقام تواصل، حوالات... اضغط [Enter] للحفظ السريع والخصم، أو الزر بالأسفل."
          rows={3}
          style={{
            width: '100%', 
            background: 'rgba(2, 6, 23, 0.8)', 
            border: '1.5px solid rgba(207, 138, 60, 0.35)',
            borderRadius: '12px', 
            padding: '10px 12px', 
            color: '#e2e8f0', 
            fontSize: '12px',
            fontWeight: '500',
            fontFamily: '"Cairo", "Outfit", sans-serif', 
            resize: 'none', 
            outline: 'none',
            boxSizing: 'border-box',
            lineHeight: '1.6',
            boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.4)'
          }}
          className="focus:border-[#cf8a3c] focus:ring-1 focus:ring-[#cf8a3c] transition-all custom-scrollbar placeholder-slate-500"
          autoFocus
        />
        {/* أزرار الحفظ المباشر */}
        <div className="flex justify-end gap-2 mt-1.5">
          <button
            type="button"
            onClick={addNewNoteAndKeepOpen}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-[#f5d061] rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer"
          >
            <Plus size={10} />
            إضافة وإبقاء النافذة
          </button>
          <button
            type="button"
            onClick={addNewNote}
            className="px-3 py-1 bg-[#cf8a3c] hover:bg-[#b0722e] text-slate-950 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer"
          >
            <Check size={10} />
            حفظ وإغلاق (Enter)
          </button>
        </div>
      </div>

          {/* خط منقّط فاصل */}
          <div className="h-px bg-slate-800/80 mb-3" />

          {/* أزرار الفلترة والتحكم الجماعي الكبرى */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8.px' }} className="flex gap-2">
            {/* فلتر الملاحظات لليوم أو الكل */}
            <div className="flex bg-slate-950/80 p-0.5 rounded-lg border border-slate-800/80">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  background: filterMode === 'all' ? '#cf8a3c' : 'transparent',
                  color: filterMode === 'all' ? '#020617' : '#94a3b8',
                  transition: 'all 0.2s'
                }}
                className="cursor-pointer flex items-center gap-1"
              >
                <List size={10} />
                الكل ({notes.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('today')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  background: filterMode === 'today' ? '#cf8a3c' : 'transparent',
                  color: filterMode === 'today' ? '#020617' : '#94a3b8',
                  transition: 'all 0.2s'
                }}
                className="cursor-pointer flex items-center gap-1"
                title="عرض تذكيرات اليوم فقط"
              >
                <Calendar size={10} />
                ملاحظات اليوم ({notes.filter(n => isToday(n.createdAt)).length})
              </button>
            </div>

            {/* تحديد الكل */}
            {filteredNotes.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAllToggle}
                className="text-[10px] text-slate-400 hover:text-white transition-colors cursor-pointer font-bold flex items-center gap-1"
              >
                {filteredNotes.every(id => selectedIds.includes(id.id)) ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
              </button>
            )}
          </div>

          {/* قائمة الملاحظات */}
          <div 
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              maxHeight: '220px', 
              paddingRight: '2px',
              paddingLeft: '5px'
            }} 
            className="custom-scrollbar space-y-2 mt-2"
          >
            {filteredNotes.length === 0 ? (
              <div className="text-center py-8 text-slate-500 italic text-xs">
                {filterMode === 'today' ? 'لا توجد ملاحظات مسجلة اليوم!' : 'المفكرة فارغة حالياً.'}
              </div>
            ) : (
              filteredNotes.map((note) => {
                const isSelected = selectedIds.includes(note.id);
                const timeString = new Date(note.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                const dateString = new Date(note.createdAt).toLocaleDateString('ar-EG', { month: '2-digit', day: '2-digit' });

                return (
                  <div
                    key={note.id}
                    onClick={() => toggleSelectNote(note.id)}
                    style={{
                      background: isSelected ? 'rgba(207, 138, 60, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? '1px solid rgba(207, 138, 60, 0.5)' : '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                    className="p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer flex gap-3 items-start group select-none"
                  >
                    {/* مربع الاختيار الجانبي */}
                    <button
                      type="button"
                      className="text-[#cf8a3c] focus:outline-none shrink-0 mt-0.5 transition-transform group-hover:scale-105"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectNote(note.id);
                      }}
                    >
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-500" />}
                    </button>

                    {/* نص ومحتوى الملاحظة */}
                    <div className="flex-1 space-y-1">
                      <p className="text-xs text-slate-200 font-medium break-words leading-relaxed whitespace-pre-wrap">
                        {note.text}
                      </p>
                      <div className="flex items-center gap-2 text-[9px] text-slate-500 font-semibold arab-nums">
                        <Clock size={8} />
                        <span>{timeString}</span>
                        <span>•</span>
                        <span>{dateString}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* لوحة التحكم بالحذف الفردي أو الجماعي تحت القائمة */}
          {selectedIds.length > 0 && (
            <div className="mt-3 p-2 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-xl flex items-center justify-between animate-fade-in">
              <span className="text-[10px] text-red-300 font-black">
                {selectedIds.length} ملاحظات محددة
              </span>
              <button
                type="button"
                onClick={deleteSelectedNotes}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer"
              >
                <Trash2 size={12} />
                مسح المحدد
              </button>
            </div>
          )}
        </div>
  );
};
