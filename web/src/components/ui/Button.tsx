import type {
  ButtonHTMLAttributes,
  AnchorHTMLAttributes,
  ReactNode,
} from "react";
import { Link, type LinkProps } from "react-router-dom";
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "./buttonStyles";

// The three button surfaces of the app, sharing one style contract:
//   <Button>       a native button (onClick actions, form submits)
//   <ButtonLink>   an in-app navigation link (react-router)
//   <ButtonAnchor> an external link (explorer, friendbot), opens in a new tab
// All take variant + size and forward the rest, so callers never hand-write the
// button class string again.

interface StyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

type ButtonProps = StyleProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

export function Button({
  variant,
  size,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

type ButtonLinkProps = StyleProps & LinkProps & { children: ReactNode };

export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

type ButtonAnchorProps = StyleProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode };

export function ButtonAnchor({
  variant,
  size,
  className,
  children,
  ...rest
}: ButtonAnchorProps) {
  return (
    <a className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </a>
  );
}
