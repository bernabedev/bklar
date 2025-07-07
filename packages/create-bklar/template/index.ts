import { Bklar } from "bklar";

const app = Bklar();

console.log("🐰 Welcome to your new bklar application!");

app.get("/", (ctx) => {
  return ctx.json({
    message: "Everything is running smoothly!",
    documentation: "https://github.com/bernabedev/bklar#readme",
  });
});

app.listen(3000, (server) => {
  console.log(
    `\nVisit http://${server.hostname}:${server.port} in your browser.`
  );
});
