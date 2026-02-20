import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { useApi, useFormValidation, useGesture, useLocalStorage } from '../hooks';

describe('custom hooks', () => {
  it('persists values with useLocalStorage', async () => {
    const { result } = renderHook(() => useLocalStorage('test:key', 'initial', {
      parse: (value) => value,
      stringify: (value) => value,
    }));

    act(() => {
      result.current[1]('updated');
    });

    expect(result.current[0]).toBe('updated');
  });

  it('validates forms with zod schema', () => {
    const schema = z.object({ email: z.string().email() });
    const { result } = renderHook(() => useFormValidation(schema, { email: '' }));

    let validationResult = false;
    act(() => {
      validationResult = result.current.validate();
    });

    expect(validationResult).toBe(false);
    expect(result.current.errors.email).toBeTruthy();
  });

  it('supports optimistic updates and rollback with useApi', async () => {
    const fetcher = vi.fn(async () => ({ value: 1 }));
    const { result } = renderHook(() => useApi(fetcher));

    await act(async () => {
      await result.current.run();
    });

    await expect(
      act(async () =>
        result.current.mutate(
          async () => {
            throw new Error('failed mutation');
          },
          {
            optimisticData: { value: 2 },
            rollbackData: { value: 1 },
          }
        )
      )
    ).rejects.toThrow('failed mutation');

    expect(result.current.data).toEqual({ value: 1 });
  });

  it('detects swipe gestures', () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() => useGesture({ onSwipeLeft }));

    act(() => {
      result.current.onPointerDown({ clientX: 100, clientY: 10 } as any);
      result.current.onPointerUp({ clientX: 20, clientY: 12 } as any);
    });

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });
});
