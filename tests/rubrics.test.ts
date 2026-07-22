import { describe, expect, it } from 'vitest';
import { getRubric, rubrics, validateRubrics } from '../src/rubrics/index.js';

describe('TrailGenic rubrics', () => {
  it('contains all eight category rubrics with valid weights', () => {
    expect(Object.keys(rubrics)).toHaveLength(8);
    expect(() => validateRubrics()).not.toThrow();
  });

  it('keeps category-specific dimensions', () => {
    expect(getRubric('electrolytes').dimensions.some((item) => item.key === 'sodium-delivery')).toBe(true);
    expect(getRubric('backpacks').dimensions.some((item) => item.key === 'sodium-delivery')).toBe(false);
  });
});
