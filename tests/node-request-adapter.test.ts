import { describe, expect, it } from "vitest";
import {
  IncomingRequestTooLargeError,
  toWebRequest,
  type NodeIncomingRequest
} from "../src/server/http/node-request-adapter";

function incoming(body: string): NodeIncomingRequest {
  return {
    method: "POST",
    url: "/api/v1/admin/sermons",
    headers: { "content-type": "application/json" },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(body, "utf8");
    }
  };
}

describe("local Node request adapter", () => {
  it("forwards JSON mutation bodies to portable Web Request handlers", async () => {
    const body = { title: "Local draft", slug: "local-draft" };
    const request = await toWebRequest(
      incoming(JSON.stringify(body)),
      "http://127.0.0.1:4322"
    );
    expect(request.method).toBe("POST");
    expect(await request.json()).toEqual(body);
  });

  it("rejects mutation bodies above the adapter limit", async () => {
    await expect(
      toWebRequest(incoming(JSON.stringify({ value: "too long" })), "http://127.0.0.1:4322", 4)
    ).rejects.toBeInstanceOf(IncomingRequestTooLargeError);
  });
});
