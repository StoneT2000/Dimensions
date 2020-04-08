/**
 * Makes every field in object T a partial type (optional)
 * @template T
 */
export type DeepPartial<T> = T extends object ? 
  (T extends Function ? T : { [K in keyof T]?: DeepPartial<T[K]> }) : T;