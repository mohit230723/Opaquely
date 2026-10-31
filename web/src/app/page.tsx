import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { PrivacySection } from "@/components/home/PrivacySection";
import { TechSection } from "@/components/home/TechSection";
import { ClosingCta } from "@/components/home/ClosingCta";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <PrivacySection />
      <TechSection />
      <ClosingCta />
    </>
  );
}
