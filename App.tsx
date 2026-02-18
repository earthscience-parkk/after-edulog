import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BookOpen, Clock, ChevronLeft, Save, Sparkles, 
  Settings, RefreshCw, Search, X, ChevronRight, Edit2, Loader2, Copy 
} from 'lucide-react';
import { ClassGroup, Student, ActivityRecord, ViewMode } from './types';
import { polishRecord } from './services/geminiService';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editingRecord, setEditingRecord] = useState<ActivityRecord | null>(null);
  
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string>(localStorage.getItem('edulog_sheet_url') || '');
  
  const [isConnected, setIsConnected] = useState<boolean>(!!localStorage.getItem('edulog_sheet_url'));
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'success' | 'info' | 'error' } | null>(null);

  const [content, setContent] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishStatus, setPolishStatus] = useState('AI 문체 변환');
  const [searchQuery, setSearchQuery] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (sheetUrl) fetchClasses();
    const saved = localStorage.getItem('edulog_records');
    if (saved) setRecords(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('edulog_records', JSON.stringify(records));
  }, [records]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchClasses = async (urlOverride?: string) => {
    const targetUrl = (urlOverride || sheetUrl).trim();
    if (!targetUrl) return;
    setIsLoading(true);
    try {
      const response = await fetch(targetUrl);
      const data = await response.json();
      if (Array.isArray(data)) {
        setClasses(data);
        setIsConnected(true);
        localStorage.setItem('edulog_sheet_url', targetUrl);
      }
    } catch (error) {
      setIsConnected(false);
      showToast('명단 불러오기 실패', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('edulog_sheet_url', sheetUrl);
    fetchClasses();
    setIsSettingsOpen(false);
    showToast('설정이 저장되었습니다.');
  };

  const activeClass = classes.find(c => c.id === selectedClassId);
  const filteredClasses = useMemo(() => classes.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())), [classes, searchQuery]);
  const filteredStudents = useMemo(() => activeClass ? activeClass.students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || String(s.number).includes(searchQuery)) : [], [activeClass, searchQuery]);

  const groupedRecords = useMemo(() => {
    const groups: { [key: string]: ActivityRecord[] } = {};
    records.forEach(r => {
      const date = new Date(r.timestamp).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
      if (!groups[date]) groups[date] = [];
      groups[date].push(r);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [records]);

  const handleOpenLog = (student: Student) => {
    setSelectedStudent(student);
    setEditingRecord(null);
    setContent('');
    setSearchQuery('');
    setPolishStatus('AI 문체 변환');
    setIsLogModalOpen(true);
  };

  const handleEditRecord = (record: ActivityRecord) => {
    setEditingRecord(record);
    setContent(record.content);
    setSelectedStudent({id: record.studentId, name: record.studentName, number: record.studentNumber});
    setIsLogModalOpen(true);
  };

  const handleSaveRecord = async () => {
    if (!selectedStudent || !content.trim() || isPolishing) return;
    
    const currentContent = content.trim();
    const currentStudent = { ...selectedStudent };
    const currentClassName = activeClass?.name || editingRecord?.className || '2-1';

    if (editingRecord) {
      setRecords(records.map(r => r.id === editingRecord.id ? { ...r, content: currentContent } : r));
      showToast('수정 완료');
    } else {
      const newRecord: ActivityRecord = {
        id: crypto.randomUUID(),
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        studentNumber: currentStudent.number,
        classId: selectedClassId || '',
        className: currentClassName,
        type: '관찰',
        content: currentContent,
        timestamp: Date.now()
      };
      setRecords([newRecord, ...records]);
      showToast('로컬 저장 완료');
    }
    
    setIsLogModalOpen(false);

    if (sheetUrl && !editingRecord) {
      setIsSyncing(true);
      try {
        await fetch(sheetUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({
            className: currentClassName,
            studentNumber: currentStudent.number,
            studentName: currentStudent.name,
            type: '관찰',
            content: currentContent
          })
        });
        showToast('구글 시트 전송 성공', 'success');
      } catch (e) {
        showToast('시트 전송 실패', 'error');
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleAIPolish = async () => {
    if (!content.trim() || isPolishing) return;
    setIsPolishing(true);
    setPolishStatus('다듬는 중...');
    try {
      const polished = await polishRecord(content);
      setContent(polished);
      showToast('AI 변환 성공');
    } catch (e: any) {
      showToast(e.message || 'AI 변환 실패', 'error');
    } finally {
      setIsPolishing(false);
      setPolishStatus('AI 문체 변환');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('복사되었습니다.');
  };

  return (
    <div className="min-h-screen max-w-2xl mx-auto bg-[#f8fafc] flex flex-col shadow-2xl relative overflow-hidden font-['Pretendard'] text-slate-900">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[110] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 text-white font-bold text-sm
            ${toastMessage.type === 'success' ? 'bg-[#5c4be2]' : toastMessage.type === 'error' ? 'bg-rose-500' : 'bg-slate-800'}`}>
            {toastMessage.text}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-[#5c4be2] text-white px-6 py-6 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
             <BookOpen size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">에듀로그 (EduLog)</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-slate-400'}`}></div>
              <span className="text-[11px] font-bold text-indigo-100">{isConnected ? '연결됨' : '미연결'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode(viewMode === 'main' ? 'recent' : 'main')} className="p-3 hover:bg-white/10 rounded-full transition-all"><Clock size={24} /></button>
          <button onClick={() => fetchClasses()} className="p-3 hover:bg-white/10 rounded-full transition-all"><RefreshCw size={24} className={isLoading ? "animate-spin" : ""} /></button>
          <button onClick={() => setIsSettingsOpen(true)} className="p-3 hover:bg-white/10 rounded-full transition-all"><Settings size={24} /></button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto no-scrollbar pb-24">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400 gap-4">
            <Loader2 size={40} className="animate-spin text-[#5c4be2]" />
            <p className="font-bold">데이터를 불러오는 중...</p>
          </div>
        ) : !selectedClassId && viewMode === 'main' ? (
          <div className="space-y-6">
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              <input 
                type="text" placeholder="학급 이름을 입력하세요..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border-2 border-slate-50 rounded-[1.5rem] py-5 pl-14 pr-6 outline-none font-bold text-slate-700 shadow-[0_4px_12px_rgba(0,0,0,0.03)] focus:border-[#5c4be2]/30"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredClasses.map(c => (
                <button key={c.id} onClick={() => setSelectedClassId(c.id)} className="bg-white p-7 rounded-[2rem] shadow-sm border border-slate-50 hover:shadow-md transition-all text-left flex items-center justify-between group">
                  <div><h3 className="font-black text-slate-800 text-2xl">{c.name}</h3><p className="text-sm text-slate-400 font-bold mt-1">{c.students.length}명의 학생</p></div>
                  <ChevronRight className="text-slate-200 group-hover:text-[#5c4be2]" size={24} />
                </button>
              ))}
            </div>
          </div>
        ) : selectedClassId && viewMode === 'main' ? (
          <div className="space-y-6">
            <button onClick={() => setSelectedClassId(null)} className="flex items-center gap-2 text-slate-400 font-bold hover:text-[#5c4be2]"><ChevronLeft size={20} /> 학급 목록으로</button>
            <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 gap-3">
              {filteredStudents.map(student => (
                <button key={student.id} onClick={() => handleOpenLog(student)} className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm hover:border-[#5c4be2] transition-all flex flex-col items-center gap-2 group">
                  <div className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 font-black text-sm group-hover:text-[#5c4be2]">{student.number}</div>
                  <span className="font-black text-slate-700 text-sm truncate w-full text-center">{student.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedRecords.map(([date, dateRecords]) => (
              <div key={date} className="space-y-4">
                <div className="flex items-center gap-3"><span className="bg-[#5c4be2]/10 text-[#5c4be2] px-4 py-1 rounded-full text-xs font-black">{date}</span><div className="flex-1 h-px bg-slate-100"></div></div>
                <div className="grid gap-4">{dateRecords.map(record => (
                  <div key={record.id} className="bg-white p-6 rounded-[2rem] border border-slate-50 shadow-sm flex flex-col gap-3 group">
                    <div className="flex justify-between items-start"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center font-black text-[#5c4be2] text-sm">{record.studentNumber}</div><div><span className="font-black text-slate-800 text-lg">{record.studentName}</span><span className="ml-2 text-[11px] font-bold text-slate-300">{record.className}</span></div></div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100"><button onClick={() => handleCopy(record.content)} className="p-2 text-slate-400 hover:text-[#5c4be2]"><Copy size={18} /></button><button onClick={() => handleEditRecord(record)} className="p-2 text-slate-400 hover:text-emerald-500"><Edit2 size={18} /></button></div></div>
                    <p className="text-slate-600 font-medium text-sm leading-relaxed">{record.content}</p>
                  </div>
                ))}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <Settings className="text-[#5c4be2]" size={32} />
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">연동 설정</h2>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-3 text-slate-300 hover:bg-slate-50 rounded-full transition-all"><X size={32} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 space-y-12 no-scrollbar">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-8 bg-[#5c4be2] rounded-full"></div>
                  <h3 className="text-2xl font-black text-slate-800">구글 시트 연동</h3>
                </div>
                {/* 🚀 FIXED: JSX 파싱 에러 방지를 위해 기호를 중괄호 문자열로 랩핑하거나 특수문자 사용 */}
                <div className="bg-[#f8fafc] p-8 rounded-[2rem] border border-slate-100 space-y-4 text-[15px] font-medium leading-relaxed text-slate-600">
                  구글 시트의 [배포] {"\u2192"} [웹 앱 URL]을 아래 칸에 붙여넣으세요.
                </div>
                <div className="space-y-3">
                  <label className="text-[12px] font-black text-slate-400 px-1 uppercase tracking-widest">구글 시트 웹 앱 URL</label>
                  <input type="text" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" className="w-full p-6 bg-white border-2 border-slate-100 rounded-[2.5rem] outline-none font-bold text-slate-700 focus:border-[#5c4be2] shadow-sm transition-all" />
                </div>
              </div>
            </div>
            <div className="p-10 bg-white border-t border-slate-50">
              <button onClick={handleSaveSettings} className="w-full py-6 bg-[#5c4be2] text-white rounded-[1.5rem] font-black text-xl shadow-[0_15px_35px_-10px_rgba(92,75,226,0.5)] active:scale-[0.98] transition-all">설정 저장하기</button>
            </div>
          </div>
        </div>
      )}

      {/* Record Modal - UI 정밀 구현 */}
      {isLogModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[4px] z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xl rounded-[4rem] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden relative border border-slate-50/50">
            <div className="p-10 pb-4 flex justify-between items-start">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-[#6366f1] rounded-full flex items-center justify-center text-white font-black text-2xl shadow-xl border-[4px] border-indigo-50/20">
                  {selectedStudent.number}
                </div>
                <div className="flex flex-col">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-tight">{selectedStudent.name}</h2>
                  <p className="text-[14px] text-[#6366f1] font-bold mt-0.5">
                    {activeClass?.name || editingRecord?.className || '2-1'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsLogModalOpen(false)} className="p-3 bg-slate-50/50 text-slate-300 hover:text-rose-500 rounded-full transition-all">
                <X size={36} strokeWidth={2.5} />
              </button>
            </div>

            <div className="px-10 py-6 space-y-12">
              <div className="relative group">
                <textarea 
                  ref={textareaRef} autoFocus disabled={isPolishing} value={content} onChange={(e) => setContent(e.target.value)} 
                  className="w-full h-80 p-12 bg-[#f8fafc] border-none rounded-[3.5rem] outline-none text-slate-700 font-bold text-xl leading-relaxed resize-none disabled:opacity-50 transition-all placeholder:text-slate-200 shadow-inner"
                  placeholder="활동 메모를 입력하세요..."
                />
                <div className="absolute bottom-10 right-10">
                  <button onClick={handleAIPolish} disabled={isPolishing || !content.trim()} 
                          className="flex items-center gap-2.5 px-8 py-4 bg-[#eff6ff] text-[#5c4be2] rounded-[1.5rem] text-[16px] font-black shadow-sm active:scale-95 disabled:opacity-30 transition-all border border-indigo-50/50">
                    {isPolishing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                    {polishStatus}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pb-10">
                <button onClick={() => setIsLogModalOpen(false)} className="px-10 py-4 text-slate-400 font-black text-3xl hover:text-slate-600 transition-all tracking-tight">
                  취소
                </button>
                <button onClick={handleSaveRecord} disabled={!content.trim() || isPolishing} 
                        className="flex-1 bg-white border border-slate-100/50 py-7 rounded-full font-black text-slate-700 text-3xl flex items-center justify-center gap-3 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.08)] active:scale-95 disabled:opacity-50 hover:bg-slate-50 transition-all">
                   <Save size={32} className="text-[#5c4be2]" /> 
                   <span>시트에 저장</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSyncing && (
        <div className="fixed bottom-10 right-10 z-[100] animate-bounce">
          <div className="bg-emerald-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 text-xs font-black tracking-widest">
            <RefreshCw size={16} className="animate-spin" /> SYNCING...
          </div>
        </div>
      )}
    </div>
  );
};

export default App;