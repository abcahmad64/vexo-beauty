import { AuthController } from './auth.controller';

describe('AuthController password-auth boundary', () => {
  it('does not expose public customer registration', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        AuthController.prototype,
        'register',
      ),
    ).toBe(false);
  });

  it('keeps privileged password login available', () => {
    expect(
      Object.prototype.hasOwnProperty.call(AuthController.prototype, 'login'),
    ).toBe(true);
  });
});
