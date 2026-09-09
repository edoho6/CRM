/**
 * The two focus treatments in the design system. Two, not five.
 *
 * Before this, buttons rang in `jade-600`, inputs in a translucent
 * `jade-600/30`, the combobox in a `ring-jade-600/25` box-shadow, and the
 * toggle, collapsible and signature pad in `accent` — and none of those moved
 * in dark mode, where the green sits on a near-black surface. Every one of
 * them now resolves to `--color-focus`, which is measured at 3:1 or better on
 * every surface in both themes by `check:contrast`.
 *
 * `focusRing` is for things you press: buttons, links, tabs, menu rows. The
 * ring stands off the edge so it does not fight the control's own border.
 *
 * `focusField` is for things you type into. The ring hugs the border and the
 * border takes the colour too, because an offset ring around a full-width
 * input reads as a second box, and a solid border is the convention every
 * form on the web has taught people to expect.
 *
 * Both are `focus-visible`, not `focus`: a click on a button should not leave
 * a ring behind, and a click into a text field still shows one because the
 * browser treats typing focus as visible — which is the behaviour wanted.
 */
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export const focusField =
  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus focus-visible:border-focus';
