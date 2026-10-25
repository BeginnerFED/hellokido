import { addDays, startOfDay } from 'date-fns'

/** The day card money taken on `paymentDate` reaches the bank, `days` after (Settings › Card payments). */
export const arrivalOf = (paymentDate: string, days: number) => startOfDay(addDays(new Date(paymentDate), days))
