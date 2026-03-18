import { Course, Session, VenueContract } from './types';

export const CONTRACTS: VenueContract[] = [];

export const COURSES: Course[] = [];

export const SESSIONS: Session[] = [];

export const ADMIN_STATS = {
  totalStudents: 0,
  totalStudentsGrowth: 0,
  todayCourses: 0,
  todayCoursesStatus: '',
  monthlyRevenue: 0,
  monthlyRevenueGrowth: 0,
  averageAttendance: 0,
  averageAttendanceTrend: 0
};

export const TREND_DATA: { month: string; count: number }[] = [];

export const RECENT_REGISTRATIONS: { id: string; name: string; course: string; type: string; time: string }[] = [];

export const TODAY_SCHEDULE: { id: string; time: string; name: string; coaches: string[]; location: string; status: string }[] = [];
