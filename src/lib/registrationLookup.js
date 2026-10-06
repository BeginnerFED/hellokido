import { supabase } from './supabase';

// Bir telefon numarası hangi kayıtta kullanılıyor?
//
// Veli telefonu tüm kayıtlarda (arşiv dahil) tekildir. Aynı numarayla ikinci kayıt
// açılmak istendiğinde yalnızca "bu numara kayıtlı" denmesi çıkmaz sokaktı: kayıt çoğu
// zaman arşivdeydi ve listede aranınca bulunamıyordu. Mesaj, numaranın sahibini ve
// arşivde olup olmadığını söyler.
export const findRegistrationByPhone = async (phone) => {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, student_name, is_active')
    .eq('parent_phone', phone)
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
};

export const phoneInUseMessage = (owner, language) => {
  if (!owner) {
    return language === 'tr'
      ? 'Bu telefon numarası ile daha önce kayıt yapılmış!'
      : 'This phone number has already been registered!';
  }

  if (owner.is_active) {
    return language === 'tr'
      ? `Bu telefon numarası "${owner.student_name}" kaydında kullanılıyor.`
      : `This phone number is already used by the record of "${owner.student_name}".`;
  }

  return language === 'tr'
    ? `Bu telefon numarası arşivdeki "${owner.student_name}" kaydında kullanılıyor. Filtrelerden arşivi açıp kaydı aktifleştirebilirsiniz.`
    : `This phone number is used by the archived record of "${owner.student_name}". Open the archive from the filters to reactivate it.`;
};

// Benzersiz telefon kısıtı hatası mı? (doğrudan yazmada da, RPC içinden de aynı gelir)
export const isDuplicatePhoneError = (error) =>
  error?.code === '23505' &&
  `${error.details || ''} ${error.message || ''}`.includes('parent_phone');
