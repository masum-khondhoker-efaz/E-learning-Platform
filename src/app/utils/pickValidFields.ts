export const pickValidFields = (obj: Record<string, any>, keys: string[]) => {
  const result: Record<string, any> = {};
  
  keys.forEach((key) => {
    if (obj && Object.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  });
  
  return result;
};