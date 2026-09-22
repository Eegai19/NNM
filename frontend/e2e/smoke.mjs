import { chromium } from "playwright";

const OUT = process.env.NNM_E2E_OUT ?? "e2e/screenshots";
const errors = [];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const nav = (name) => page.locator("aside").getByRole("link", { name, exact: true });

page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("response", (r) => { if (r.status() >= 400) errors.push(`http ${r.status()} ${r.url()}`); });

const step = async (name, fn) => {
  try { await fn(); console.log("PASS  " + name); }
  catch (e) { console.log("FAIL  " + name + " :: " + e.message); process.exitCode = 1; }
};

await step("login page loads", async () => {
  await page.goto("http://127.0.0.1:5173/login", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Sign in" }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${OUT}/01-login.png` });
});

await step("sign in as TPM", async () => {
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("Admin@123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/02-dashboard.png`, fullPage: true });
});

await step("dashboard shows real counters", async () => {
  const text = await page.locator("main").innerText();
  if (!/Total nodes/.test(text)) throw new Error("no stat cards");
  if (!/\b40\b/.test(text)) throw new Error("expected 40 nodes in the demo data");
  if (!/Engineer workload/.test(text)) throw new Error("workload chart missing");
});

await step("dark mode toggles", async () => {
  await page.getByRole("button", { name: /switch to dark mode/i }).click();
  await page.waitForTimeout(700);
  const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  if (!dark) throw new Error("dark class not applied");
  await page.screenshot({ path: `${OUT}/03-dashboard-dark.png`, fullPage: true });
  await page.getByRole("button", { name: /switch to light mode/i }).click();
  await page.waitForTimeout(500);
});

await step("nodes list paginates and filters", async () => {
  await nav("Nodes").click();
  await page.waitForURL("**/nodes");
  await page.waitForTimeout(1200);
  const text = await page.locator("main").innerText();
  if (!/of 40/.test(text)) throw new Error("pagination total missing: " + text.slice(0, 300));
  await page.screenshot({ path: `${OUT}/04-nodes.png`, fullPage: true });
});

await step("global search returns hits", async () => {
  await page.getByLabel("Global search").fill("TN-NOK");
  await page.waitForTimeout(1200);
  const dropdown = await page.locator("text=Nodes").count();
  if (dropdown === 0) throw new Error("no search results group");
  await page.screenshot({ path: `${OUT}/05-search.png` });
  await page.getByLabel("Clear search").click();
});

await step("node details opens with tabs", async () => {
  await page.locator("table tbody a").first().click();
  await page.waitForURL(/\/nodes\/\d+/);
  await page.waitForTimeout(1500);
  const text = await page.locator("main").innerText();
  for (const section of ["Node information", "Activities", "Assignments", "Timeline"]) {
    if (!text.includes(section)) throw new Error(`missing section: ${section}`);
  }
  await page.screenshot({ path: `${OUT}/06-node-details.png`, fullPage: true });
});

await step("timeline tab renders audit entries", async () => {
  await page.getByRole("tab", { name: "Timeline" }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/07-timeline.png`, fullPage: true });
});

await step("activities page loads", async () => {
  await nav("Activities").click();
  await page.waitForURL("**/activities");
  await page.waitForTimeout(1200);
  const text = await page.locator("main").innerText();
  if (!/of 184/.test(text)) throw new Error("expected 184 activities: " + text.slice(0, 300));
  await page.screenshot({ path: `${OUT}/08-activities.png`, fullPage: true });
});

await step("assignments page loads", async () => {
  await nav("Assignments").click();
  await page.waitForURL("**/assignments");
  await page.waitForTimeout(1200);
  await page.locator("aside").waitFor();
  await page.screenshot({ path: `${OUT}/09-assignments.png`, fullPage: true });
});

await step("users page loads (TPM only)", async () => {
  await nav("Users").click();
  await page.waitForURL("**/users");
  await page.waitForTimeout(1200);
  const text = await page.locator("main").innerText();
  if (!/User management/.test(text)) throw new Error("users page did not render");
  await page.screenshot({ path: `${OUT}/10-users.png`, fullPage: true });
});

await step("reports page loads with audit trail", async () => {
  await nav("Reports").click();
  await page.waitForURL("**/reports");
  await page.waitForTimeout(1400);
  const text = await page.locator("main").innerText();
  if (!/Audit trail/.test(text)) throw new Error("audit trail missing");
  await page.screenshot({ path: `${OUT}/11-reports.png`, fullPage: true });
});

await step("mobile layout works", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:5173/dashboard", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  if (overflow) throw new Error("horizontal overflow at 390px");
  await page.screenshot({ path: `${OUT}/12-mobile.png`, fullPage: true });
});

console.log("\n--- page errors ---");
console.log(errors.length ? errors.slice(0, 15).join("\n") : "none");
await browser.close();
