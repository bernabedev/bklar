import Link from "next/link";
import { ArrowRight, Zap, ShieldCheck, Box } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background text-foreground selection:bg-primary/20">
      {/* Background Gradients */}
      <div className="fixed top-0 -z-10 h-screen w-screen bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />

      {/* --- HERO SECTION --- */}
      <section className="container relative mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-4 py-24 text-center md:py-32">
        {/* Badge */}
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary backdrop-blur-sm">
          <span>v2.0 is now available</span>
        </div>

        {/* Title */}
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl md:text-8xl">
          Build faster with{" "}
          <span className="bg-linear-to-b from-primary to-primary/60 bg-clip-text text-transparent">
            Bklar
          </span>
        </h1>

        {/* Subtitle */}
        <p className="max-w-2xl leading-normal text-muted-foreground sm:text-xl sm:leading-8">
          The minimalist, high-performance web framework for Bun.{" "}
          <br className="hidden md:block" />
          Type-safe validation, native WebSockets, and a robust ecosystem
          included.
        </p>

        {/* Installation Command */}
        <div className="mt-4 flex items-center gap-2 rounded-lg border bg-secondary/50 px-4 py-2 font-mono text-sm backdrop-blur-md">
          <span className="text-primary">❯</span> bun create bklar my-app
        </div>

        {/* CTA Buttons */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/docs"
            className="text-white inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Get Started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link
            href="https://github.com/bernabedev/bklar"
            target="_blank"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            GitHub
          </Link>
        </div>
      </section>

      {/* --- FEATURES GRID --- */}
      <section className="container mx-auto max-w-[1200px] px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <FeatureCard
            icon={<Zap className="h-8 w-8 text-yellow-500" />}
            title="Native Performance"
            description="Built directly on Bun.serve. Zero Node.js compatibility overhead means raw speed."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-8 w-8 text-blue-500" />}
            title="End-to-End Type Safety"
            description="Integrated Zod validation ensures your API inputs and outputs are strictly typed."
          />
          <FeatureCard
            icon={<Box className="h-8 w-8 text-purple-500" />}
            title="Batteries Included"
            description="Official packages for CORS, JWT, Logger, Uploads, and Swagger Documentation."
          />
        </div>
      </section>

      {/* --- CODE SHOWCASE --- */}
      <section className="container mx-auto mb-24 max-w-[900px] px-4">
        <div className="overflow-hidden rounded-xl border bg-[#0d1117] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500/80" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <div className="h-3 w-3 rounded-full bg-green-500/80" />
            </div>
            <span className="ml-2 text-xs font-medium text-gray-400">
              index.ts
            </span>
          </div>
          <div className="overflow-x-auto p-6">
            <pre className="font-mono text-sm leading-relaxed text-gray-300">
              <code>
                <span className="text-purple-400">import</span> {"{"} Bklar{" "}
                {"}"} <span className="text-purple-400">from</span>{" "}
                <span className="text-green-400">"bklar"</span>;{"\n"}
                <span className="text-purple-400">import</span> {"{"} z {"}"}{" "}
                <span className="text-purple-400">from</span>{" "}
                <span className="text-green-400">"zod"</span>;{"\n"}
                {"\n"}
                <span className="text-purple-400">const</span> app ={" "}
                <span className="text-blue-400">Bklar</span>();{"\n"}
                {"\n"}
                <span className="text-gray-500">
                  // Native Validation & Type Inference
                </span>
                {"\n"}
                app.<span className="text-blue-400">get</span>(
                <span className="text-green-400">"/users/:id"</span>, (ctx){" "}
                <span className="text-purple-400">=&gt;</span> {"{"}
                {"\n"}
                {"  "} <span className="text-purple-400">return</span> ctx.
                <span className="text-blue-400">json</span>({"{"}
                {"\n"}
                {"    "} id: ctx.params.id,{"\n"}
                {"    "} role: <span className="text-green-400">"guest"</span>
                {"\n"}
                {"  "} {"}"});{"\n"}
                {"},"} {"{"}
                {"\n"}
                {"  "} schemas: {"{"}
                {"\n"}
                {"    "} params: z.<span className="text-blue-400">object</span>
                ({"{"} id: z.coerce.
                <span className="text-blue-400">number</span>() {"}"}){"\n"}
                {"  "} {"}"}
                {"\n"}
                {"}"});{"\n"}
                {"\n"}
                app.<span className="text-blue-400">listen</span>(
                <span className="text-orange-400">3000</span>);
              </code>
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-2xl border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg border-dashed">
      <div className="mb-4 inline-block rounded-lg bg-secondary p-3 group-hover:bg-secondary/80">
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-bold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
