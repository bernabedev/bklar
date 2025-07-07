import { createApp } from "@framework/core";

const app = createApp();

app.use(() => {
  console.log("Global middleware");
});

app.get("/health", () => {
  return new Response(JSON.stringify({ status: "ok" }));
});

app.group("/auth", (r) => {
  r.add("POST", "/login", () => {
    return new Response(JSON.stringify({ token: "..." }));
  });
});

app.listen(4000);
