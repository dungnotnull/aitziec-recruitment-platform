import { AuthenticatedUser } from '../decorators/current-user.decorator';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthenticatedUser {}
    interface Request {
      requestId?: string;
      traceId?: string;
      user?: AuthenticatedUser;
    }
  }
}
