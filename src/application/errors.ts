export class ApplicationError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues?: Array<{ path: string; message: string }>
  ) {
    super(message);
  }
}

export function forbidden(message = "Action is not permitted"): never {
  throw new ApplicationError(403, "forbidden", message);
}

export function notFound(message = "Record was not found"): never {
  throw new ApplicationError(404, "not_found", message);
}

export function conflict(message = "The record has changed; reload and try again"): never {
  throw new ApplicationError(409, "stale_write", message);
}

export function invalid(path: string, message: string): never {
  throw new ApplicationError(400, "invalid_request", message, [{ path, message }]);
}

export function invalidMany(
  message: string,
  issues: Array<{ path: string; message: string }>
): never {
  throw new ApplicationError(400, "content_incomplete", message, issues);
}
