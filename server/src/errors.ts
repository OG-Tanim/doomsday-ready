export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "DUPLICATE_TITLE"
  | "DUPLICATE_NAME"
  | "CIRCULAR_DEPENDENCY";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}
