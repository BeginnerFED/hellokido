/** A message with plural forms; Ukrainian uses one/few/many, Turkish and English one/other. */
export type Plural = { one?: string; few?: string; many?: string; other: string }

/** The shape every translation of a message group must have (Turkish is the source). */
export type Widen<T> = T extends string ? string : T extends Plural ? Plural : { [K in keyof T]: Widen<T[K]> }
