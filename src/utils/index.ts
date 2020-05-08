import { DeepPartial } from "./DeepPartial";
import { customAlphabet } from "nanoid";
import { NanoID } from "../Dimension";

/**
 * Pick stuff
 * @param obj - object to pick out from
 * @param params - fields to pick out
 */
export const pick = <T>(obj: T, ...params: Array<keyof T>): DeepPartial<T> => {
  let picked: any = {};
  params.forEach((key) => {
    picked[key] = obj[key];
  })
  
  return (<DeepPartial<T>>picked);
}


const ALPHA_NUM_STRING = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Map from length to id generator for that length
const idGenFunctionMap: Map<number, () => NanoID> = new Map();
for (let i = 4; i <= 22; i++) {
  idGenFunctionMap.set(i, customAlphabet(ALPHA_NUM_STRING, i));
}

/**
 * Generate unique IDs using nanoid
 * @param n - length of id
 */
export const genID = (n: number) => {
  return idGenFunctionMap.get(n)();
}