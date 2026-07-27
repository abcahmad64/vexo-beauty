import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

type RequestWithAuthenticatedUser = {
  user?: AuthenticatedUser;
};

export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedUser | undefined,
    context: ExecutionContext,
  ):
    | AuthenticatedUser
    | AuthenticatedUser[keyof AuthenticatedUser]
    | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithAuthenticatedUser>();

    const user = request.user;

    if (!data) {
      return user;
    }

    return user?.[data];
  },
);
