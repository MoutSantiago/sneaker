export interface ErrorResponse {
  statusCode: number;
  message: string | string[] | object;
  details?: unknown;
}
