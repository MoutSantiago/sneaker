import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function createHost() {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as any;
  const request = { method: 'GET', url: '/test' } as any;
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as any;
  return { response, request, host };
}

describe('HttpExceptionFilter', () => {
  it('debe estandarizar una HttpException con mensaje de string', () => {
    const filter = new HttpExceptionFilter();
    const { response, host } = createHost();
    const exception = new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Usuario no encontrado',
    });
  });

  it('debe incluir details cuando la excepción los provee', () => {
    const filter = new HttpExceptionFilter();
    const { response, host } = createHost();
    const exception = new HttpException(
      {
        message: 'Datos inválidos',
        details: { email: 'ya está en uso' },
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Datos inválidos',
      details: { email: 'ya está en uso' },
    });
  });

  it('debe mapear Prisma P2025 (registro no encontrado) a 404 sin depender del cliente generado', () => {
    const filter = new HttpExceptionFilter();
    const { response, host } = createHost();
    const exception = { code: 'P2025', message: 'Registro no encontrado' } as any;

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Registro no encontrado',
    });
  });

  it('debe mapear Prisma P2002 (unique) a 409', () => {
    const filter = new HttpExceptionFilter();
    const { response, host } = createHost();
    const exception = { code: 'P2002', message: 'Unique constraint' } as any;

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      message: 'Ya existe un registro con ese valor único',
    });
  });

  it('debe devolver 500 para errores fatales de Prisma por su nombre', () => {
    const filter = new HttpExceptionFilter();
    const { response, host } = createHost();
    const exception = { name: 'PrismaClientRustPanicError', message: 'panic' } as any;

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor',
    });
  });

  it('debe devolver 500 para errores genéricos del servidor', () => {
    const filter = new HttpExceptionFilter();
    const { response, host } = createHost();
    const exception = new Error('Algo falló');

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Algo falló',
    });
  });

  it('debe devolver 500 para valores lanzados que no son Error', () => {
    const filter = new HttpExceptionFilter();
    const { response, host } = createHost();

    filter.catch('cadena lanzada', host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor',
    });
  });
});
