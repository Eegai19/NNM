import { chromium } from "playwright";

const OUT = process.env.NNM_E2E_OUT ?? "e2e/screenshots";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();

const step = async (name, fn) => {
  try { await fn(); console.log("PASS  " + name); }
  catch (e) { console.log("FAIL  " + name + " :: " + e.message.split("\n")[0]); process.exitCode = 1; }
};

const login = async (username, password) => {
  await page.goto("http://127.0.0.1:5173/login", { waitUntil: "networkidle" });
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
};

const logout = async () => {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: /sign out/i }).click();
  await page.waitForURL("**/login", { timeout: 10000 });
};

// Find a node the TPM can work on.
let nodeUrl;
let activityName;
let row;

await step("TPM signs in", async () => { await login("admin", "Admin@123"); });

await step("open a node with an activity that has no logs yet", async () => {
  // Re-runnable: ask the API for an activity that still has zero logs rather
  // than assuming the first row is pristine.
  const found = await page.evaluate(async () => {
    const token = sessionStorage.getItem("nnm.token") ?? localStorage.getItem("nnm.token");
    const headers = { Authorization: `Bearer ${token}` };
    const page1 = await (
      await fetch("/api/activities?page_size=200&status=Pending", { headers })
    ).json();
    const clean = page1.items.find((a) => a.log_count === 0);
    return clean ? { nodeId: clean.node_id, name: clean.activity_name } : null;
  });
  if (!found) throw new Error("no activity without logs left in the demo data -- reseed");

  activityName = found.name;
  await page.goto(`http://127.0.0.1:5173/nodes/${found.nodeId}`, { waitUntil: "networkidle" });
  nodeUrl = page.url();
  await page.waitForTimeout(1500);

  row = page.locator("li").filter({ hasText: activityName }).first();
  await row.locator("button[aria-expanded]").first().click();
  await page.waitForTimeout(600);
});

await step("Completed is blocked while the activity has no log", async () => {
  await row.locator("[aria-label^='Status for']").first().click();
  await page.waitForTimeout(400);
  const completed = page.getByRole("option", { name: /Completed \(needs a log\)/ });
  if ((await completed.count()) === 0) throw new Error("expected a disabled Completed option");
  if ((await completed.getAttribute("data-disabled")) === null) {
    throw new Error("Completed option was not disabled");
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
});

await step("upload an activity log", async () => {
  const input = row.locator("input[type=file]").first();
  await input.setInputFiles({
    name: "acceptance-report.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 acceptance evidence"),
  });
  await page.waitForTimeout(2000);
  const text = await page.locator("main").innerText();
  if (!text.includes("acceptance-report.pdf")) throw new Error("uploaded file not listed");
  await page.screenshot({ path: `${OUT}/13-log-uploaded.png`, fullPage: true });
});

await step("Completed is now allowed and applies", async () => {
  await row.locator("[aria-label^='Status for']").first().click();
  await page.waitForTimeout(500);
  await page.getByRole("option", { name: "Completed", exact: true }).click();
  await page.waitForTimeout(2000);
  const text = await page.locator("main").innerText();
  if (!/completed/i.test(text)) throw new Error("activity did not move to Completed");
  await page.screenshot({ path: `${OUT}/14-activity-completed.png`, fullPage: true });
});

await step("timeline records the upload and the status change", async () => {
  await page.getByRole("tab", { name: "Timeline" }).click();
  await page.waitForTimeout(1200);
  const text = await page.locator("main").innerText();
  if (!/Uploaded 'acceptance-report.pdf'/.test(text)) throw new Error("upload not audited");
  if (!/moved from/i.test(text)) throw new Error("status change not audited");
});

await step("TPM signs out", async () => { await logout(); });

// A fresh context avoids any state carried over from the TPM session.
const engCtx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const eng = await engCtx.newPage();

const engLogin = async () => {
  await eng.goto("http://127.0.0.1:5173/login", { waitUntil: "networkidle" });
  await eng.getByLabel("Username").fill("eegai");
  await eng.getByLabel("Password", { exact: true }).fill("Nokia@123");
  await eng.getByRole("button", { name: "Sign in" }).click();
  await eng.waitForURL("**/dashboard", { timeout: 20000 });
};

await step("engineer signs in and sees a reduced menu", async () => {
  await engLogin();
  const sidebar = await eng.locator("aside").innerText();
  if (/Users/.test(sidebar)) throw new Error("engineer should not see Users");
  if (/Assignments/.test(sidebar)) throw new Error("engineer should not see Assignments");
  if (!/Nodes/.test(sidebar)) throw new Error("engineer should see Nodes");
  await eng.screenshot({ path: `${OUT}/15-engineer-dashboard.png`, fullPage: true });
});

await step("engineer is redirected away from the Users route", async () => {
  await eng.goto("http://127.0.0.1:5173/users", { waitUntil: "networkidle" });
  await eng.waitForTimeout(1200);
  if (!eng.url().includes("/forbidden")) throw new Error("expected a redirect to /forbidden");
  const text = await eng.locator("main").innerText();
  if (!/Access denied/.test(text)) throw new Error("forbidden page did not render");
  await eng.screenshot({ path: `${OUT}/16-forbidden.png` });
});

await step("engineer sees a read-only node they are not assigned to", async () => {
  // Ask the API which nodes this engineer works on, then open one they do not.
  const unassignedId = await eng.evaluate(async () => {
    const token = sessionStorage.getItem("nnm.token") ?? localStorage.getItem("nnm.token");
    const headers = { Authorization: `Bearer ${token}` };
    const all = await (await fetch("/api/nodes?page_size=200", { headers })).json();
    const mine = await (await fetch("/api/nodes?mine=true&page_size=200", { headers })).json();
    const mineIds = new Set(mine.items.map((n) => n.id));
    const other = all.items.find((n) => !mineIds.has(n.id));
    return other ? other.id : null;
  });
  if (!unassignedId) throw new Error("no unassigned node available in the demo data");

  await eng.goto(`http://127.0.0.1:5173/nodes/${unassignedId}`, { waitUntil: "networkidle" });
  await eng.waitForTimeout(2000);
  const text = await eng.locator("main").innerText();
  if (!/Read only/.test(text)) throw new Error("expected the read-only badge");
  if (/Add activity/.test(text)) throw new Error("write controls should be hidden");
  await eng.screenshot({ path: `${OUT}/17-engineer-readonly.png`, fullPage: true });
});

await step("engineer CAN modify a node they are assigned to", async () => {
  const assignedId = await eng.evaluate(async () => {
    const token = sessionStorage.getItem("nnm.token") ?? localStorage.getItem("nnm.token");
    const mine = await (
      await fetch("/api/nodes?mine=true&page_size=50", {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json();
    return mine.items.length ? mine.items[0].id : null;
  });
  if (!assignedId) throw new Error("engineer has no assigned node in the demo data");

  await eng.goto(`http://127.0.0.1:5173/nodes/${assignedId}`, { waitUntil: "networkidle" });
  await eng.waitForTimeout(2000);
  const text = await eng.locator("main").innerText();
  if (/Read only/.test(text)) throw new Error("assigned engineer should not be read-only");
  if (!/Add activity|Edit/.test(text)) throw new Error("write controls missing for an assignee");
  await eng.screenshot({ path: `${OUT}/18-engineer-writable.png`, fullPage: true });
});

await browser.close();
