import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../../src/common/constants/error-codes';

describe('AllExceptionsFilter (BE-1-015)', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('maps custom HttpException to contract-compliant ErrorResponse', () => {
    const status = HttpStatus.CONFLICT;
    const exception = new HttpException(
      {
        code: ERROR_CODES.VERSION_CONFLICT,
        message: 'Aggregate was modified by another transaction.',
      },
      status,
    );

    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    const setHeaderMock = jest.fn();

    const hostMock: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          requestId: 'test-req-id-1234',
          url: '/api/v1/jobs/1',
          method: 'PATCH',
          headers: {},
        }),
        getResponse: () => ({
          status: statusMock,
          setHeader: setHeaderMock,
        }),
      }),
    };

    filter.catch(exception, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(setHeaderMock).toHaveBeenCalledWith('X-Request-Id', 'test-req-id-1234');
    expect(jsonMock).toHaveBeenCalledWith({
      error: {
        code: ERROR_CODES.VERSION_CONFLICT,
        message: 'Aggregate was modified by another transaction.',
        requestId: 'test-req-id-1234',
        timestamp: expect.any(String),
      },
    });
  });

  it('maps unhandled generic Error to 500 INTERNAL_ERROR without leaking details or stack traces', () => {
    const exception = new Error('Database password failed: db_secret_12345');

    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    const setHeaderMock = jest.fn();

    const hostMock: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          requestId: 'test-req-id-5678',
          url: '/api/v1/auth/login',
          method: 'POST',
          headers: {},
        }),
        getResponse: () => ({
          status: statusMock,
          setHeader: setHeaderMock,
        }),
      }),
    };

    filter.catch(exception, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith({
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'An unexpected internal error occurred.',
        requestId: 'test-req-id-5678',
        timestamp: expect.any(String),
      },
    });
    expect(JSON.stringify(jsonMock.mock.calls[0][0])).not.toContain('db_secret_12345');
  });
});
