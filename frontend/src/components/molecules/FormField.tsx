import React, { createContext, useContext, useId } from 'react';
import { Input } from '../atoms/Input';

type FormFieldContextValue = {
  fieldId: string;
  hasError: boolean;
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

  return (
    <FormFieldContext.Provider value={{ fieldId, hasError: Boolean(error) }}>
      <div className={`space-y-2 ${className}`.trim()}>
        {children}
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
      </div>
    </FormFieldContext.Provider>
  );
}

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const context = useContext(FormFieldContext);

  return (
    <label htmlFor={context?.fieldId} className={`block text-sm font-medium text-gray-200 ${className}`.trim()}>
      {children}
    </label>
  );
}

type FormFieldInputProps = React.ComponentProps<typeof Input>;

const FieldInput = React.forwardRef<HTMLInputElement, FormFieldInputProps>(function FieldInput(props, ref) {
  const context = useContext(FormFieldContext);

  return <Input ref={ref} id={context?.fieldId} hasError={context?.hasError} {...props} />;
});

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-500">{children}</p>;
}

export const FormField = {
  Root,
  Label,
  Input: FieldInput,
  Hint,
};
