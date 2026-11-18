import { randomId } from '../../common/utils/random';

// Test data lives here, never inside specs.
// Pattern: defaults + a factory that adds unique values per run + overrides,
// so tests don't collide on a shared environment.

export interface UserData {
  name: string;
  email: string;
}

// TODO(config): defaults for your system
export const userDefaults: UserData = {
  name: 'QA Automation',
  email: 'qa.automation@example.com'
};

export function createUserData(overrides: Partial<UserData> = {}): UserData {
  const id = randomId();
  return {
    ...userDefaults,
    name: `${userDefaults.name} ${id}`,
    email: `qa.automation+${id}@example.com`,
    ...overrides
  };
}
