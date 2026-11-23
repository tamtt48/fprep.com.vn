import { getSupabaseServerClient, verifySessionToken } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { 
  GraduationCap, Bell, Calendar, BookOpen, Users, 
  Clock, CheckCircle, ChevronRight, Award, MessageSquare,
  FileText, ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import AnnouncementManager from './AnnouncementManager';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export default async function TeacherDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('supabase-jwt')?.value || '';
  if (!token) {
    redirect('/');
  }

  const payload = verifySessionToken(token);
  if (!payload || !payload.sub) {
    redirect('/');
  }

  const teacherId = payload.sub;
  const teacherEmail = payload.email || '';

  const supabase = await getSupabaseServerClient();

  // 1. TỐI ƯU TRUY VẤN SONG SONG BẰNG PROMISE.ALL
  const [
    profileRes,
    assignmentsRes,
    supportRequestsRes,
    announcementsRes
  ] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', teacherId).single(),
    supabase.from('teacher_classes').select('*, classes(*), subjects(*)').eq('teacher_id', teacherId),
    supabase.from('support_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('announcements').select('*').or(`target_type.eq.all,target_type.eq.teachers,and(target_type.eq.individual,target_user_id.eq.${teacherId}),target_type.is.null`).order('created_at', { ascending: false })
  ]);

  const userRole = profileRes.data?.role || 'teacher';
  const assignments = assignmentsRes.data || [];
  const announcements = announcementsRes.data || [];

  const classIds = assignments.map((a: any) => a.class_id).filter(Boolean);
  const subjectIds = assignments.map((a: any) => a.subject_id).filter(Boolean);

  // 2. Truy vấn học sinh & học liệu thuộc các lớp phụ trách
  const [studentsRes, chaptersRes] = await Promise.all([
    supabase.from('student_details').select('*, classes(*)').in('class_id', classIds.length > 0 ? classIds : [crypto.randomUUID()]),
    supabase.from('chapters').select('*, lessons(*, lesson_materials(*))').in('subject_id', subjectIds.length > 0 ? subjectIds : [crypto.randomUUID()])
  ]);

  const students = studentsRes.data || [];
  const studentIds = students.map((s: any) => s.student_id);
  const chapters = chaptersRes.data || [];

  let totalLessonsCount = 0;
  let totalMaterialsCount = 0;
  chapters.forEach((chap: any) => {
    totalLessonsCount += chap.lessons?.length || 0;
    chap.lessons?.forEach((les: any) => {
      totalMaterialsCount += les.lesson_materials?.length || 0;
    });
  });

  // 3. Tiến độ gần đây của học sinh
  let recentProgressWithNames: any[] = [];
  if (studentIds.length > 0) {
    const { data: recentProgress } = await supabase
      .from('study_progress')
      .select('*, lessons(*, chapters(*, subjects(*)))')
      .in('student_id', studentIds)
      .eq('completed', true)
      .order('last_accessed_at', { ascending: false })
      .limit(4);

    recentProgressWithNames = (recentProgress || []).map((prog: any) => {
      const student = students.find((s: any) => s.student_id === prog.student_id);
      return {
        ...prog,
        student_name: student?.full_name || 'Học sinh',
        class_name: student?.classes?.name || ''
      };
    });
  }

  return (
    <div className="space-y-6 w-full animate-fade-in font-body">
      
      {/* 1. WELCOME BANNER CHUẨN FPT AI LEARNING - FUTURE BLUE 2.0 */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#0B1B55] via-[#1746D1] to-[#087CFF] text-white p-6 sm:p-8 shadow-xl shadow-blue-900/10 border border-white/10">
        {/* Glow ambient background elements */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-[#00DFFF]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#0B1B55]/60 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md px-3.5 py-1 text-xs font-bold text-cyan-200 border border-white/20">
              <GraduationCap className="h-4 w-4 text-[#00DFFF]" /> 
              <span>Giáo viên &bull; THPT FPT Cần Thơ</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-heading text-white tracking-tight m-0">
              Xin chào Thầy/Cô!
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 font-medium leading-relaxed m-0">
              Hệ thống quản lý học tập thông minh FPREP &bull; Quản lý lớp học, phân công đề thi và theo dõi tiến độ học sinh.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs font-semibold text-blue-200">
              <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-lg border border-white/10">
                Môn phụ trách: <strong className="text-white font-bold">{Array.from(new Set(assignments.map((a: any) => a.subjects?.name).filter(Boolean))).join(', ') || 'Chưa phân công'}</strong>
              </span>
              <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-lg border border-white/10">
                Lớp giảng dạy: <strong className="text-white font-bold">{Array.from(new Set(assignments.map((a: any) => a.classes?.name).filter(Boolean))).join(', ') || 'Chưa phân lớp'}</strong>
              </span>
            </div>
          </div>

          {/* STATS SUMMARY WIDGETS */}
          <div className="flex gap-4 sm:gap-6 border-t md:border-t-0 md:border-l border-white/20 pt-4 md:pt-0 md:pl-8 shrink-0">
            <div className="text-center bg-white/10 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/15">
              <span className="block text-2xl sm:text-3xl font-extrabold font-heading text-[#00DFFF]">
                {assignments.length}
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-blue-100 uppercase tracking-wider">Lớp phụ trách</span>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/15">
              <span className="block text-2xl sm:text-3xl font-extrabold font-heading text-white">
                {students.length}
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-blue-100 uppercase tracking-wider">Tổng học sinh</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12 items-start">
        
        {/* CỘT TRÁI: THÔNG BÁO VÀ TIỆN ÍCH */}
        <div className="md:col-span-8 space-y-6">
          
          <div className="bg-white dark:bg-[#0B1B55]/90 border border-[#E2E8F0] dark:border-[#1B317A] rounded-2xl p-5 sm:p-6 shadow-sm">
            <AnnouncementManager
              initialAnnouncements={announcements}
              userRole={userRole}
              token={token}
              userEmail={teacherEmail}
            />
          </div>

          {/* CÔNG CỤ THAO TÁC NHANH CHO GIÁO VIÊN */}
          <div className="bg-white dark:bg-[#0B1B55]/90 border border-[#E2E8F0] dark:border-[#1B317A] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold font-heading flex items-center gap-2 border-b border-[#E2E8F0] dark:border-[#1B317A] pb-3 m-0 text-[#14213D] dark:text-white">
              <BookOpen className="h-4.5 w-4.5 text-[#1746D1] dark:text-cyan-400" /> Truy cập nhanh
            </h2>
            <div className="grid gap-3.5 sm:grid-cols-3">
              <Link href="/dashboard/teacher/students" className="p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1B317A] bg-[#F8FAFC] dark:bg-[#0D226B]/40 hover:bg-[#EEF4FF] dark:hover:bg-[#0D226B] hover:border-[#087CFF] flex items-center gap-3.5 transition-all group">
                <div className="w-11 h-11 rounded-xl bg-[#1746D1]/10 text-[#1746D1] dark:bg-cyan-500/20 dark:text-cyan-300 flex items-center justify-center shrink-0 border border-[#1746D1]/20 group-hover:scale-105 transition-transform">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#14213D] dark:text-white group-hover:text-[#1746D1] dark:group-hover:text-cyan-300 transition-colors m-0">Quản lý học sinh</h4>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 m-0">Theo dõi tiến độ</p>
                </div>
              </Link>

              <Link href="/dashboard/teacher/materials" className="p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1B317A] bg-[#F8FAFC] dark:bg-[#0D226B]/40 hover:bg-[#EEF4FF] dark:hover:bg-[#0D226B] hover:border-[#16A36A] flex items-center gap-3.5 transition-all group">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#14213D] dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors m-0">Quản lý học liệu</h4>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 m-0">Bài giảng & đề thi</p>
                </div>
              </Link>

              <Link href="/dashboard/teacher/support" className="p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1B317A] bg-[#F8FAFC] dark:bg-[#0D226B]/40 hover:bg-[#EEF4FF] dark:hover:bg-[#0D226B] hover:border-[#E9A23B] flex items-center gap-3.5 transition-all group">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 group-hover:scale-105 transition-transform">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#14213D] dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors m-0">Hỏi đáp học sinh</h4>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 m-0">Giải đáp thắc mắc</p>
                </div>
              </Link>
            </div>
          </div>

        </div>

        {/* CỘT PHẢI: HOẠT ĐỘNG HỌC TẬP GẦN ĐÂY CỦA HỌC SINH */}
        <div className="md:col-span-4 space-y-6">
          <div className="bg-white dark:bg-[#0B1B55]/90 border border-[#E2E8F0] dark:border-[#1B317A] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold font-heading flex items-center gap-2 border-b border-[#E2E8F0] dark:border-[#1B317A] pb-3 m-0 text-[#14213D] dark:text-white">
              <Clock className="h-4.5 w-4.5 text-[#1746D1] dark:text-cyan-400" /> Hoạt động gần đây
            </h2>

            {recentProgressWithNames.length === 0 ? (
              <p className="text-xs text-[#64748B] italic m-0">Chưa có hoạt động.</p>
            ) : (
              <div className="space-y-3">
                {recentProgressWithNames.map((prog: any) => (
                  <div key={prog.id} className="p-3.5 bg-[#F8FAFC] dark:bg-[#0D226B]/50 hover:bg-[#EEF4FF] dark:hover:bg-[#0D226B] rounded-xl border border-[#E2E8F0] dark:border-[#1B317A] hover:border-[#087CFF] flex items-start gap-3 transition-all">
                    <div className="h-8 w-8 rounded-full bg-[#1746D1]/10 text-[#1746D1] dark:bg-cyan-500/20 dark:text-cyan-300 border border-[#1746D1]/20 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                      {prog.student_name?.[0]?.toUpperCase() || 'H'}
                    </div>
                    <div className="min-w-0 space-y-1 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-[#14213D] dark:text-white">{prog.student_name}</span>
                        {prog.class_name && (
                          <span className="text-[10px] bg-[#E7F1FF] text-[#1746D1] dark:bg-cyan-500/20 dark:text-cyan-300 font-bold px-1.5 py-0.5 rounded border border-[#B6D4FE] dark:border-cyan-400/30">{prog.class_name}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#475569] dark:text-slate-300 truncate m-0">{prog.lessons?.title}</p>
                      <span className="inline-block text-[10px] text-[#16A36A] dark:text-emerald-400 font-bold">Hoàn thành</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
