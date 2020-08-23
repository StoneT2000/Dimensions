export const sleep = async (time: number): Promise<void> => {
  return new Promise((res) => {
    setTimeout(() => {
      res();
    }, time);
  });
};
