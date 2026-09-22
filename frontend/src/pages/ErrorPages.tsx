import { ArrowLeft, ShieldAlert, SearchX } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function NotFoundPage() {
  useDocumentTitle("Not found");
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-muted p-4">
        <SearchX className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>
      <Button asChild>
        <Link to="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </Button>
    </div>
  );
}

export function ForbiddenPage() {
  useDocumentTitle("Access denied");
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <ShieldAlert className="h-8 w-8 text-destructive" aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Your role does not allow you to open this page. If you believe this is wrong, ask your
          TPM to review your permissions.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </Button>
    </div>
  );
}
