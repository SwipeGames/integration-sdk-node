import type { ZodError } from "zod";
import type { ErrorResponse } from "../types/common.js";

export class SwipeGamesApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: string;

  constructor(status: number, body: ErrorResponse) {
    super(body.message);
    this.name = "SwipeGamesApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

export class SwipeGamesValidationError extends Error {
  public readonly zodError: ZodError;

  constructor(zodError: ZodError) {
    super(`Validation failed: ${zodError.message}`);
    this.name = "SwipeGamesValidationError";
    this.zodError = zodError;
  }
}
