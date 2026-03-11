import { Course, Session, VenueContract, Notification, NotificationSettings } from './types';

export const NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    type: 'contract_expiry',
    title: '合約到期提醒',
    message: '景新國小場館合約將於 30 天後到期，請安排續約。',
    time: '2026/03/05 10:00',
    read: false,
    actionLabel: '前往續約',
    actionDone: false,
    priority: 'high'
  },
  {
    id: 2,
    type: 'credits_low',
    title: '堂數不足提醒',
    message: '學員「王小美」剩餘堂數僅剩 3 堂，建議發送續報通知。',
    time: '2026/03/05 09:30',
    read: false,
    actionLabel: '發送續報通知',
    actionDone: false,
    priority: 'medium'
  },
  {
    id: 3,
    type: 'unpaid',
    title: '未繳費提醒',
    message: '學員「李大華」報名青少年羽球基礎班已超過 7 天未繳費。',
    time: '2026/03/04 15:00',
    read: true,
    actionLabel: '發送催繳通知',
    actionDone: true,
    priority: 'medium'
  },
  {
    id: 4,
    type: 'waitlist',
    title: '候補上線通知',
    message: '中和 [景新國小] 週六班有名額釋出，候補學員「張小明」可遞補。',
    time: '2026/03/04 11:00',
    read: false,
    actionLabel: '通知學員上課',
    actionDone: false,
    priority: 'high'
  },
  {
    id: 5,
    type: 'new_enrollment',
    title: '新報名通知',
    message: '學員「陳小安」已正式報名成人羽球進階班。',
    time: '2026/03/03 14:20',
    read: true,
    actionLabel: null,
    actionDone: false,
    priority: 'low'
  },
  {
    id: 6,
    type: 'schedule_change',
    title: '課程異動通知',
    message: '林口 [頭湖國小] 週六班因場地維修，4/5 課程需暫停，請通知學員。',
    time: '2026/03/02 09:00',
    read: false,
    actionLabel: '前往通知群組',
    actionDone: false,
    priority: 'high'
  }
];

export const NOTIFICATION_SETTINGS: NotificationSettings = {
  contract_expiry: { enabled: true, daysBefore: 30 },
  credits_low: { enabled: true, threshold: 4 },
  unpaid: { enabled: true, daysAfter: 7 },
  waitlist: { enabled: true },
  new_enrollment: { enabled: true },
  schedule_change: { enabled: true }
};

export const CONTRACTS: VenueContract[] = [
  {
    id: '1',
    venue: '景新國小',
    address: '新北市中和區景新街 467 巷 37 號',
    startDate: '2024/01/01',
    endDate: '2024/06/30',
    rent: 45000,
    paid: true,
    contractType: '半年租',
    slots: [
      { day: '週六', time: '10:00-12:00', courts: '2 面' },
      { day: '週六', time: '18:00-20:00', courts: '羽球A場地' }
    ],
    schedule: [
      { dateStr: '2024/01/06', weekday: '週六', timeSlots: ['10:00-12:00', '18:00-20:00'], paused: false, note: '' },
      { dateStr: '2024/01/13', weekday: '週六', timeSlots: ['10:00-12:00', '18:00-20:00'], paused: false, note: '' },
      { dateStr: '2024/02/10', weekday: '週六', timeSlots: ['10:00-12:00', '18:00-20:00'], paused: true, note: '春節連假' }
    ],
    photos: [
      { name: '合約首頁.jpg', url: 'https://picsum.photos/seed/contract1/400/600' }
    ],
    logs: [
      { time: '2024/01/01 09:00', type: 'created', desc: '初始合約建立' }
    ],
    daysUntilExpiry: 118
  },
  {
    id: '2',
    venue: '頭湖國小',
    address: '新北市林口區民權路 101 號',
    startDate: '2024/01/01',
    endDate: '2024/12/31',
    rent: 120000,
    paid: false,
    contractType: '年租',
    slots: [
      { day: '週六', time: '14:00-16:00', courts: '3 面' },
      { day: '週六', time: '16:00-18:00', courts: '羽球B場地' }
    ],
    schedule: [
      { dateStr: '2024/01/06', weekday: '週六', timeSlots: ['14:00-16:00', '16:00-18:00'], paused: false, note: '' }
    ],
    photos: [],
    logs: [
      { time: '2024/01/01 10:00', type: 'created', desc: '初始合約建立' }
    ],
    daysUntilExpiry: 302
  },
  {
    id: '3',
    venue: '江翠國小',
    address: '新北市板橋區文化路二段 413 號',
    startDate: '2024/01/01',
    endDate: '2024/03/31',
    rent: 35000,
    paid: true,
    contractType: '季租',
    slots: [
      { day: '週六', time: '10:00-12:00', courts: '2 面' }
    ],
    schedule: [],
    photos: [],
    logs: [],
    daysUntilExpiry: 26
  }
];

export const COURSES: Course[] = [
  {
    id: '1',
    name: '林口 [頭湖國小] 週六 14:00-16:00',
    category: 'children',
    schedule: '週六',
    time: '14:00 – 16:00',
    location: '林口 [頭湖國小]',
    coaches: ['王教練', '陳教練', '李教練', '張教練'],
    thumbnail: 'https://picsum.photos/seed/bad1/200/200',
    currentEnrollment: 12,
    maxEnrollment: 24,
    price: 3200,
    description: '林口頭湖國小羽球課程，適合各年齡層。',
    tags: ['林口', '週六'],
    students: ['王小明', '李小華', '張小芬', '陳大文', '林小美', '趙小強', '孫小龍', '周小涵', '吳小優', '鄭小剛', '馮小雲', '褚小衛'],
    changeLogs: [
      { id: 'log1', type: 'student_add', content: '新增學員：王小明', operator: 'Admin', timestamp: '2024-03-01 10:00' },
      { id: 'log2', type: 'coach_add', content: '新增教練：王教練', operator: 'Admin', timestamp: '2024-03-01 10:05' }
    ],
    dates: ['2024/03/02', '2024/03/09', '2024/03/16', '2024/03/23', '2024/03/30', '2024/04/06', '2024/04/13', '2024/04/20', '2024/04/27', '2024/05/04'],
    attendance: {
      '2024/03/02': {
        '王小明': 'present', '李小華': 'present', '張小芬': 'absent', '陳大文': 'present', '林小美': 'excused', '趙小強': 'present', '孫小龍': 'present', '周小涵': 'present', '吳小優': 'present', '鄭小剛': 'present', '馮小雲': 'present', '褚小衛': 'present'
      },
      '2024/03/09': {
        '王小明': 'present', '李小華': 'present', '張小芬': 'present', '陳大文': 'present', '林小美': 'present', '趙小強': 'present', '孫小龍': 'present', '周小涵': 'present', '吳小優': 'present', '鄭小剛': 'present', '馮小雲': 'present', '褚小衛': 'present'
      }
    }
  },
  {
    id: '2',
    name: '林口 [頭湖國小] 週六 16:00-18:00 招生中',
    category: 'children',
    schedule: '週六',
    time: '16:00 – 18:00',
    location: '林口 [頭湖國小]',
    coaches: ['王教練', '陳教練', '李教練', '張教練'],
    thumbnail: 'https://picsum.photos/seed/bad2/200/200',
    currentEnrollment: 24,
    maxEnrollment: 24,
    waitlistCount: 3,
    price: 3200,
    description: '熱烈招生中，歡迎加入。',
    tags: ['林口', '週六', '招生中']
  },
  {
    id: '3',
    name: '林口 [麗林國小] 週日 10:00-12:00',
    category: 'children',
    schedule: '週日',
    time: '10:00 – 12:00',
    location: '林口 [麗林國小]',
    coaches: ['李教練', '林教練', '黃教練', '吳教練'],
    thumbnail: 'https://picsum.photos/seed/bad3/200/200',
    currentEnrollment: 24,
    maxEnrollment: 24,
    waitlistCount: 5,
    price: 3200,
    description: '麗林國小早晨羽球課。',
    tags: ['林口', '週日']
  },
  {
    id: '4',
    name: '林口 [麗林國小] 週日 13:00-15:00',
    category: 'adult',
    schedule: '週日',
    time: '13:00 – 15:00',
    location: '林口 [麗林國小]',
    coaches: ['李教練', '林教練', '黃教練', '吳教練'],
    thumbnail: 'https://picsum.photos/seed/bad4/200/200',
    currentEnrollment: 8,
    maxEnrollment: 24,
    price: 3200,
    description: '麗林國小下午羽球課。',
    tags: ['林口', '週日']
  },
  {
    id: '5',
    name: '林口 [麗林國小] 週日 15:00-17:00',
    category: 'adult',
    schedule: '週日',
    time: '15:00 – 17:00',
    location: '林口 [麗林國小]',
    coaches: ['李教練', '林教練', '黃教練', '吳教練'],
    thumbnail: 'https://picsum.photos/seed/bad5/200/200',
    currentEnrollment: 6,
    maxEnrollment: 24,
    price: 3200,
    description: '麗林國小傍晚羽球課。',
    tags: ['林口', '週日']
  },
  {
    id: '6',
    name: '板橋 [江翠國小] 週六 10:00-12:00',
    category: 'children',
    schedule: '週六',
    time: '10:00 – 12:00',
    location: '板橋 [江翠國小]',
    coaches: ['張教練', '王教練', '陳教練', '李教練'],
    thumbnail: 'https://picsum.photos/seed/bad6/200/200',
    currentEnrollment: 24,
    maxEnrollment: 24,
    waitlistCount: 2,
    price: 3500,
    description: '板橋江翠國小週六上午班。',
    tags: ['板橋', '週六']
  },
  {
    id: '7',
    name: '永和 [永平國小] 週五 19:00-21:00',
    category: 'adult',
    schedule: '週五',
    time: '19:00 – 21:00',
    location: '永和 [永平國小]',
    coaches: ['陳教練', '李教練', '張教練', '王教練'],
    thumbnail: 'https://picsum.photos/seed/bad7/200/200',
    currentEnrollment: 24,
    maxEnrollment: 24,
    waitlistCount: 8,
    price: 3500,
    description: '永和永平國小週五晚間班。',
    tags: ['永和', '週五']
  },
  {
    id: '8',
    name: '永和 [永平國小] 週日 17:00-19:00',
    category: 'children',
    schedule: '週日',
    time: '17:00 – 19:00',
    location: '永和 [永平國小]',
    coaches: ['陳教練', '李教練', '張教練', '王教練'],
    thumbnail: 'https://picsum.photos/seed/bad8/200/200',
    currentEnrollment: 7,
    maxEnrollment: 24,
    price: 3500,
    description: '永和永平國小週日傍晚班。',
    tags: ['永和', '週日']
  },
  {
    id: '9',
    name: '中和 [景新國小] 週六 10:00-12:00 招生中',
    category: 'children',
    schedule: '週六',
    time: '10:00 – 12:00',
    location: '中和 [景新國小]',
    coaches: ['林教練', '黃教練', '吳教練', '李教練'],
    thumbnail: 'https://picsum.photos/seed/bad9/200/200',
    currentEnrollment: 8,
    maxEnrollment: 24,
    price: 3300,
    description: '中和景新國小招生中。',
    tags: ['中和', '週六', '招生中']
  },
  {
    id: '10',
    name: '中和 [景新國小] 週六 18:00-20:00',
    category: 'adult',
    schedule: '週六',
    time: '18:00 – 20:00',
    location: '中和 [景新國小]',
    coaches: ['林教練', '黃教練', '吳教練', '李教練'],
    thumbnail: 'https://picsum.photos/seed/bad10/200/200',
    currentEnrollment: 12,
    maxEnrollment: 24,
    price: 3300,
    description: '中和景新國小週六晚間班。',
    tags: ['中和', '週六']
  },
  {
    id: '11',
    name: '中和 [景新國小] 週日 18:00-20:00 招生中',
    category: 'adult',
    schedule: '週日',
    time: '18:00 – 20:00',
    location: '中和 [景新國小]',
    coaches: ['林教練', '黃教練', '吳教練', '李教練'],
    thumbnail: 'https://picsum.photos/seed/bad11/200/200',
    currentEnrollment: 4,
    maxEnrollment: 24,
    price: 3300,
    description: '中和景新國小週日晚間招生中。',
    tags: ['中和', '週日', '招生中']
  },
  {
    id: '12',
    name: '文山 [靜心國小] 週六 17:00-19:00',
    category: 'children',
    schedule: '週六',
    time: '17:00 – 19:00',
    location: '文山 [靜心國小]',
    coaches: ['黃教練', '吳教練', '李教練', '林教練'],
    thumbnail: 'https://picsum.photos/seed/bad12/200/200',
    currentEnrollment: 12,
    maxEnrollment: 24,
    price: 3800,
    description: '文山靜心國小週六晚間班。',
    tags: ['文山', '週六']
  },
  {
    id: '13',
    name: '文山 [景興國小] 週六 13:00-15:00',
    category: 'children',
    schedule: '週六',
    time: '13:00 – 15:00',
    location: '文山 [景興國小]',
    coaches: ['黃教練', '吳教練', '李教練', '林教練'],
    thumbnail: 'https://picsum.photos/seed/bad13/200/200',
    currentEnrollment: 9,
    maxEnrollment: 24,
    price: 3800,
    description: '文山景興國小週六下午班。',
    tags: ['文山', '週六']
  },
  {
    id: '14',
    name: '文山 [景興國小] 週日 13:00-15:00',
    category: 'adult',
    schedule: '週日',
    time: '13:00 – 15:00',
    location: '文山 [景興國小]',
    coaches: ['黃教練', '吳教練', '李教練', '林教練'],
    thumbnail: 'https://picsum.photos/seed/bad14/200/200',
    currentEnrollment: 11,
    maxEnrollment: 24,
    price: 3800,
    description: '文山景興國小週日下午班。',
    tags: ['文山', '週日']
  },
  {
    id: '15',
    name: '文山 [靜心國小] 週日 18:00-20:00',
    category: 'adult',
    schedule: '週日',
    time: '18:00 – 20:00',
    location: '文山 [靜心國小]',
    coaches: ['黃教練', '吳教練', '李教練', '林教練'],
    thumbnail: 'https://picsum.photos/seed/bad15/200/200',
    currentEnrollment: 6,
    maxEnrollment: 24,
    price: 3800,
    description: '文山靜心國小週日晚間班。',
    tags: ['文山', '週日']
  },
  {
    id: '16',
    name: '文山 [萬興國小] 週六 16:00-18:00',
    category: 'children',
    schedule: '週六',
    time: '16:00 – 18:00',
    location: '文山 [萬興國小]',
    coaches: ['黃教練', '吳教練', '李教練', '林教練'],
    thumbnail: 'https://picsum.photos/seed/bad16/200/200',
    currentEnrollment: 10,
    maxEnrollment: 24,
    price: 3800,
    description: '文山萬興國小週六下午班。',
    tags: ['文山', '週六']
  }
];

export const SESSIONS: Session[] = [
  {
    id: 's1',
    courseName: '林口 [頭湖國小] 週六 14:00-16:00',
    studentName: '王小美',
    schedule: '週六 14:00',
    remaining: 3,
    total: 20,
    expiryDate: '2024/12/31',
    paymentStatus: 'paid',
    status: 'active',
    phone: '0912-345-678',
    usageHistory: [
      { id: 'u1', date: '2024/02/24', time: '14:00-16:00', location: '林口 [頭湖國小]', courseName: '林口 [頭湖國小] 週六 14:00-16:00', status: 'present' },
      { id: 'u2', date: '2024/03/02', time: '14:00-16:00', location: '林口 [頭湖國小]', courseName: '林口 [頭湖國小] 週六 14:00-16:00', status: 'present' }
    ]
  },
  {
    id: 's2',
    courseName: '板橋 [江翠國小] 週六 10:00-12:00',
    studentName: '王小美',
    schedule: '週六 10:00',
    remaining: 12,
    total: 20,
    expiryDate: '2024/12/31',
    paymentStatus: 'paid',
    status: 'active',
    phone: '0912-345-678',
    usageHistory: [
      { id: 'u3', date: '2024/02/17', time: '10:00-12:00', location: '板橋 [江翠國小]', courseName: '板橋 [江翠國小] 週六 10:00-12:00', status: 'present' },
      { id: 'u4', date: '2024/02/24', time: '10:00-12:00', location: '板橋 [江翠國小]', courseName: '板橋 [江翠國小] 週六 10:00-12:00', status: 'present' },
      { id: 'u5', date: '2024/03/02', time: '10:00-12:00', location: '板橋 [江翠國小]', courseName: '板橋 [江翠國小] 週六 10:00-12:00', status: 'present' }
    ]
  },
  {
    id: 's3',
    courseName: '永和 [永平國小] 週五 19:00-21:00',
    studentName: '王小美',
    schedule: '週五 19:00',
    remaining: 6,
    total: 10,
    expiryDate: '2024/11/30',
    paymentStatus: 'unpaid',
    paymentMethod: '匯款',
    registrationType: 'official',
    registrationDate: '2024/10/15',
    status: 'active',
    phone: '0912-345-678',
    usageHistory: []
  }
];

export const ADMIN_STATS = {
  totalStudents: 238,
  totalStudentsGrowth: 12,
  todayCourses: 3,
  todayCoursesStatus: '穩定',
  monthlyRevenue: 420000,
  monthlyRevenueGrowth: 8.5,
  averageAttendance: 94,
  averageAttendanceTrend: 2
};

export const TREND_DATA = [
  { month: '10月', count: 120 },
  { month: '11月', count: 150 },
  { month: '12月', count: 180 },
  { month: '1月', count: 200 },
  { month: '2月', count: 220 },
  { month: '3月', count: 238 }
];

export const RECENT_REGISTRATIONS = [
  { id: 'r1', name: '王小美', course: '成人羽球進階班', type: 'trial', time: '2 小時前' },
  { id: 'r2', name: '李大華', course: '青少年羽球基礎班', type: 'official', time: '5 小時前' },
  { id: 'r3', name: '張小明', course: '兒童體適能趣味班', type: 'official', time: '1 天前' }
];

export const TODAY_SCHEDULE = [
  { id: 'ts1', time: '10:00', name: '板橋 [江翠國小] 羽球班', coaches: ['張教練', '王教練'], location: '體育館', status: 'ongoing' },
  { id: 'ts2', time: '14:00', name: '林口 [頭湖國小] 羽球班', coaches: ['王教練', '陳教練'], location: '體育館', status: 'pending' },
  { id: 'ts3', time: '19:00', name: '永和 [永平國小] 羽球班', coaches: ['陳教練', '李教練'], location: '體育館', status: 'pending' }
];
