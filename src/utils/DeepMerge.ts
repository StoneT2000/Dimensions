/**
 * Performs a deep merge of two objects and returns the merged
 * @param obj1 - first object to merge into
 * @param obj2 - the second object to use to merge into the first
 * @param clobberArrays - whether or not to replace arrays or merge them together by appending obj2's array to obj1's
 */
export const deepMerge = (
  obj1: any,
  obj2: any,
  clobberArrays = false
) => {
  if (obj2 == undefined || obj2 == null) return obj1;
  const rootKeys = Object.keys(obj2);

  rootKeys.forEach((key: string) => {
    // if obj2 field is not an object and not an array, override obj1
    if (
      typeof obj2[key] !== 'object' &&
      obj2[key] &&
      obj2[key].constructor.name !== 'Array'
    ) {
      obj1[key] = obj2[key];
    }

    // otherwise if obj2 field is an array and the same field in obj1 is also an array
    else if (
      obj2[key] &&
      obj2[key].constructor.name == 'Array' &&
      obj1[key] &&
      obj1[key].constructor.name == 'Array'
    ) {
      // replacce array if clobberArrays is set to true
      if (clobberArrays) {
        obj1[key] = obj2[key];
      }
      // then merge the arrays if clobberArrays is false
      else {
        obj1[key].push(...obj2[key]);
      }
    } else {
      if (obj1[key] && typeof obj1[key] === 'object') {
        //If object 1 also shares a the same key as object 2 and is also an object, proceed with recursion
        obj1[key] = deepMerge(obj1[key], obj2[key], clobberArrays);
      } else {
        //Otherwise, overwrite
        obj1[key] = obj2[key];
      }
    }
  });
  return obj1;
};
