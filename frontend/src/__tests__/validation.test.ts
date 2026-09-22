import { describe, expect, it } from "vitest";

import {
  isValid,
  validateMobile,
  validatePassword,
  validateUploadFile,
  validateUsername,
} from "@/utils/validation";

function makeFile(name: string, size: number): File {
  const file = new File(["x"], name, { type: "application/octet-stream" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateUsername", () => {
  it("accepts allowed characters", () => {
    expect(validateUsername("priya.raman")).toBeUndefined();
    expect(validateUsername("eegai_19")).toBeUndefined();
  });

  it("rejects blanks, spaces and short values", () => {
    expect(validateUsername("")).toBe("Username is required");
    expect(validateUsername("ab")).toBeDefined();
    expect(validateUsername("has spaces")).toBeDefined();
  });
});

describe("validatePassword", () => {
  it("requires at least 8 characters", () => {
    expect(validatePassword("Password@123")).toBeUndefined();
    expect(validatePassword("short")).toBe("Password must be at least 8 characters");
    expect(validatePassword("")).toBe("Password is required");
  });
});

describe("validateMobile", () => {
  it("allows an empty value", () => {
    expect(validateMobile("")).toBeUndefined();
  });

  it("accepts digits and separators but rejects letters", () => {
    expect(validateMobile("9840012345")).toBeUndefined();
    expect(validateMobile("+91 98400-12345")).toBeUndefined();
    expect(validateMobile("not-a-number")).toBeDefined();
  });
});

describe("validateUploadFile", () => {
  it("accepts every supported extension", () => {
    for (const extension of ["pdf", "zip", "txt", "xlsx", "csv", "png", "jpg", "jpeg"]) {
      expect(validateUploadFile(makeFile(`evidence.${extension}`, 1024))).toBeUndefined();
    }
  });

  it("rejects an unsupported extension", () => {
    expect(validateUploadFile(makeFile("payload.exe", 1024))).toMatch(/Unsupported file type/);
  });

  it("rejects an empty file", () => {
    expect(validateUploadFile(makeFile("empty.txt", 0))).toBe("The selected file is empty");
  });

  it("rejects a file over the size limit", () => {
    expect(validateUploadFile(makeFile("big.zip", 40 * 1024 * 1024))).toMatch(/larger than/);
  });
});

describe("isValid", () => {
  it("is true only when every field is clean", () => {
    expect(isValid({ name: undefined, email: undefined })).toBe(true);
    expect(isValid({ name: "Required" })).toBe(false);
  });
});
