import { Hero } from "@/components/Hero";
import { FlowSteps } from "@/components/FlowSteps";
import { PrivacySection } from "@/components/home/PrivacySection";
import { TechSection } from "@/components/home/TechSection";
import { ClosingCta } from "@/components/home/ClosingCta";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <FlowSteps />
      <PrivacySection />
      <TechSection />
      <ClosingCta />
    </>
  );
}
