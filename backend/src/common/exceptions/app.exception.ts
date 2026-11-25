import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Excepción personalizada que permite adjuntar `details` opcional.
 * Se integra con el filtro global de excepciones para mantener el formato:
 * { statusCode, message, details? }
 */
export class AppException extends HttpException {
  constructor(message: string, statusCode = HttpStatus.INTERNAL_SERVER_ERROR, details?: unknown) {
    super(
      {
        message,
        ...(details !== undefined ? { details } : {}),
      },
      statusCode,
    );
  }
}
