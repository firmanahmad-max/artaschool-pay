import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const Label = forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  <label
    ref={ref}
    className={cn("text-sm font-medium leading-none", className)}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
