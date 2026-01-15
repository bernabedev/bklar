import Isotipo from "@/components/isotipo";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Isotipo className="h-6" />,
    },
  };
}
