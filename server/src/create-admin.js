require("dotenv").config();
const readline = require("node:readline");
const bcrypt = require("bcryptjs");
const db = require("./db");

function ask(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

function askHidden(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    return ask(question + " (input may be visible in this terminal): ");
  }
  return new Promise(resolve => {
    let value = "";
    process.stdout.write(question);
    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const onData = char => {
      if (char === "\u0003") {
        process.stdin.setRawMode(false);
        process.stdin.removeListener("data", onData);
        process.stdout.write("\nCancelled.\n");
        process.exit(1);
      }
      if (char === "\r" || char === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
      else if (char >= " ") value += char;
    };
    process.stdin.on("data", onData);
  });
}

async function main() {
  console.log("\nCreate an EduTrack Pro administrator account. Keep these credentials private.\n");
  const firstName = await ask("First name: ");
  const lastName = await ask("Last name: ");
  const email = (await ask("Email: ")).toLowerCase();
  const college = (await ask("College [engineering/medical/business/law/arts]: ")).toLowerCase();
  const password = await askHidden("Password (min 12 characters): ");

  const codes = { engineering: "ENG", medical: "MED", business: "BUS", law: "LAW", arts: "ART" };
  if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email) || !codes[college] || password.length < 12) {
    console.error("Invalid details. Check the names, email, college and password length.");
    process.exitCode = 1;
    return;
  }
  if (db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE").get(email)) {
    console.error("That email already has an account. Use another email or update the existing database account.");
    process.exitCode = 1;
    return;
  }

  const year = new Date().getFullYear();
  const count = db.prepare("SELECT COUNT(*) AS n FROM users WHERE college = ? AND id LIKE ?").get(college, `${codes[college]}${year}%`).n;
  const id = `${codes[college]}${year}${String(count + 1).padStart(3, "0")}`;
  const passwordHash = await bcrypt.hash(password, 12);
  db.prepare(`INSERT INTO users (id, first_name, last_name, college, email, password_hash, department, year, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'admin')`).run(id, firstName, lastName, college, email, passwordHash, "Administration", 1);
  console.log(`\nAdministrator created.\nStudent ID: ${id}\nCollege: ${college}\nEmail: ${email}\nSign in at app.html with this ID, college and password.\n`);
}

main().catch(error => {
  console.error("Could not create administrator:", error.message);
  process.exitCode = 1;
});
