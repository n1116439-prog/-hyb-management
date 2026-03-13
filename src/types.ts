export enum CourseStatus {
  PLENTY = 'PLENTY',
  TIGHT = 'TIGHT',
  FULL = 'FULL',
  SOON_FULL = 'SOON_FULL'
}

export interface CourseChangeLog {
  id: string;
  type: 'student_add' | 'student_remove' | 'coach_add' | 'coach_remove' | 'info_update';
  content: string;
  operator: string;
  timestamp: string;
}

export interface AttendanceRecord {
  [studentName: string]: 'present' | 'absent' | 'excused' | 'pending';
}

export interface Course {
  id: string;
  name: string;
  category: 'children' | 'adult';
  schedule: string;
  time: string;
  location: string;
  coaches: string[];
  thumbnail: string;
  currentEnrollment: number;
  maxEnrollment: number;
  waitlistCount?: number;
  price: number;
  description: string;
  tags: string[];
  students?: string[];
  changeLogs?: CourseChangeLog[];
  dates?: string[];
  attendance?: { [date: string]: AttendanceRecord };
  lastClassDate?: string;
  hasAttendance?: boolean;
  needsAttendance?: boolean;
}

export interface WaitlistEntry {
  id: string;
  courseId: string;
  courseName: string;
  contactName: string;
  phone: string;
  students: {
    name: string;
    age: string;
    experience: string;
  }[];
  note?: string;
  date: string;
  status: 'waiting' | 'called' | 'expired';
}

export interface SessionUsage {
  id: string;
  date: string;
  time: string;
  location: string;
  courseName: string;
  status: 'present' | 'absent' | 'excused';
}

export interface Session {
  id: string;
  courseName: string;
  studentName: string;
  schedule: string;
  remaining: number;
  total: number;
  expiryDate: string;
  paymentStatus: 'paid' | 'unpaid';
  paymentMethod?: string;
  registrationType?: 'trial' | 'official';
  registrationDate?: string;
  status: 'active' | 'waiting' | 'completed';
  phone?: string;
  usageHistory?: SessionUsage[];
}

export interface AdminStats {
  totalStudents: number;
  totalStudentsGrowth: number;
  todayCourses: number;
  todayCoursesStatus: string;
  monthlyRevenue: number;
  monthlyRevenueGrowth: number;
  averageAttendance: number;
  averageAttendanceTrend: number;
}

export interface TrendData {
  month: string;
  count: number;
}

export interface Notification {
  id: number;
  type: 'contract_expiry' | 'credits_low' | 'unpaid' | 'waitlist' | 'new_enrollment' | 'schedule_change';
  title: string;
  message: string;
  time: string;
  read: boolean;
  actionLabel: string | null;
  actionDone: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface NotificationSettings {
  [type: string]: {
    enabled: boolean;
    daysBefore?: number;
    threshold?: number;
    daysAfter?: number;
  };
}

export interface ContractSlot {
  day: string;
  time: string;
  courts: string;
}

export interface WeeklyScheduleItem {
  dateStr: string;
  weekday: string;
  timeSlots: string[];
  paused: boolean;
  note: string;
}

export interface ContractPhoto {
  name: string;
  url: string;
}

export interface ContractLog {
  time: string;
  type: 'created' | 'renewed' | 'edit_venue' | 'edit_address' | 'edit_dates' | 'edit_rent' | 'edit_paid' | 'edit_type' | 'edit_slots' | 'edit_schedule_pause' | 'edit_schedule_resume' | 'edit_photos';
  desc?: string;
  from?: string;
  to?: string;
}

export interface VenueContract {
  id: number;
  venue: string;
  address: string;
  startDate: string;
  endDate: string;
  rent: number;
  paid: boolean;
  contractType: string;
  slots: ContractSlot[];
  schedule: WeeklyScheduleItem[];
  photos: ContractPhoto[];
  logs: ContractLog[];
  daysUntilExpiry: number;
}

export interface Participant {
  name: string;
  gender: string;
  birthday: string;
}

export interface RegistrationData {
  phone: string;
  email: string;
  emergencyContact: string;
  emergencyPhone: string;
  hasInjury: boolean;
  injuryDetail: string;
  source: string;
  type: 'trial' | 'official';
  category: 'children' | 'adult';
  planId: string;
  count: number;
  participants: Participant[];
  location: string;
  courseId: string;
  trialDate: string;
  note: string;
}
