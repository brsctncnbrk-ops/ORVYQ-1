export class OrvyqError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'OrvyqError';
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      ok: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : {details: this.details})
      }
    };
  }
}

export function invariant(condition, code, message, details = undefined) {
  if (!condition) throw new OrvyqError(code, message, details);
}

export function asOrvyqError(error) {
  if (error instanceof OrvyqError) return error;
  return new OrvyqError('UNEXPECTED_ERROR', error instanceof Error ? error.message : String(error));
}
