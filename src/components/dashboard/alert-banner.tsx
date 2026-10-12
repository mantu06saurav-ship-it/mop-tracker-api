import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AlertBanner({ belowMopCount }: { belowMopCount: number }) {
  if (belowMopCount <= 0) return null;

  return (
    <Alert
      variant="destructive"
      className="mb-6 border-warning/40 bg-warning/10 text-warning [&_svg]:text-warning"
    >
      <TriangleAlert />
      <AlertTitle>
        {belowMopCount} SKU{belowMopCount === 1 ? "" : "s"} currently priced below MOP
      </AlertTitle>
      <AlertDescription className="text-warning/80">
        Configure automated email alerts in{" "}
        <Link href="/users" className="font-medium underline underline-offset-2">
          Manage Users → Email Automation
        </Link>{" "}
        to get notified as soon as a listing breaches its floor price.
      </AlertDescription>
    </Alert>
  );
}
