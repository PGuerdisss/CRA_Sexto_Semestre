// Declarações de tipos globais do Jest e React Native Testing Library para o TypeScript
declare namespace jest {
  type Mock<T = any, Y extends any[] = any> = {
    (...args: Y): T;
    mockImplementation: (fn?: (...args: Y) => T) => Mock<T, Y>;
    mockImplementationOnce: (fn?: (...args: Y) => T) => Mock<T, Y>;
    mockReturnValue: (val: T) => Mock<T, Y>;
    mockReturnValueOnce: (val: T) => Mock<T, Y>;
    mockResolvedValue: (val: any) => Mock<T, Y>;
    mockResolvedValueOnce: (val: any) => Mock<T, Y>;
    mockRejectedValue: (val: any) => Mock<T, Y>;
    mockRejectedValueOnce: (val: any) => Mock<T, Y>;
    mockClear: () => void;
    mockReset: () => void;
    mockRestore: () => void;
    mock: {
      calls: Y[];
      results: { type: string; value: any }[];
    };
  };

  function fn<T = any, Y extends any[] = any>(
    implementation?: (...args: Y) => T
  ): Mock<T, Y> & any;
  function mock(moduleName: string, factory?: () => any, options?: any): any;
  function spyOn<T extends object, M extends keyof T>(
    object: T,
    method: M
  ): Mock<any, any>;
  function clearAllMocks(): void;
  function resetAllMocks(): void;
  function restoreAllMocks(): void;
}

declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare function test(name: string, fn: () => void | Promise<void>): void;
declare function beforeEach(fn: () => void | Promise<void>): void;
declare function afterEach(fn: () => void | Promise<void>): void;
declare function beforeAll(fn: () => void | Promise<void>): void;
declare function afterAll(fn: () => void | Promise<void>): void;

interface JestMatchers<R = any> {
  toBe(expected: any): R;
  toEqual(expected: any): R;
  toBeTruthy(): R;
  toBeFalsy(): R;
  toBeNull(): R;
  toBeDefined(): R;
  toBeUndefined(): R;
  toHaveLength(expected: number): R;
  toContain(expected: any): R;
  toHaveBeenCalled(): R;
  toHaveBeenCalledTimes(expected: number): R;
  toHaveBeenCalledWith(...args: any[]): R;
  toHaveBeenLastCalledWith(...args: any[]): R;
  toThrow(expected?: any): R;
  not: JestMatchers<R>;
  resolves: JestMatchers<Promise<R>>;
  rejects: JestMatchers<Promise<R>>;
}

interface ExpectFunction {
  <T = any>(actual: T): JestMatchers<T>;
  any(constructor: any): any;
  stringContaining(str: string): any;
  objectContaining(obj: Record<string, any>): any;
}

declare const expect: ExpectFunction;
declare var global: typeof globalThis & Record<string, any>;

declare module "@testing-library/react-native" {
  import { ReactElement } from "react";

  export interface RenderResult {
    getByText: (text: string | RegExp) => any;
    queryByText: (text: string | RegExp) => any;
    findByText: (text: string | RegExp) => Promise<any>;
    getByPlaceholderText: (text: string | RegExp) => any;
    queryByPlaceholderText: (text: string | RegExp) => any;
    getByDisplayValue: (value: string | RegExp) => any;
    getByTestId: (testId: string | RegExp) => any;
    queryByTestId: (testId: string | RegExp) => any;
    getAllByText: (text: string | RegExp) => any[];
    unmount: () => void;
    rerender: (ui: ReactElement) => void;
  }

  export function render(ui: ReactElement, options?: any): RenderResult;

  export const fireEvent: {
    (element: any, eventName: string, ...data: any[]): any;
    press: (element: any, ...data: any[]) => any;
    changeText: (element: any, text: string) => any;
    scroll: (element: any, eventData?: any) => any;
  };

  export function waitFor<T>(
    callback: () => T | Promise<T>,
    options?: { timeout?: number; interval?: number }
  ): Promise<T>;
}
