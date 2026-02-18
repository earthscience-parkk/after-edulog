export interface Student {
  id: string;
  name: string;
  number: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  students: Student[];
}

export interface ActivityRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  classId: string;
  className: string;
  type: string;
  content: string;
  timestamp: number;
}

export type ViewMode = 'main' | 'recent';
