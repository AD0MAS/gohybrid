"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordFieldProps = {
  name: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  className: string;
};

/**
 * Password input with a show/hide toggle, shared by /login and /register so
 * the toggle isn't duplicated across the two forms — only this field is a
 * client component, both pages stay Server Components. Starts hidden, and
 * each instance holds its own state: nothing shared or persisted.
 *
 * `className` is the field's existing input styling as each page already
 * has it, with `px-4` split into `pl-4 pr-11` at the call site so the toggle
 * button has room on the right without the input text running under it.
 */
export default function PasswordField({
  name,
  required,
  minLength,
  autoComplete,
  className,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        name={name}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className={className}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-small text-ink-subtle hover:bg-surface-2 hover:text-ink active:bg-surface-2 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
