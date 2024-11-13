import styled from '@emotion/styled';
import { PropsWithChildren } from 'react';

export function ListItem(
  props: PropsWithChildren<{
    className?: string;
    secondaryText?: string;
    style?: React.CSSProperties;
    title?: string;
    onClick?: () => void;
  }>,
) {
  return (
    <li
      className={props.className}
      style={props.style}
      title={props.title}
      onClick={props.onClick}
    >
      <div style={{ flexGrow: 1 }}>{props.children}</div>
      <div className="secondary-text">{props.secondaryText}</div>
    </li>
  );
}

export const List = styled.ul({
  color: 'var(--vscode-quickInput-foreground)',
  // border: '1px solid var(--vscode-commandCenter-inactiveBorder)',
  backgroundColor: 'var(--vscode-quickInput-background)',
  padding: '0',
  margin: '0',
  '> li': {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    padding: '2px 8px',
    whiteSpace: 'nowrap',

    '&:hover': {
      backgroundColor: 'var(--vscode-list-hoverBackground)',
      color: 'var(--vscode-list-hoverForeground)',
    },

    '&.focus': {
      backgroundColor: 'var(--vscode-quickInputList-focusBackground)',

      '&:hover': {
        backgroundColor: 'var(--vscode-quickInputList-focusBackground)',
      },
    },
  },
  '& .secondary-text': {
    direction: 'rtl',
    textWrap: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: 'var(--vscode-input-placeholderForeground)',
  },
});
