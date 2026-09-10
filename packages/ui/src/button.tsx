import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { focusRing } from './focus';

/**
 * Every enabled button lifts slightly and casts a shadow on hover, and settles
 * back on press. That is the affordance: the movement answers "can I click
 * this?" before the click, and a disabled button stays flat so the answer is
 * visibly no.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium select-none ' +
    'transition-all duration-150 ease-out cursor-pointer ' +
    'hover:-translate-y-px hover:shadow-md active:translate-y-0 active:shadow-sm ' +
    `${focusRing} ` +
    'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 ' +
    'disabled:cursor-not-allowed ' +
    // `asChild` renders a link or a span, which `:disabled` never matches;
    // the same look follows `aria-disabled` so a dead pager button looks dead.
    'aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:shadow-none aria-disabled:translate-y-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:bg-accent active:bg-accent-strong shadow-xs',
        secondary:
          'bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 hover:border-ink-300 active:bg-ink-100 shadow-xs',
        ghost: 'text-ink-700 hover:bg-ink-100 hover:shadow-sm active:bg-ink-200',
        danger: 'bg-danger text-accent-fg hover:bg-danger-strong active:bg-danger-strong shadow-xs',
        link: 'text-jade-700 underline-offset-4 hover:underline hover:translate-y-0 hover:shadow-none',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        // Buttons inside a form default to submit, which silently submits forms
        // when a "remove row" button forgets to declare itself.
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
