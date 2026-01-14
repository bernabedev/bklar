import { Card, Cards } from "fumadocs-ui/components/card";
import Link from "next/link";

export function PluginCard({ title, desc, href, icon }: any) {
  return (
    <Link href={href} className="no-underline">
      <Cards>
        <Card
          icon={icon}
          title={title}
          description={desc}
          href={href}
          external
        />
      </Cards>
    </Link>
  );
}
