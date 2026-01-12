import { bklarClient } from "bklar";
import type { AppType } from "./index";

const client = bklarClient<AppType>("http://localhost:4000");

async function runTests() {
  console.log("🚀 Starting RPC Client Tests...");

  try {
    // 1. Health Check
    console.log("\n1. Testing GET /health...");
    const health = await client.health.get({});
    console.log("   ✅ Result:", health);
    if (health.status !== "ok") throw new Error("Health check failed");

    // 2. Login
    console.log("\n2. Testing POST /login...");
    const loginRes = await client.login.post({
      body: {
        email: "john.doe@example.com",
        password: "password123",
      },
    });
    console.log("   ✅ Token received:", loginRes.token ? "YES" : "NO");
    const token = loginRes.token;

    // 3. Protected Profile
    console.log("\n3. Testing GET /profile (via fetch with token)...");
    const profileRes = await fetch("http://localhost:4000/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const profile = await profileRes.json();
    console.log("   ✅ Profile:", profile);
    if (!profile.user) throw new Error("Profile failed");

    // 4. Get Users (RPC)
    console.log("\n4. Testing GET /users...");
    const users = await client.users.get({ query: { page: 1, limit: 5 } });
    console.log(`   ✅ Got ${users.length} users`);

    console.log("\n✨ All Integration Tests Passed!");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Test Failed:", err);
    process.exit(1);
  }
}

runTests();
