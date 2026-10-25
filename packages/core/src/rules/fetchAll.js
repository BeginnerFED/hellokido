// PostgREST tek istekte en çok 1000 satır döndürür (Supabase proje ayarı). Daha uzun
// listeler hata vermeden, sessizce kesilir. Bu yardımcı sorguyu sayfa sayfa çalıştırıp
// bütün satırları toplar.
//
// buildQuery: her sayfa için YENİ bir sorgu döndüren fonksiyon. Sayfalar arasında satır
// atlanmaması için sorgu, benzersiz bir sütunla (ör. id) biten bir sıralama içermelidir.
const PAGE_SIZE = 1000;

export const fetchAllRows = async (buildQuery, pageSize = PAGE_SIZE) => {
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;

    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
};
