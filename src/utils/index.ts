import { DeepPartial } from "./DeepPartial";

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