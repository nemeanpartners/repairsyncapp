import * as React from "react"
import { Input } from "./input"

export interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  debounce?: number;
}

export const DebouncedInput = React.forwardRef<HTMLInputElement, DebouncedInputProps>(
  ({ value: initialValue, onChange, debounce = 300, ...props }, ref) => {
    const [value, setValue] = React.useState(initialValue)

    React.useEffect(() => {
      setValue(initialValue)
    }, [initialValue])

    React.useEffect(() => {
      const timeout = setTimeout(() => {
        if (value !== initialValue) {
          onChange(value);
        }
      }, debounce)

      return () => clearTimeout(timeout)
    }, [value, debounce, onChange, initialValue])

    return (
      <Input
        {...props}
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    )
  }
)
DebouncedInput.displayName = "DebouncedInput"
