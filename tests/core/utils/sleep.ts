export const sleep = async (time: number) => {
  return new Promise((res) => {
    setTimeout(() => {
      res();
    }, time);
  });
};
