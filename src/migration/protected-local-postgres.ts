import { userInfo } from "node:os";
import pgPass from "pgpass";

export const protectedLocalPostgresUser = process.env.PGUSER ?? userInfo().username;

const protectedCredentialLookup = {
  host: "127.0.0.1",
  port: "5432",
  database: "savinggrace_sermons_test",
  user: protectedLocalPostgresUser
};

export function protectedLocalPostgresPassword(): Promise<string> {
  return new Promise((resolve, reject) => {
    pgPass(protectedCredentialLookup, (password) => {
      if (typeof password !== "string" || password.length === 0) {
        reject(new Error("The protected local PostgreSQL credential is unavailable"));
        return;
      }
      resolve(password);
    });
  });
}
