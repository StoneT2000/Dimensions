import { strip } from "colors"

export const stripFunctions = (object: Object) => {
  let seen = new Set<Object>();
  const helper = (object: Object) => {
    for (let key in object) {
      if (!seen.has(key)) {
        seen.add(key);
        if (typeof object[key] === 'function' || object[key].constructor.name === 'Array') {
          delete object[key]
        }
        helper(object[key]);
      }
    }
    return object;
  }
  return helper(object);
}