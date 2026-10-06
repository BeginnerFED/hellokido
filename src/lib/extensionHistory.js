// Uzatma geçmişi satırlarını ekranda gösterilecek haline getirir.
//
// Bir uzatmanın ödemesi iki yerde durur: uzatma satırında ve gelir defterindeki
// (financial_records) bağlı satırda. "Kayıt Güncelle" ile yapılan düzeltmeler (ör. kartla
// alınan ödemenin bankaya geçtiği günün yazılması) yıllarca yalnızca gelir defterine
// işlendi; geçmiş ekranı ise uzatma satırını gösterdiği için eski bilgiyi göstermeye devam
// etti ve "uzatmayı düzenle" o eski bilgiyi gelir defterine geri yazdı.
// Kural: ödeme bilgisinde gelir defteri esastır; en son uzatmanın paket bilgisinde ise
// kaydın kendisi (karttaki güncel paket) esastır.

// Uzatmaya bağlı en yeni gelir satırı (yoksa null)
const newestLedgerRow = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return [...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
};

// rows: created_at'e göre eskiden yeniye sıralı extension_history satırları
// (financial_records ilişkisiyle birlikte okunmuş)
export const resolveExtensionHistory = (registration, rows) =>
  (rows || []).map((row, index, all) => {
    const resolved = { ...row };

    const ledger = newestLedgerRow(row.financial_records);
    if (ledger) {
      resolved.payment_status = ledger.payment_status;
      resolved.payment_method = ledger.payment_method;
      resolved.payment_amount = ledger.amount;
      resolved.payment_date = ledger.payment_date;
    }

    // En son uzatma güncel paketi anlatır. Ücretsiz katılıma çevrilmiş kayıtta dokunulmaz:
    // o satır, çevrilmeden önceki ücretli paketi gösterir.
    const isLast = index === all.length - 1;
    if (isLast && registration && registration.package_type !== 'ucretsiz') {
      resolved.new_package_type = registration.package_type;
      resolved.new_start_date = registration.package_start_date;
      resolved.new_end_date = registration.package_end_date;
      resolved.notes = registration.notes;
    }

    return resolved;
  });
