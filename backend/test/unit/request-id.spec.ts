import { RequestIdMiddleware } from '../../src/common/middleware/request-id.middleware';
import { validate as validateUuid } from 'uuid';

describe('RequestIdMiddleware (BE-1-014)', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  it('preserves an existing valid UUID X-Request-Id', () => {
    const validId = 'a55545a1-5b72-4638-9cf8-6a3f4ff19299';
    const req: any = { headers: { 'x-request-id': validId } };
    const res: any = { setHeader: jest.fn() };
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.requestId).toBe(validId);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', validId);
    expect(next).toHaveBeenCalled();
  });

  it('replaces an invalid or non-UUID X-Request-Id with a generated UUID v4', () => {
    const invalidId = 'invalid-not-a-uuid-12345';
    const req: any = { headers: { 'x-request-id': invalidId } };
    const res: any = { setHeader: jest.fn() };
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.requestId).not.toBe(invalidId);
    expect(validateUuid(req.requestId)).toBe(true);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
    expect(next).toHaveBeenCalled();
  });

  it('generates a fresh UUID v4 when X-Request-Id header is omitted', () => {
    const req: any = { headers: {} };
    const res: any = { setHeader: jest.fn() };
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(validateUuid(req.requestId)).toBe(true);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
    expect(next).toHaveBeenCalled();
  });
});
