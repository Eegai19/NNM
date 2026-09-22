import { ALLOWED_UPLOAD_EXTENSIONS, MAX_UPLOAD_MB } from "@/utils/constants";

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export function requiredText(value: string | undefined | null, label: string): string | undefined {
  if (!value || !value.trim()) return `${label} is required`;
  return undefined;
}

export function minLength(value: string, length: number, label: string): string | undefined {
  if (value.trim().length < length) return `${label} must be at least ${length} characters`;
  return undefined;
}

export function validateUsername(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Username is required";
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(trimmed)) {
    return "Use 3-64 letters, digits, dot, dash or underscore";
  }
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return "Password is required";
  if (value.length < 8) return "Password must be at least 8 characters";
  return undefined;
}

export function validateMobile(value: string): string | undefined {
  if (!value.trim()) return undefined;
  if (!/^[0-9+\-\s]{6,20}$/.test(value.trim())) return "Enter a valid mobile number";
  return undefined;
}

/** Client-side mirror of the backend's upload rules, for instant feedback. */
export function validateUploadFile(file: File): string | undefined {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(extension as (typeof ALLOWED_UPLOAD_EXTENSIONS)[number])) {
    return `Unsupported file type. Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(", ")}`;
  }
  if (file.size === 0) return "The selected file is empty";
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `File is larger than the ${MAX_UPLOAD_MB} MB limit`;
  }
  return undefined;
}

/** True when every value in the error map is undefined. */
export function isValid<T>(errors: FieldErrors<T>): boolean {
  return Object.values(errors).every((message) => !message);
}
