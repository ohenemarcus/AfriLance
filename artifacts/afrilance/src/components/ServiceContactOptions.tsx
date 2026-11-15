import { MessageCircle, MessageSquareText, Phone } from "lucide-react";
import { phoneNumberUrl, whatsappUrl, type ServiceListing } from "@/lib/services";

export function ServiceContactOptions({
  service,
  onSelect,
}: {
  service: ServiceListing;
  onSelect?: () => void;
}) {
  const linkClassName = "flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold text-foreground hover:bg-muted";

  return (
    <div className="space-y-3">
      <a
        href={whatsappUrl(service.whatsappNumber)}
        target="_blank"
        rel="noreferrer"
        onClick={onSelect}
        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800"
      >
        <MessageCircle className="size-5" aria-hidden="true" /> Chat on WhatsApp
      </a>
      <a
        href={phoneNumberUrl(service.phoneNumber, "sms")}
        onClick={onSelect}
        className={linkClassName}
      >
        <MessageSquareText className="size-5" aria-hidden="true" /> Send text message
      </a>
      <a
        href={phoneNumberUrl(service.phoneNumber, "tel")}
        onClick={onSelect}
        className={linkClassName}
      >
        <Phone className="size-5" aria-hidden="true" /> Call {service.phoneNumber}
      </a>
    </div>
  );
}
