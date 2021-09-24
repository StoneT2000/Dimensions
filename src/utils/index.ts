import { customAlphabet } from 'nanoid';
export type NanoID = string; // make opaque

/**
 * Pick stuff
 * @param obj - object to pick out from
 * @param params - fields to pick out
 */
export const pick = <T, K extends keyof T>(
  obj: T,
  ...params: Array<K>
): Pick<T, K> => {
  const picked: any = {};
  params.forEach((key) => {
    picked[key] = obj[key];
  });

  return picked;
};

const ALPHA_NUM_STRING =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Map from length to id generator for that length
const idGenFunctionMap: Map<number, () => NanoID> = new Map();
for (let i = 4; i <= 22; i++) {
  idGenFunctionMap.set(i, customAlphabet(ALPHA_NUM_STRING, i));
}

/**
 * Generate unique IDs using nanoid
 * @param n - length of id
 */
export const genID = (n: number): NanoID => {
  return idGenFunctionMap.get(n)();
};
/**
 * Async function that resolves after `ms` milliseconds
 * @param ms - number of milliseconds to sleep for
 */
export const sleep = async (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop = (): void => {};
