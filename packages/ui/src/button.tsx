import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { focusRing } from './focus';

/**
 * Every enabled button lifts slightly and casts a shadow on hover, and
 * settles — a touch smaller — on press. That is the affordance: the movement
 * answers "can I click this?" before the click, the press answers "you did",
 * and a disabled button stays flat so the answer is visibly no. Tailwind
 * wraps `hover:` in `@media (hover: hover)`, so a finger never leaves a
 * button stuck in its hovered state.
 *
 * `icon` is 40px like the default button beside it; `icon-sm` is the 32px
 * one for a table row. On a coarse pointer every size grows to the 44px a
 * finger needs.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium select-none ' +
    'transition-all duration-(--duration-fast) ease-(--ease-standard) cursor-pointer ' +
    'hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-[0.98] active:shadow-xs ' +
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
        link: 'text-jade-700 underline-offset-4 hover:underline hover:translate-y-0 hover:shadow-none active:scale-100',
      },
      size: {
        sm: 'h-8 px-3 text-sm pointer-coarse:min-h-11',
        md: 'h-10 px-4 text-sm pointer-coarse:min-h-11',
        lg: 'h-11 px-5 text-base',
        icon: 'h-10 w-10 pointer-coarse:min-h-11 pointer-coarse:min-w-11',
        'icon-sm': 'h-8 w-8 pointer-coarse:min-h-11 pointer-coarse:min-w-11',
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
