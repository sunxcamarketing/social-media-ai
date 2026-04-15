import { Loader2 } from "lucide-react";

export default function PortalLoading() {
  return (
    <div className="flex items-center justify-center py-24 text-ocean/30">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
