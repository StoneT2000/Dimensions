export const stripFunctions = (object: object): any => {
  const seen = new Set<string>();
  const helper = (object: Record<string, any>) => {
    for (const key in object) {
      if (!seen.has(key)) {
        seen.add(key);
        if (
          typeof object[key] === 'function' ||
          object[key].constructor.name === 'Array'
        ) {
          delete object[key];
        }
        helper(object[key]);
      }
    }
    return object;
  };
  return helper(object);
};
