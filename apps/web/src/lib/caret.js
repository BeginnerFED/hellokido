import { flushSync } from 'react-dom';

// Yazılırken düzeltilen alanlar (baş harf büyütme, yalnızca rakam) için onChange yardımcısı.
//
// Düzeltilmiş metin tarayıcının az önce yazdığından farklıysa React değeri yeniden yazar ve
// imleç alanın sonuna atlar; metnin ortasında yapılan düzeltme bozulur. Burada değer hemen
// (flushSync) yazılır ve imleç, yazılan yere geri konur.
//
// transform: yazılan metni düzelten saf fonksiyon (ör. capitalizeName, phoneDigits)
// commit: düzeltilmiş değeri state'e yazan fonksiyon
export const changeKeepingCaret = (event, transform, commit) => {
  const input = event.target;
  const typed = input.value;
  const caret = input.selectionStart;
  const next = transform(typed);

  if (next === typed || caret === null || document.activeElement !== input) {
    commit(next);
    return;
  }

  const nextCaret = transform(typed.slice(0, caret)).length;
  flushSync(() => commit(next));
  input.setSelectionRange(nextCaret, nextCaret);
};
