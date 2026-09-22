import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "concierge-agent": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        mode?: string;
        open?: string;
        autoplay?: string;
        highlight?: string;
      };
    }
  }
}
