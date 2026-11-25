import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ErrorResponse } from '../interfaces/error-response.interface';

/**
 * Nombres de errores graves del cliente de Prisma (no traen `code` de prisma).
 */
const PRISMA_FATAL_ERROR_NAMES = [
  'PrismaClientUnknownRequestError',
  'PrismaClientInitializationError',
  'PrismaClientRustPanicError',
];

/**
 * Filtro global de excepciones. Estandariza la salida de TODOS los errores
 * (NestJS, Prisma, servidor y custom) al formato:
 *
 * {
 *   statusCode: number,
 *   message: string | string[] | object,
 *   details?: unknown
 * }
 *
 * Registrarse como provider global con APP_FILTER en AppModule.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception);

    this.logger.error(
      `${request.method} ${request.url} ${errorResponse.statusCode} - ${JSON.stringify(errorResponse.message)}`,
    );

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(exception: unknown): ErrorResponse {
    // 1. Excepciones de NestJS (HttpException y sus hijas: BadRequest, NotFound, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      let message: ErrorResponse['message'] = 'Error';
      let details: unknown;

      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        message = (res as { message?: unknown }).message ?? 'Error';
        details = (res as { details?: unknown }).details;
      }

      return {
        statusCode: status,
        message,
        ...(details !== undefined ? { details } : {}),
      };
    }

    // 2. Prisma: errores conocidos (tienen código de prisma, ej. P2002, P2025...)
    const prismaError = exception as { code?: string; message?: string } | undefined;
    if (prismaError && typeof prismaError.code === 'string') {
      switch (prismaError.code) {
        case 'P2002':
          return {
            statusCode: HttpStatus.CONFLICT,
            message: 'Ya existe un registro con ese valor único',
          };
        case 'P2025':
          return {
            statusCode: HttpStatus.NOT_FOUND,
            message: 'Registro no encontrado',
          };
        case 'P2003':
          return {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Violación de llave foránea',
          };
        case 'P2014':
          return {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Violación de restricción de base de datos',
          };
        default:
          return {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: prismaError.message || 'Error de base de datos',
          };
      }
    }

    // 3. Prisma: errores desconocidos, de inicialización o panic del motor
    const errorName = (exception as { name?: string } | undefined)?.name;
    if (errorName && PRISMA_FATAL_ERROR_NAMES.includes(errorName)) {
      this.logger.error(exception);
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno del servidor',
      };
    }

    // 4. Error genérico de JavaScript / Node
    if (exception instanceof Error) {
      this.logger.error(exception);
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message || 'Error interno del servidor',
      };
    }

    // 5. Cualquier otro valor lanzado (throw 'string', throw 42, etc.)
    this.logger.error(exception);
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor',
    };
  }
}
