export const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const randomString = (length = 8) => {
  return Math.random()
    .toString(36)
    .substring(2, length + 2);
};
