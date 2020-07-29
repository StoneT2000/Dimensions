import { DeepPartial } from "./DeepPartial";
import { customAlphabet } from "nanoid";
import { NanoID } from "../Dimension";
import { deepCopy } from "./DeepCopy";

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

export const stripFunctions = <T extends { [x in string]: any}>(object: T): T => {
  let seen = new Set<Object>();
  const helper = (object: T): T => {
    for (let key in object) {
      if (!seen.has(key)) {
        seen.add(key);
        if (typeof object[key] === 'function') {
          delete object[key]
          continue;
        }
        else if (object[key] !== null && object[key] !== undefined && object[key].constructor.name === 'Array') {
          continue;
        }
        helper(object[key]);
      }
    }
    return object;
  }
  return helper(object);
}

export const stripNull = <T extends { [x in string]: any}>(object: T): T => {
  let seen = new Set<Object>();
  const helper = (object: T): T => {
    for (let key in object) {
      if (!seen.has(key)) {
        seen.add(key);
        if (object[key] === null) {
          delete object[key];
        }
        else {
          helper(object[key]);
        }
      }
    }
    return object;
  }
  return helper(object);
}

/**
 * Async function that resolves after `ms` milliseconds
 * @param ms - number of milliseconds to sleep for
 */
export const sleep = async (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  })
}