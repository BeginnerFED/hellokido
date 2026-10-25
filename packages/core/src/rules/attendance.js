// Katılım durumlarıyla ilgili ortak kurallar (yönetim takvimi, ana sayfa ve herkese açık takvim
// aynı sayıyı göstersin diye tek yerde tutulur).

// Derste yer tutan durumlar: planlanan, telafiye gelen ve katılan öğrenci.
// Erteleyen, gelmeyen ve iptal edilen öğrenci kontenjandan düşülür.
export const SEAT_HOLDING_STATUSES = ['scheduled', 'makeup', 'attended'];

export const holdsSeat = (status) => SEAT_HOLDING_STATUSES.includes(status);

// Yoklaması işlenmiş durumlar: öğrencinin ders hakkından düşer (bkz. lessonUsage.js).
// Böyle bir satır silinirse kullanılan ders öğrenciye geri eklenmiş olur.
export const RECORDED_ATTENDANCE_STATUSES = ['attended', 'no_show'];

export const isRecordedAttendance = (status) => RECORDED_ATTENDANCE_STATUSES.includes(status);

// Yoklaması unutulmuş katılım: dersin günü geçtiği halde hâlâ 'scheduled' duruyor.
// Bugünkü dersler sayılmaz; onların yoklaması gün içinde işaretlenir. Böyle bir satır ders
// hakkından düşmez, bu yüzden öğrencinin kalan dersi olduğundan fazla görünür.
export const isAttendanceOverdue = (status, eventDate, now = new Date()) => {
  if (status !== 'scheduled' || !eventDate) return false;

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  return new Date(eventDate) < todayStart;
};

// Durum adları (ana sayfadaki düğmelerle aynı sözcükler)
export const ATTENDANCE_STATUS_LABELS = {
  scheduled: { tr: 'Planlandı', en: 'Scheduled' },
  attended: { tr: 'Katıldı', en: 'Joined' },
  no_show: { tr: 'Gelmedi', en: 'Absent' },
  postponed: { tr: 'Ertelendi', en: 'Delayed' },
  makeup: { tr: 'Telafi', en: 'Makeup' },
  cancelled: { tr: 'İptal', en: 'Canceled' }
};

// Ekranlardan seçilebilen durumlar ('cancelled' hiçbir ekrandan verilmiyor)
export const ATTENDANCE_STATUS_OPTIONS = ['scheduled', 'attended', 'no_show', 'postponed', 'makeup'];

export const attendanceStatusLabel = (status, language) => {
  const labels = ATTENDANCE_STATUS_LABELS[status];
  if (!labels) return status || '';
  return language === 'tr' ? labels.tr : labels.en;
};
