// Generates the JWT keypair Convex Auth needs and prints the two env values.
// Usage: node scripts/generateAuthKeys.mjs <outDir>
// Writes JWT_PRIVATE_KEY.txt and JWKS.txt into <outDir> (default: ./.auth-keys)
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2] ?? ".auth-keys";
const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "JWT_PRIVATE_KEY.txt"),
  privateKey.trimEnd().replace(/\n/g, " ")
);
writeFileSync(join(outDir, "JWKS.txt"), jwks);
console.log(`Wrote JWT_PRIVATE_KEY.txt and JWKS.txt to ${outDir}/`);
