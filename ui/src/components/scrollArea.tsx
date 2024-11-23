import { forwardRef, PropsWithChildren, HTMLAttributes } from 'react';
import { css } from '@emotion/css';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import clsx from 'clsx';

const scrollAreaRootCss = css({
  overflow: 'hidden',
  '--scrollbar-size': '10px',
});

const scrollAreaViewportCss = css({
  height: '100%',
  width: '100%',
  '&.disable-x > *': {
    minWidth: 'unset !important',
  },
});

const scrollAreaScrollbarCss = css({
  display: 'flex',
  userSelect: 'none',
  touchAction: 'none',
  padding: '2px',
  transition: 'background 160ms ease-out',
  '&[data-orientation="vertical"]': {
    width: 'var(--scrollbar-size)',
  },
  '&[data-orientation="horizontal"]': {
    flexDirection: 'column',
    height: 'var(--scrollbar-size)',
  },
});

const scrollAreaThumbCss = css({
  flex: 1,
  backgroundColor: 'var(--vscode-scrollbarSlider-background)',
  borderRadius: 'var(--scrollbar-size)',
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '100%',
    height: '100%',
    minWidth: '44px',
    minHeight: '44px',
  },
  '&:hover': {
    backgroundColor: 'var(--vscode-scrollbarSlider-hoverBackground)',
  },
  '&:active': {
    backgroundColor: 'var(--vscode-scrollbarSlider-activeBackground)',
  },
});

const ScrollArea = forwardRef<
  HTMLDivElement,
  PropsWithChildren<
    { disableX?: boolean } & Pick<
      HTMLAttributes<HTMLDivElement>,
      'style' | 'className'
    >
  >
>(({ children, className, disableX, ...other }, ref) => {
  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={clsx(scrollAreaRootCss, className)}
      {...other}
    >
      <ScrollAreaPrimitive.Viewport
        className={clsx(scrollAreaViewportCss, disableX && 'disable-x')}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        className={scrollAreaScrollbarCss}
      >
        <ScrollAreaPrimitive.Thumb className={scrollAreaThumbCss} />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Scrollbar
        orientation="horizontal"
        className={scrollAreaScrollbarCss}
      >
        <ScrollAreaPrimitive.Thumb className={scrollAreaThumbCss} />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});

export default ScrollArea;
