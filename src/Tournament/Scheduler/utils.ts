// uses resovoir sampling
export const chooseKRandomElements = <T>(arr: Array<T>, k: number) => {
  let reservoir: Array<T> = [];
  // put the first num into reservoir
  for (let i = 0; i < k; i++) {
    reservoir.push(arr[i]);
  }
  for (let i = k; i < arr.length; i++) {
    let j = Math.floor(Math.random() * i);
    if (j < k) {
      reservoir[j] = arr[i];
    }
  }
  return reservoir;
};
