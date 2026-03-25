import { describe, it, expect, vi } from 'vitest';

// Mock prisma to prevent env validation from firing
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { hasWriteAccess, isWorkspaceOwner, type CoalUser } from '@/lib/privy';

// Minimal User shape for testing role helpers
function fakeUser(overrides: Partial<CoalUser> = {}): CoalUser {
  return {
    id: 'user_owner',
    email: 'owner@test.com',
    name: 'Owner',
    privyDid: null,
    payoutAddress: null,
    emailVerified: true,
    image: null,
    webhookUrl: null,
    webhookSecret: null,
    onboardingComplete: true,
    onboardingStep: 7,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CoalUser;
}

describe('hasWriteAccess', () => {
  it('returns true for direct account owner (no _callerRole)', () => {
    const user = fakeUser();
    expect(hasWriteAccess(user)).toBe(true);
  });

  it('returns true for workspace owner (_callerRole = "owner")', () => {
    const user = fakeUser({ _callerId: 'caller_1', _callerRole: 'owner' });
    expect(hasWriteAccess(user)).toBe(true);
  });

  it('returns true for admin (_callerRole = "admin")', () => {
    const user = fakeUser({ _callerId: 'caller_2', _callerRole: 'admin' });
    expect(hasWriteAccess(user)).toBe(true);
  });

  it('returns false for member (_callerRole = "member")', () => {
    const user = fakeUser({ _callerId: 'caller_3', _callerRole: 'member' });
    expect(hasWriteAccess(user)).toBe(false);
  });

  it('returns false for viewer (_callerRole = "viewer")', () => {
    const user = fakeUser({ _callerId: 'caller_4', _callerRole: 'viewer' });
    expect(hasWriteAccess(user)).toBe(false);
  });

  it('returns false for any unknown role', () => {
    const user = fakeUser({ _callerId: 'caller_5', _callerRole: 'guest' });
    expect(hasWriteAccess(user)).toBe(false);
  });
});

describe('isWorkspaceOwner', () => {
  it('returns true for direct account owner (no _callerRole)', () => {
    const user = fakeUser();
    expect(isWorkspaceOwner(user)).toBe(true);
  });

  it('returns true for _callerRole = "owner"', () => {
    const user = fakeUser({ _callerId: 'caller_1', _callerRole: 'owner' });
    expect(isWorkspaceOwner(user)).toBe(true);
  });

  it('returns false for admin', () => {
    const user = fakeUser({ _callerId: 'caller_2', _callerRole: 'admin' });
    expect(isWorkspaceOwner(user)).toBe(false);
  });

  it('returns false for member', () => {
    const user = fakeUser({ _callerId: 'caller_3', _callerRole: 'member' });
    expect(isWorkspaceOwner(user)).toBe(false);
  });

  it('returns false for viewer', () => {
    const user = fakeUser({ _callerId: 'caller_4', _callerRole: 'viewer' });
    expect(isWorkspaceOwner(user)).toBe(false);
  });
});
