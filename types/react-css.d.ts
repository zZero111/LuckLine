// Lets inline styles carry CSS custom properties: style={{ "--x": 1 }}.
import "react";

declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
