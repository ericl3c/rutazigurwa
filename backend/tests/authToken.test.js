const { issueToken, verifyToken } = require('../src/services/authToken');

describe('bearer authentication tokens', () => {
  const originalSecret = process.env.AUTH_TOKEN_SECRET;

  beforeAll(() => {
    process.env.AUTH_TOKEN_SECRET = 'test-auth-token-secret';
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.AUTH_TOKEN_SECRET;
    else process.env.AUTH_TOKEN_SECRET = originalSecret;
  });

  test('validates tokens for their matching role and user', () => {
    const token = issueToken('admin', 42);

    expect(verifyToken(token, 'admin')).toEqual({ id: 42 });
    expect(verifyToken(token, 'member')).toBeNull();
  });

  test('rejects tampered and malformed tokens', () => {
    const token = issueToken('member', 7);

    expect(verifyToken(`${token}x`, 'member')).toBeNull();
    expect(verifyToken('not-a-token', 'member')).toBeNull();
  });
});
