import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoAccount, matchesPassword, publicProfile, registeredAccounts, validateRegistration } from './demoAccounts.js';

const details = { name: ' Test learner ', email: ' Learner@example.com ', password: 'Demo-test-123!' };

test('registration rejects duplicate emails regardless of whitespace and casing', () => {
  assert.equal(validateRegistration(details, [{ email: 'learner@example.com' }]), 'duplicate');
  assert.equal(validateRegistration({ ...details, name: ' ' }, []), 'name');
  assert.equal(validateRegistration({ ...details, email: 'invalid' }, []), 'email');
  assert.equal(validateRegistration({ ...details, password: 'short' }, []), 'password');
});

test('registered credentials survive storage, reject wrong passwords and omit secrets from profiles', async () => {
  const account = await createDemoAccount({ ...details, role: 'admin' });
  const [restored] = registeredAccounts(JSON.parse(JSON.stringify([account])));
  assert.equal(restored.email, 'learner@example.com');
  assert.equal(restored.name, 'Test learner');
  assert.equal(restored.role, 'user');
  assert.equal(restored.password, undefined);
  assert.equal(await matchesPassword(restored, details.password), true);
  assert.equal(await matchesPassword(restored, 'incorrect'), false);
  assert.deepEqual(Object.keys(publicProfile(restored)), ['id', 'name', 'email', 'role']);
  const other = await createDemoAccount(details);
  assert.notEqual(account.passwordHash, other.passwordHash);
});

test('stored registrations cannot replace built-in demo accounts or grant admin role', () => {
  const account = { id: 'new-user', name: 'Learner', email: 'learner@example.com', salt: 'salt', passwordHash: 'a'.repeat(64), role: 'admin' };
  assert.equal(registeredAccounts([{ ...account, id: 'admin' }]).length, 0);
  assert.equal(registeredAccounts([{ ...account, id: 'student' }]).length, 0);
  assert.equal(registeredAccounts([null, {}, account])[0].role, 'user');
  assert.deepEqual(registeredAccounts({}), []);
});
