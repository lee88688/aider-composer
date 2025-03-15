import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';

import { css } from '@emotion/css';

const toggleGroupStyles = css({
  display: 'inline-flex',
  backgroundColor: 'var(--vscode-editor-background)',
  borderRadius: '4px',
  overflow: 'hidden',
  padding: '2px 4px',
  gap: '4px',
});

const toggleGroupItemStyles = css({
  all: 'unset',
  backgroundColor: 'transparent',
  display: 'flex',
  padding: '2px 3px',
  borderRadius: '4px',
  lineHeight: 1,
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  cursor: 'pointer',

  '&[data-state="on"]': {
    backgroundColor: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
  },
});

interface ToggleGroupProps {
  value?: string;
  options: string[];
  defaultValue?: string;
  onChange?: (value: string) => void;
}

export default function ToggleGroup({
  options,
  value,
  defaultValue,
  onChange,
}: ToggleGroupProps) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      defaultValue={defaultValue || options[0]}
      aria-label="Segmented Control"
      onValueChange={onChange}
      className={toggleGroupStyles}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option}
          value={option}
          aria-label={option}
          className={toggleGroupItemStyles}
        >
          {option}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}
