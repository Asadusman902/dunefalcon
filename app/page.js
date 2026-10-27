import { LANDING_HTML } from "@/lib/markup";
import { getConfig } from "@/lib/data";
import { DEFAULT_PACKAGES, DEFAULT_SCHEDULE, DEFAULT_BUSINESS } from "@/lib/defaults";

export const dynamic = "force-dynamic";

export default async function Home() {
  let config;
  try {
    config = await getConfig();
  } catch (e) {
    console.error("[home] config load failed, using defaults", e);
    config = { packages: DEFAULT_PACKAGES, schedule: DEFAULT_SCHEDULE, business: DEFAULT_BUSINESS };
  }
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />
      <script id="df-config" type="application/json" dangerouslySetInnerHTML={{ __html: json }} />
      {/* deferred scripts run in order: translations first */}
      <script src="/booking-i18n.js" defer />
      <script src="/booking.js" defer />
    </>
  );
}
