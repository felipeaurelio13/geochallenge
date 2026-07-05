import React, { createContext, useContext, useId } from 'react';
import { Input } from '../atoms/Input';

type FormFieldContextValue = {
  fieldId: string;
  hasError: boolean;
  errorId: string;
  hintId: string;
  hasHint: boolean;
};

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

type FormFieldRootProps = {
  children: React.ReactNode;
  id?: string;
  error?: string;
  className?: string;
};

function Root({ children, id, error, className = '' }: FormFieldRootProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const hasError = Boolean(error);
  // `Hint` renders as a sibling of this provider's children, so we can't know
  // for certain whether one is present without inspecting children — check
  // for a `Hint`-shaped element to keep `aria-describedby` accurate.
  const hasHint = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && child.type === Hint
  );

  return (
    <FormFieldContext.Provider value={{ fieldId, hasError, errorId, hintId, hasHint }}>
      <div className={`space-y-2 ${className}`.trim()}>
        {children}
        {error ? (
          <p id={errorId} className="text-xs text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </FormFieldContext.Provider>
  );
}

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const context = useContext(FormFieldContext);

  return (
    <label htmlFor={context?.fieldId} className={`block text-sm font-medium text-app-secondary ${className}`.trim()}>
      {children}
    </label>
  );
}

type FormFieldInputProps = React.ComponentProps<typeof Input>;

const FieldInput = React.forwardRef<HTMLInputElement, FormFieldInputProps>(function FieldInput(props, ref) {
  const context = useContext(FormFieldContext);

  const describedByIds = [
    context?.hasError ? context.errorId : null,
    context?.hasHint ? context.hintId : null,
  ].filter(Boolean);

  return (
    <Input
      ref={ref}
      id={context?.fieldId}
      hasError={context?.hasError}
      aria-invalid={context?.hasError ? true : undefined}
      aria-describedby={describedByIds.length > 0 ? describedByIds.join(' ') : undefined}
      {...props}
    />
  );
});

function Hint({ children }: { children: React.ReactNode }) {
  const context = useContext(FormFieldContext);

  return (
    <p id={context?.hintId} className="text-xs text-gray-500">
      {children}
    </p>
  );
}

export const FormField = {
  Root,
  Label,
  Input: FieldInput,
  Hint,
};
