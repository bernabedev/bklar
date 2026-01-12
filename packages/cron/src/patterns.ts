export const Patterns = {
  EVERY_SECOND: "* * * * * *",
  EVERY_MINUTE: "* * * * *",
  EVERY_HOUR: "0 * * * *",
  EVERY_DAY_AT_MIDNIGHT: "0 0 * * *",
  EVERY_MONDAY: "0 0 * * 1",
  EVERY_MONTH: "0 0 1 * *",
  EVERY_YEAR: "0 0 1 1 *",
} as const;
